# Plenty Engenharia — Gestão de Vistorias

Sistema PHP + MySQL para gestão de vistorias, com central de módulos, cadastro de funcionários e acesso restrito.

## Instalação (Hostinger / public_html)

1. Envie os arquivos deste repositório para a raiz do `public_html`.
2. No phpMyAdmin, importe `private/schema.sql`.
3. Edite `private/config.php` e preencha a senha do banco (`PREENCHA_A_SENHA_DO_BANCO`).
4. Abra o site, use a `setup_key` do `config.php` e crie o administrador.
5. Faça login e use a **Central de Módulos** → **Vistorias**.

## Requisitos

- PHP 8.2+
- PDO MySQL
- HTTPS

## Teste local

```bash
node mock-server.mjs
```

Abra `http://127.0.0.1:8787`  
Login demo: `admin@plenty.local` / `plentyadmin1`

## Estrutura

- `index.php` — entrada segura (login ou app)
- `api.php` — API PHP/MySQL
- `asset.php` — entrega de assets com controle de sessão
- `private/` — código e UI protegidos (não públicos)
