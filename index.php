<?php
declare(strict_types=1);
/**
 * Única entrada pública do sistema.
 * Sem sessão ativa: só a tela de login.
 * Com sessão: entrega a interface da aplicação (private/ui.html).
 * HTML/JS da aplicação não ficam acessíveis diretamente.
 */
define('PLENTY_BOOT', true);
ini_set('display_errors', '0');

$https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || (int)($_SERVER['SERVER_PORT'] ?? 0) === 443;
ini_set('session.use_strict_mode', '1');
ini_set('session.use_only_cookies', '1');
ini_set('session.cookie_httponly', '1');
session_name('PLENTY_SESSION');
session_set_cookie_params(['lifetime' => 0, 'path' => '/', 'secure' => $https, 'httponly' => true, 'samesite' => 'Strict']);
session_start();

$authed = false;
if (!empty($_SESSION['uid']) && (int)($_SESSION['expires'] ?? 0) > time()) {
    $bootFile = __DIR__.'/private/bootstrap.php';
    $cfgFile = __DIR__.'/private/config.php';
    if (is_file($bootFile) && is_file($cfgFile)) {
        try {
            require $bootFile;
            $config = require $cfgFile;
            if (($config['db_password'] ?? '') === 'PREENCHA_A_SENHA_DO_BANCO') {
                throw new RuntimeException('db not configured');
            }
            $db = database($config);
            $authed = user($db) !== null;
        } catch (Throwable $e) {
            // Sem banco válido não entrega a aplicação (evita vazar UI)
            $authed = false;
            unset($_SESSION['uid'], $_SESSION['expires']);
        }
    } else {
        unset($_SESSION['uid'], $_SESSION['expires']);
    }
} else {
    unset($_SESSION['uid'], $_SESSION['expires']);
}

$file = $authed ? __DIR__.'/private/ui.html' : __DIR__.'/private/login.html';
if (!is_file($file)) {
    http_response_code(503);
    header('Content-Type: text/plain; charset=utf-8');
    echo 'Arquivos da interface ausentes. Reenvie a pasta private/ do ZIP.';
    exit;
}

header('Content-Type: text/html; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate');
header('Pragma: no-cache');
header('X-Robots-Tag: noindex, nofollow, noarchive');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header('Referrer-Policy: same-origin');
header('Permissions-Policy: geolocation=(), microphone=(), camera=()');
header("Content-Security-Policy: default-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'");
readfile($file);
