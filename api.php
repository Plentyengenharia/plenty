<?php
declare(strict_types=1);
define('PLENTY_BOOT',true);
ini_set('display_errors','0');
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header('Referrer-Policy: same-origin');
header('Permissions-Policy: geolocation=(), microphone=(), camera=()');
register_shutdown_function(static function (): void {
    $err = error_get_last();
    if (!$err) return;
    $fatal = [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR, E_USER_ERROR];
    if (!in_array($err['type'] ?? 0, $fatal, true)) return;
    if (headers_sent() === false) {
        http_response_code(500);
        header('Content-Type: application/json; charset=utf-8');
    }
    $msg = 'Falha no PHP do servidor.';
    $file = (string)($err['file'] ?? '');
    if (str_contains($file, 'private/bootstrap.php') || str_contains($file, 'private/config.php')) {
        $msg = 'Arquivos private/bootstrap.php ou private/config.php ausentes no servidor. Reenvie a pasta private do ZIP.';
    }
    echo json_encode(['ok'=>false,'message'=>$msg], JSON_UNESCAPED_UNICODE);
});
$bootFile = __DIR__.'/private/bootstrap.php';
$cfgFile = __DIR__.'/private/config.php';
if (!is_file($bootFile) || !is_file($cfgFile)) {
    http_response_code(503);
    echo json_encode([
        'ok'=>false,
        'message'=>'Pasta private incompleta no servidor. Envie private/bootstrap.php, private/config.php e private/schema.sql do ZIP.'
    ], JSON_UNESCAPED_UNICODE);
    exit;
}
require $bootFile;
$config=require $cfgFile;
$https=(!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS']!=='off') || (int)($_SERVER['SERVER_PORT']??0)===443;
if (!$https && !empty($config['require_https'])) fail('Acesse o site por HTTPS.',426);
ini_set('session.use_strict_mode','1');
ini_set('session.use_only_cookies','1');
ini_set('session.cookie_httponly','1');
session_name('PLENTY_SESSION');
session_set_cookie_params(['lifetime'=>0,'path'=>'/','secure'=>$https,'httponly'=>true,'samesite'=>'Strict']);
session_start();
if (empty($_SESSION['csrf'])) $_SESSION['csrf']=bin2hex(random_bytes(32));
$action=$_GET['action']??'session';
$db=null;
try {
    $db=database($config);
    if ($action==='session') {
        if ($_SERVER['REQUEST_METHOD']!=='GET') fail('Método não permitido.',405);
        $count=(int)$db->query('SELECT COUNT(*) FROM plenty_users')->fetchColumn();
        respond(['ok'=>true,'user'=>user($db),'csrf'=>$_SESSION['csrf'],'setup_required'=>$count===0]);
    }
    if (in_array($action,['setup','register','login'],true)) {
        requirePost(); $body=input(); rateLimit($db,'auth',20);
        $email=strtolower(textField($body,'email',190,true));
        if (!filter_var($email,FILTER_VALIDATE_EMAIL)) fail('Informe um e-mail válido.');
        $password=$body['password']??null;
        if (!is_string($password) || strlen($password)<10 || strlen($password)>72) fail('Use uma senha de 10 a 72 bytes.');
        if ($action==='login') {
            $q=$db->prepare('SELECT * FROM plenty_users WHERE email=?'); $q->execute([$email]); $u=$q->fetch();
            $hash=$u['password_hash']??'$2y$12$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2uheWG/igi.';
            if (!password_verify($password,$hash) || !$u) { audit($db,null,'login_fail',$email); fail('E-mail ou senha incorretos.',401); }
            if ($u['status']!=='active') fail('Seu cadastro aguarda aprovação ou está desativado. Fale com o administrador.',403);
            if (password_needs_rehash($u['password_hash'],PASSWORD_DEFAULT)) {
                $q=$db->prepare('UPDATE plenty_users SET password_hash=? WHERE id=?');
                $q->execute([password_hash($password,PASSWORD_DEFAULT),$u['id']]);
            }
            session_regenerate_id(true); $_SESSION['uid']=(int)$u['id']; $_SESSION['expires']=time()+28800;
            $_SESSION['csrf']=bin2hex(random_bytes(32));
            audit($db,(int)$u['id'],'login_ok',$email);
            respond(['ok'=>true,'user'=>user($db),'csrf'=>$_SESSION['csrf']]);
        }
        $name=textField($body,'name',100,true);
        if (strlen($name)<2) fail('Informe seu nome.');
        if ($action==='setup') {
            if (!hash_equals($config['setup_key'],(string)($body['setup_key']??''))) fail('Chave de instalação incorreta.',403);
            $q=$db->query("SELECT GET_LOCK('plenty_setup_v1',10)");
            if ((int)$q->fetchColumn()!==1) fail('Instalação em andamento. Tente novamente.',409);
            try {
                if ((int)$db->query('SELECT COUNT(*) FROM plenty_users')->fetchColumn()>0) fail('A instalação já foi concluída.',409);
                $q=$db->prepare("INSERT INTO plenty_users (name,email,password_hash,role,status) VALUES (?,?,?,'admin','active')");
                $q->execute([$name,$email,password_hash($password,PASSWORD_DEFAULT)]);
                audit($db,(int)$db->lastInsertId(),'setup_admin',$email);
            } finally { $db->query("SELECT RELEASE_LOCK('plenty_setup_v1')"); }
            respond(['ok'=>true,'message'=>'Administrador criado. Entre com seu e-mail e senha.']);
        }
        if ((int)$db->query('SELECT COUNT(*) FROM plenty_users')->fetchColumn()===0) fail('O administrador precisa concluir a instalação primeiro.',409);
        $phone=textField($body,'phone',40);
        $cargo=textField($body,'cargo',100);
        $departamento=textField($body,'departamento',100);
        $q=$db->prepare("INSERT INTO plenty_users (name,email,password_hash,phone,cargo,departamento,status) VALUES (?,?,?,?,?,?,'pending')");
        try { $q->execute([$name,$email,password_hash($password,PASSWORD_DEFAULT),$phone,$cargo,$departamento]); }
        catch (PDOException $e) { if ($e->getCode()==='23000') fail('Este e-mail já possui cadastro.',409); throw $e; }
        audit($db,(int)$db->lastInsertId(),'register_pending',$email);
        respond(['ok'=>true,'message'=>'Cadastro recebido. Aguarde a aprovação do administrador.']);
    }
    $u=requireUser($db);
    if ($action==='state' && $_SERVER['REQUEST_METHOD']==='GET') respond(['ok'=>true]+stateRead($db));
    if ($action==='employees' && $_SERVER['REQUEST_METHOD']==='GET') {
        requireAdmin($u);
        $rows=$db->query('SELECT id,name,email,role,status,phone,cargo,departamento,documento,notes,created_at,updated_at FROM plenty_users ORDER BY name')->fetchAll();
        respond(['ok'=>true,'employees'=>array_map('employeePublic',$rows)]);
    }
    if ($action==='users' && $_SERVER['REQUEST_METHOD']==='GET') {
        requireAdmin($u);
        $rows=$db->query('SELECT id,name,email,role,status,phone,cargo,departamento,documento,notes,created_at,updated_at FROM plenty_users ORDER BY name')->fetchAll();
        respond(['ok'=>true,'users'=>array_map('employeePublic',$rows)]);
    }
    requirePost(); $body=input();
    if ($action==='logout') {
        audit($db,(int)$u['id'],'logout','');
        $_SESSION=[];
        setcookie(session_name(),'', ['expires'=>time()-3600,'path'=>'/','secure'=>$https,'httponly'=>true,'samesite'=>'Strict']);
        session_destroy(); respond(['ok'=>true]);
    }
    if ($action==='user_status') {
        requireAdmin($u); $id=filter_var($body['id']??null,FILTER_VALIDATE_INT);
        if (!$id || (int)$u['id']===$id) fail('Não é possível alterar seu próprio acesso.');
        if (!in_array($body['status']??'', ['active','disabled','pending'],true)) fail('Status inválido.');
        $q=$db->prepare("UPDATE plenty_users SET status=? WHERE id=? AND role<>'admin'");
        $q->execute([$body['status'],$id]);
        if ($q->rowCount()<1) fail('Usuário não encontrado ou é administrador.');
        audit($db,(int)$u['id'],'user_status','id='.$id.' status='.$body['status']);
        respond(['ok'=>true]);
    }
    if ($action==='employee_save') {
        requireAdmin($u);
        $id=filter_var($body['id']??null,FILTER_VALIDATE_INT) ?: null;
        $name=textField($body,'name',100,true);
        if (strlen($name)<2) fail('Informe o nome completo.');
        $email=strtolower(textField($body,'email',190,true));
        if (!filter_var($email,FILTER_VALIDATE_EMAIL)) fail('Informe um e-mail válido.');
        $phone=textField($body,'phone',40);
        $cargo=textField($body,'cargo',100);
        $departamento=textField($body,'departamento',100);
        $documento=textField($body,'documento',40);
        $notes=textField($body,'notes',500);
        $status=textField($body,'status',16,true);
        if (!in_array($status,['active','pending','disabled'],true)) fail('Status inválido.');
        $role=textField($body,'role',16,true);
        if (!in_array($role,['member','admin'],true)) fail('Perfil inválido.');
        $password=$body['password']??'';
        if ($password!=='' && (!is_string($password) || strlen($password)<10 || strlen($password)>72)) {
            fail('Use uma senha de 10 a 72 bytes, ou deixe em branco para manter.');
        }
        if ($id) {
            $q=$db->prepare('SELECT * FROM plenty_users WHERE id=?'); $q->execute([$id]); $target=$q->fetch();
            if (!$target) fail('Funcionário não encontrado.',404);
            if ($target['role']==='admin' && $role!=='admin') {
                $admins=(int)$db->query("SELECT COUNT(*) FROM plenty_users WHERE role='admin' AND status='active'")->fetchColumn();
                if ($admins<=1 && (int)$target['id']===(int)$u['id']) fail('Não é possível remover o último administrador ativo.');
            }
            if ((int)$target['id']===(int)$u['id'] && $status!=='active') fail('Não é possível desativar o próprio acesso.');
            $sql='UPDATE plenty_users SET name=?,email=?,phone=?,cargo=?,departamento=?,documento=?,notes=?,status=?,role=?';
            $params=[$name,$email,$phone,$cargo,$departamento,$documento,$notes,$status,$role];
            if (is_string($password) && $password!=='') {
                $sql.=',password_hash=?'; $params[]=password_hash($password,PASSWORD_DEFAULT);
            }
            $sql.=' WHERE id=?'; $params[]=$id;
            try { $q=$db->prepare($sql); $q->execute($params); }
            catch (PDOException $e) { if ($e->getCode()==='23000') fail('Este e-mail já está em uso.',409); throw $e; }
            audit($db,(int)$u['id'],'employee_update','id='.$id.' email='.$email);
        } else {
            if (!is_string($password) || $password==='') fail('Defina uma senha inicial de 10 a 72 bytes.');
            try {
                $q=$db->prepare('INSERT INTO plenty_users (name,email,password_hash,role,status,phone,cargo,departamento,documento,notes) VALUES (?,?,?,?,?,?,?,?,?,?)');
                $q->execute([$name,$email,password_hash($password,PASSWORD_DEFAULT),$role,$status,$phone,$cargo,$departamento,$documento,$notes]);
            } catch (PDOException $e) { if ($e->getCode()==='23000') fail('Este e-mail já está em uso.',409); throw $e; }
            $id=(int)$db->lastInsertId();
            audit($db,(int)$u['id'],'employee_create','id='.$id.' email='.$email);
        }
        $q=$db->prepare('SELECT id,name,email,role,status,phone,cargo,departamento,documento,notes,created_at,updated_at FROM plenty_users WHERE id=?');
        $q->execute([$id]);
        respond(['ok'=>true,'employee'=>employeePublic($q->fetch())]);
    }
    if (!in_array($action,['visit_save','visit_delete','catalog','import'],true)) fail('Ação desconhecida.',404);
    if ($action==='import') requireAdmin($u);
    $db->beginTransaction();
    $revision=revisionOf($db,true);
    if (!isset($body['revision']) || (int)$body['revision']!==$revision) {
        $db->rollBack(); fail('Outro usuário atualizou a base. Atualize o painel antes de tentar novamente.',409);
    }
    if ($action==='visit_save') {
        $raw=$body['visit']??null; if (!is_array($raw)) fail('Vistoria inválida.');
        $v=visitInput($raw); $id=textField($raw,'id',64);
        if ($id!=='') {
            $q=$db->prepare('SELECT id,os,foto FROM plenty_visits WHERE id=?'); $q->execute([$id]); $old=$q->fetch();
            if (!$old) { $db->rollBack(); fail('Vistoria não encontrada.',404); }
            $v['id']=$id; $v['os']=$old['os'];
            if (!array_key_exists('foto',$v)) { /* keep existing */ }
            elseif ($v['foto']==='') $v['foto']=null;
            visitUpdate($db,$v,(int)$u['id']);
            audit($db,(int)$u['id'],'visit_update',$id);
        } else {
            $v['id']='V'.strtoupper(bin2hex(random_bytes(8)));
            $v['os']=nextOs($db,$v['data']);
            if (!isset($v['foto'])) $v['foto']=null;
            visitInsert($db,$v,(int)$u['id']);
            audit($db,(int)$u['id'],'visit_create',$v['id']);
        }
        syncCatalogFromVisit($db,$v,(int)$u['id']);
    }
    if ($action==='visit_delete') {
        $id=textField($body,'id',64,true);
        $q=$db->prepare('DELETE FROM plenty_visits WHERE id=?'); $q->execute([$id]);
        audit($db,(int)$u['id'],'visit_delete',$id);
    }
    if ($action==='catalog') {
        $key=$body['kind']??''; if (!in_array($key,['obras','usuarios'],true)) fail('Cadastro inválido.');
        $value=textField($body,'value',190,true);
        if (($body['operation']??'')==='add') catalogAdd($db,$key,$value,(int)$u['id']);
        elseif (($body['operation']??'')==='remove') catalogRemove($db,$key,$value);
        else fail('Operação inválida.');
        audit($db,(int)$u['id'],'catalog_'.$body['operation'],$key.':'.$value);
    }
    if ($action==='import') {
        $items=$body['visits']??null;
        if (!is_array($items) || count($items)>2000) fail('Importação inválida ou acima de 2.000 registros.');
        $existing=$db->query('SELECT id FROM plenty_visits')->fetchAll(PDO::FETCH_COLUMN);
        $existing=array_fill_keys($existing,true);
        foreach ($items as $raw) {
            if (!is_array($raw)) fail('Registro inválido no backup.');
            $v=visitInput($raw);
            $id=textField($raw,'id',64,true); if (!preg_match('/^[A-Za-z0-9_-]+$/D',$id)) fail('Identificador inválido no backup.');
            if (isset($existing[$id])) continue;
            $v['id']=$id; $v['os']=textField($raw,'os',64,true);
            if (!isset($v['foto'])) $v['foto']=null;
            visitInsert($db,$v,(int)$u['id']);
            syncCatalogFromVisit($db,$v,(int)$u['id']);
            $existing[$id]=true;
        }
        audit($db,(int)$u['id'],'import','count='.count($items));
    }
    $newRev=bumpRevision($db);
    $db->commit();
    $snap=stateRead($db);
    respond(['ok'=>true,'state'=>$snap['state'],'revision'=>$newRev]);
} catch (Throwable $e) {
    if ($db instanceof PDO && $db->inTransaction()) $db->rollBack();
    error_log('Plenty API: '.$e->getMessage());
    if ($e instanceof PDOException && $e->getCode()==='42S02') fail('Importe private/schema.sql no banco pelo phpMyAdmin.',503);
    fail('Não foi possível concluir a operação. Verifique a configuração do banco e o registro de erros PHP na hospedagem.',503);
}
