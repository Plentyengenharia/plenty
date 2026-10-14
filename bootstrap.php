<?php
declare(strict_types=1);
if (!defined('PLENTY_BOOT')) { http_response_code(404); exit; }

function respond(array $data, int $status = 200): void {
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
    exit;
}
function fail(string $message, int $status = 400): void {
    respond(['ok'=>false, 'message'=>$message], $status);
}
function database(array $config): PDO {
    if ($config['db_password'] === 'PREENCHA_A_SENHA_DO_BANCO') {
        fail('Preencha a senha do banco em private/config.php.', 503);
    }
    $pdo = new PDO(
        'mysql:host='.$config['db_host'].';port='.$config['db_port'].';dbname='.$config['db_name'].';charset=utf8mb4',
        $config['db_user'], $config['db_password'],
        [PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC,
         PDO::ATTR_EMULATE_PREPARES=>false]
    );
    ensureSchema($pdo);
    return $pdo;
}
function tableExists(PDO $db, string $name): bool {
    $q=$db->prepare('SELECT 1 FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=?');
    $q->execute([$name]);
    return (bool)$q->fetchColumn();
}
function columnExists(PDO $db, string $table, string $column): bool {
    $q=$db->prepare('SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND COLUMN_NAME=?');
    $q->execute([$table,$column]);
    return (bool)$q->fetchColumn();
}
function ensureSchema(PDO $db): void {
    static $done=false;
    if ($done) return;
    $done=true;
    $sqlFile = __DIR__.'/schema.sql';
    if (is_file($sqlFile)) {
        $sql = file_get_contents($sqlFile);
        foreach (array_filter(array_map('trim', preg_split('/;\s*\n/', $sql))) as $stmt) {
            if ($stmt === '' || str_starts_with($stmt, '--')) continue;
            try { $db->exec($stmt); } catch (Throwable $e) { /* ignore race/dup */ }
        }
    }
    foreach ([
        'phone' => "ALTER TABLE plenty_users ADD COLUMN phone VARCHAR(40) NOT NULL DEFAULT ''",
        'cargo' => "ALTER TABLE plenty_users ADD COLUMN cargo VARCHAR(100) NOT NULL DEFAULT ''",
        'departamento' => "ALTER TABLE plenty_users ADD COLUMN departamento VARCHAR(100) NOT NULL DEFAULT ''",
        'documento' => "ALTER TABLE plenty_users ADD COLUMN documento VARCHAR(40) NOT NULL DEFAULT ''",
        'notes' => "ALTER TABLE plenty_users ADD COLUMN notes VARCHAR(500) NOT NULL DEFAULT ''",
        'updated_at' => "ALTER TABLE plenty_users ADD COLUMN updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP",
    ] as $col => $alter) {
        if (tableExists($db,'plenty_users') && !columnExists($db,'plenty_users',$col)) {
            try { $db->exec($alter); } catch (Throwable $e) { /* ignore */ }
        }
    }
    migrateLegacyState($db);
}
function migrateLegacyState(PDO $db): void {
    if (!tableExists($db,'plenty_visits') || !tableExists($db,'plenty_state')) return;
    $count=(int)$db->query('SELECT COUNT(*) FROM plenty_visits')->fetchColumn();
    if ($count > 0) return;
    $row=$db->query('SELECT payload FROM plenty_state WHERE id=1')->fetch();
    if (!$row) return;
    try { $state=json_decode($row['payload'], true, 128, JSON_THROW_ON_ERROR); }
    catch (Throwable $e) { return; }
    if (!is_array($state)) return;
    foreach (($state['settings']['obras'] ?? []) as $name) {
        $name=trim((string)$name); if ($name==='') continue;
        $q=$db->prepare('INSERT IGNORE INTO plenty_obras (name) VALUES (?)');
        $q->execute([$name]);
    }
    foreach (($state['settings']['usuarios'] ?? []) as $name) {
        $name=trim((string)$name); if ($name==='') continue;
        $q=$db->prepare('INSERT IGNORE INTO plenty_responsaveis (name) VALUES (?)');
        $q->execute([$name]);
    }
    foreach (($state['visits'] ?? []) as $raw) {
        if (!is_array($raw) || empty($raw['id'])) continue;
        try {
            $v=visitInput($raw);
            $v['id']=(string)$raw['id'];
            $v['os']=textField($raw,'os',64,true);
            if (!empty($raw['foto']) && is_string($raw['foto'])) $v['foto']=$raw['foto'];
            visitInsert($db,$v,null);
        } catch (Throwable $e) { /* skip bad legacy row */ }
    }
}
function input(): array {
    if ((int)($_SERVER['CONTENT_LENGTH'] ?? 0) > 24 * 1024 * 1024) fail('Envio muito grande.', 413);
    $raw = file_get_contents('php://input', false, null, 0, 24 * 1024 * 1024 + 1);
    if (strlen($raw) > 24 * 1024 * 1024) fail('Envio muito grande.', 413);
    try { $body=json_decode($raw, true, 128, JSON_THROW_ON_ERROR); }
    catch (JsonException $e) { fail('Conteúdo JSON inválido.'); }
    if (!is_array($body)) fail('Conteúdo inválido.');
    return $body;
}
function requirePost(): void {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') fail('Método não permitido.', 405);
    if (!str_starts_with(strtolower($_SERVER['CONTENT_TYPE'] ?? ''), 'application/json')) fail('Use JSON.', 415);
    if (!hash_equals($_SESSION['csrf'] ?? '', $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '')) {
        fail('Sua sessão mudou. Atualize a página e tente novamente.', 403);
    }
}
function clientIp(): string {
    return substr((string)($_SERVER['REMOTE_ADDR'] ?? ''), 0, 64);
}
function audit(PDO $db, ?int $userId, string $action, string $detail=''): void {
    if (!tableExists($db,'plenty_audit')) return;
    $q=$db->prepare('INSERT INTO plenty_audit (user_id,action,detail,ip) VALUES (?,?,?,?)');
    $q->execute([$userId,$action,substr($detail,0,500),clientIp()]);
}
function user(PDO $db): ?array {
    if (empty($_SESSION['uid']) || (int)($_SESSION['expires'] ?? 0) <= time()) {
        unset($_SESSION['uid'], $_SESSION['expires']); return null;
    }
    $cols='id,name,email,role,status,phone,cargo,departamento,documento,notes';
    if (!columnExists($db,'plenty_users','phone')) $cols='id,name,email,role,status';
    $q=$db->prepare("SELECT $cols FROM plenty_users WHERE id=?");
    $q->execute([$_SESSION['uid']]); $u=$q->fetch();
    if (!$u || $u['status'] !== 'active') { unset($_SESSION['uid'], $_SESSION['expires']); return null; }
    foreach (['phone','cargo','departamento','documento','notes'] as $k) if (!isset($u[$k])) $u[$k]='';
    return $u;
}
function requireUser(PDO $db): array {
    $u=user($db); if (!$u) fail('Sua sessão expirou. Entre novamente.',401); return $u;
}
function requireAdmin(array $u): void {
    if ($u['role'] !== 'admin') fail('Apenas o administrador pode realizar esta ação.',403);
}
function rateLimit(PDO $db, string $scope, int $max): void {
    $bucket=hash('sha256', $scope.'|'.clientIp());
    $now=time(); $window=$now-900;
    $q=$db->prepare('INSERT INTO plenty_rate_limits (bucket,attempts,window_start) VALUES (?,1,?)
        ON DUPLICATE KEY UPDATE attempts=IF(window_start < ?,1,attempts+1),
        window_start=IF(window_start < ?,VALUES(window_start),window_start)');
    $q->execute([$bucket,$now,$window,$window]);
    $q=$db->prepare('SELECT attempts FROM plenty_rate_limits WHERE bucket=?'); $q->execute([$bucket]);
    if ((int)$q->fetchColumn()>$max) { header('Retry-After: 900'); fail('Muitas tentativas. Aguarde 15 minutos.',429); }
    if (random_int(1,100)===1) $db->exec('DELETE FROM plenty_rate_limits WHERE window_start < '.($now-86400));
}
function textField(array $data, string $key, int $max=1000, bool $required=false): string {
    if (isset($data[$key]) && !is_string($data[$key]) && !is_numeric($data[$key])) fail('Campo inválido: '.$key);
    $value=trim((string)($data[$key] ?? ''));
    if (($required && $value==='') || strlen($value)>$max) fail('Verifique o campo: '.$key);
    return $value;
}
function validDate(string $value, bool $optional=false): bool {
    if ($optional && $value==='') return true;
    $date=DateTimeImmutable::createFromFormat('!Y-m-d',$value);
    return $date && $date->format('Y-m-d')===$value;
}
function visitInput(array $raw): array {
    $v=[];
    foreach (['obra','data','local','endereco','solicitante','tipo','responsavel','tecnico','objetivo',
      'situacao','elemento','anomalia','causa','origem','risco','prioridade','diagnostico','acao','prazo','status'] as $key) {
        $v[$key]=textField($raw,$key,10000,in_array($key,['obra','data','tipo','responsavel','status'],true));
    }
    if (!validDate($v['data']) || !validDate($v['prazo'],true)) fail('Data inválida.');
    $allowed=[
        'status'=>['Aberta','Em análise','Programada','Em execução','Aguardando validação','Concluída','Cancelada'],
        'tipo'=>['Vistoria técnica','Manutenção preventiva','Manutenção corretiva','Assistência técnica pós-obra','Atendimento a chamado'],
        'origem'=>['Endógena','Exógena','Natural','Funcional','A apurar'],
        'risco'=>['Crítico','Médio','Mínimo'], 'prioridade'=>['Alta','Média','Baixa']
    ];
    foreach ($allowed as $k=>$values) if (!in_array($v[$k],$values,true)) fail('Valor inválido: '.$k);
    if (isset($raw['foto'])) {
        if (!is_string($raw['foto']) || strlen($raw['foto'])>2800000) fail('A foto deve ter até 2 MB.');
        if ($raw['foto']!=='') {
            if (!preg_match('~^data:image/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$~D',$raw['foto'],$m)) fail('Use foto JPG, PNG ou WebP.');
            $bytes=base64_decode($m[2],true);
            $info=$bytes===false?false:@getimagesizefromstring($bytes);
            if (!$info || strlen($bytes)>2097152 || ($info['mime'] ?? '')!=='image/'.$m[1]) fail('Foto inválida ou maior que 2 MB.');
        }
        $v['foto']=$raw['foto'];
    }
    return $v;
}
function sortNames(array $a): array {
    $a=array_values(array_unique(array_filter(array_map(static fn($x)=>trim((string)$x), $a))));
    usort($a, static fn($x,$y)=>strcasecmp($x,$y));
    return $a;
}
function catalogList(PDO $db, string $kind): array {
    $table = $kind === 'obras' ? 'plenty_obras' : 'plenty_responsaveis';
    $rows=$db->query("SELECT name FROM $table ORDER BY name")->fetchAll();
    return array_map(static fn($r)=>(string)$r['name'], $rows);
}
function catalogAdd(PDO $db, string $kind, string $value, ?int $uid): void {
    $table = $kind === 'obras' ? 'plenty_obras' : 'plenty_responsaveis';
    $q=$db->prepare("INSERT IGNORE INTO $table (name, created_by) VALUES (?,?)");
    $q->execute([$value,$uid]);
}
function catalogRemove(PDO $db, string $kind, string $value): void {
    $table = $kind === 'obras' ? 'plenty_obras' : 'plenty_responsaveis';
    $q=$db->prepare("DELETE FROM $table WHERE name=?");
    $q->execute([$value]);
}
function visitRowToArray(array $row): array {
    $v=$row;
    if (($v['prazo'] ?? null) === null) $v['prazo']='';
    if (($v['foto'] ?? null) === null) unset($v['foto']);
    unset($v['created_by'],$v['updated_by'],$v['created_at'],$v['updated_at']);
    return $v;
}
function visitsList(PDO $db): array {
    $rows=$db->query('SELECT * FROM plenty_visits ORDER BY data DESC, os DESC')->fetchAll();
    return array_map('visitRowToArray', $rows);
}
function visitInsert(PDO $db, array $v, ?int $uid): void {
    $q=$db->prepare('INSERT INTO plenty_visits
      (id,os,obra,data,local,endereco,solicitante,tipo,responsavel,tecnico,objetivo,situacao,elemento,anomalia,causa,origem,risco,prioridade,diagnostico,acao,prazo,status,foto,created_by,updated_by)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)');
    $q->execute([
        $v['id'],$v['os'],$v['obra'],$v['data'],$v['local'],$v['endereco'],$v['solicitante'],$v['tipo'],$v['responsavel'],$v['tecnico'],
        $v['objetivo'],$v['situacao'],$v['elemento'],$v['anomalia'],$v['causa'],$v['origem'],$v['risco'],$v['prioridade'],
        $v['diagnostico'],$v['acao'],$v['prazo']!==''?$v['prazo']:null,$v['status'],$v['foto']??null,$uid,$uid
    ]);
}
function visitUpdate(PDO $db, array $v, ?int $uid): void {
    $sets='obra=?,data=?,local=?,endereco=?,solicitante=?,tipo=?,responsavel=?,tecnico=?,objetivo=?,situacao=?,elemento=?,anomalia=?,causa=?,origem=?,risco=?,prioridade=?,diagnostico=?,acao=?,prazo=?,status=?,updated_by=?';
    $params=[$v['obra'],$v['data'],$v['local'],$v['endereco'],$v['solicitante'],$v['tipo'],$v['responsavel'],$v['tecnico'],
        $v['objetivo'],$v['situacao'],$v['elemento'],$v['anomalia'],$v['causa'],$v['origem'],$v['risco'],$v['prioridade'],
        $v['diagnostico'],$v['acao'],$v['prazo']!==''?$v['prazo']:null,$v['status'],$uid];
    if (array_key_exists('foto',$v)) { $sets.=',foto=?'; $params[]=$v['foto']; }
    $params[]=$v['id'];
    $q=$db->prepare("UPDATE plenty_visits SET $sets WHERE id=?");
    $q->execute($params);
}
function nextOs(PDO $db, string $data): string {
    $prefix=str_replace('-','',$data);
    $q=$db->prepare('SELECT os FROM plenty_visits WHERE os LIKE ?');
    $q->execute([$prefix.'%']);
    $seq=0;
    foreach ($q->fetchAll() as $row) {
        if (preg_match('/^'.preg_quote($prefix,'/').'(\d{4})$/', (string)$row['os'], $m)) {
            $seq=max($seq,(int)$m[1]);
        }
    }
    return $prefix.str_pad((string)($seq+1),4,'0',STR_PAD_LEFT);
}
function bumpRevision(PDO $db): int {
    $db->exec('UPDATE plenty_state SET revision=revision+1, payload=payload WHERE id=1');
    return (int)$db->query('SELECT revision FROM plenty_state WHERE id=1')->fetchColumn();
}
function revisionOf(PDO $db, bool $lock=false): int {
    $row=$db->query('SELECT revision FROM plenty_state WHERE id=1'.($lock?' FOR UPDATE':''))->fetch();
    if (!$row) fail('Importe o arquivo private/schema.sql no phpMyAdmin.',503);
    return (int)$row['revision'];
}
function stateRead(PDO $db, bool $lock=false): array {
    $revision=revisionOf($db,$lock);
    return [
        'state'=>[
            'visits'=>visitsList($db),
            'settings'=>[
                'obras'=>catalogList($db,'obras'),
                'usuarios'=>catalogList($db,'usuarios'),
            ],
        ],
        'revision'=>$revision,
    ];
}
function syncCatalogFromVisit(PDO $db, array $v, ?int $uid): void {
    catalogAdd($db,'obras',$v['obra'],$uid);
    catalogAdd($db,'usuarios',$v['responsavel'],$uid);
}
function employeePublic(array $u): array {
    return [
        'id'=>(int)$u['id'],
        'name'=>$u['name'],
        'email'=>$u['email'],
        'role'=>$u['role'],
        'status'=>$u['status'],
        'phone'=>$u['phone']??'',
        'cargo'=>$u['cargo']??'',
        'departamento'=>$u['departamento']??'',
        'documento'=>$u['documento']??'',
        'notes'=>$u['notes']??'',
        'created_at'=>$u['created_at']??null,
        'updated_at'=>$u['updated_at']??null,
    ];
}
