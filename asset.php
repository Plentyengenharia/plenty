<?php
declare(strict_types=1);
/**
 * Entrega assets protegidos (app.js) somente com sessão autenticada.
 * Logo e auth.js podem ser públicos para a tela de login.
 */
define('PLENTY_BOOT', true);
ini_set('display_errors', '0');

$name = basename((string)($_GET['f'] ?? ''));
$public = [
    'plenty-logo.jpg' => ['path' => __DIR__.'/plenty-logo.jpg', 'type' => 'image/jpeg', 'auth' => false],
    'auth.js' => ['path' => __DIR__.'/private/auth.js', 'type' => 'application/javascript; charset=utf-8', 'auth' => false],
    'apple-touch-icon.png' => ['path' => __DIR__.'/private/apple-touch-icon.png', 'type' => 'image/png', 'auth' => false],
    'apple-touch-icon-180.png' => ['path' => __DIR__.'/private/apple-touch-icon-180.png', 'type' => 'image/png', 'auth' => false],
    'apple-touch-icon-192.png' => ['path' => __DIR__.'/private/apple-touch-icon-192.png', 'type' => 'image/png', 'auth' => false],
    'apple-touch-icon-512.png' => ['path' => __DIR__.'/private/apple-touch-icon-512.png', 'type' => 'image/png', 'auth' => false],
    'icon.svg' => ['path' => __DIR__.'/private/icon.svg', 'type' => 'image/svg+xml', 'auth' => false],
    'site.webmanifest' => ['path' => __DIR__.'/private/site.webmanifest', 'type' => 'application/manifest+json', 'auth' => false],
];
$protected = [
    'app.js' => ['path' => __DIR__.'/private/app.js', 'type' => 'application/javascript; charset=utf-8', 'auth' => true],
];
$map = $public + $protected;
if (!isset($map[$name]) || !is_file($map[$name]['path'])) {
    http_response_code(404);
    exit;
}
// Ícones de atalho podem ser cacheados no aparelho
$cacheable = str_starts_with($name, 'apple-touch-icon') || $name === 'icon.svg' || $name === 'plenty-logo.jpg' || $name === 'site.webmanifest';

$https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || (int)($_SERVER['SERVER_PORT'] ?? 0) === 443;
session_name('PLENTY_SESSION');
session_set_cookie_params(['lifetime'=>0,'path'=>'/','secure'=>$https,'httponly'=>true,'samesite'=>'Strict']);
session_start();

if ($map[$name]['auth']) {
    $ok = !empty($_SESSION['uid']) && (int)($_SESSION['expires'] ?? 0) > time();
    if (!$ok) {
        http_response_code(401);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(['ok'=>false,'message'=>'Faça login para acessar o sistema.']);
        exit;
    }
}

header('Content-Type: '.$map[$name]['type']);
header('X-Content-Type-Options: nosniff');
header('Cache-Control: '.($cacheable ? 'public, max-age=604800' : 'no-store'));
header('X-Frame-Options: DENY');
header('X-Robots-Tag: noindex, nofollow, noarchive');
header('Referrer-Policy: same-origin');
readfile($map[$name]['path']);
