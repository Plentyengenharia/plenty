/** Tela pública de autenticação — sem acesso ao código da aplicação. */
let csrf = '';
let registering = false;
let authBusy = false;
let setupRequired = false;
const el = (id) => document.getElementById(id);

function authMessage(message, success = false) {
  const box = el('authMessage');
  box.textContent = message;
  box.classList.toggle('success', success);
  box.hidden = !message;
}

async function api(action, body) {
  const options = { credentials: 'same-origin', cache: 'no-store', headers: { Accept: 'application/json' } };
  if (body !== undefined) {
    options.method = 'POST';
    options.headers['Content-Type'] = 'application/json';
    options.headers['X-CSRF-Token'] = csrf;
    options.body = JSON.stringify(body);
  }
  let response;
  try {
    response = await fetch('api.php?action=' + encodeURIComponent(action), options);
  } catch (e) {
    throw new Error('Sem conexão. Tente novamente.');
  }
  let data;
  try {
    data = await response.json();
  } catch (e) {
    throw new Error('O servidor não respondeu corretamente. Verifique se o PHP está ativo.');
  }
  if (!response.ok || !data.ok) throw new Error(data.message || 'Não foi possível concluir a operação.');
  if (data.csrf) csrf = data.csrf;
  return data;
}

function setAuthMode(value) {
  if (authBusy) return;
  registering = value;
  el('authForm').reset();
  authMessage('');
  const setup = setupRequired && value;
  el('authTitle').textContent = setup ? 'Configure o primeiro acesso' : value ? 'Crie sua conta' : 'Acesse sua conta';
  el('authSubtitle').textContent = setup
    ? 'Cadastre a conta que administrará os acessos da equipe.'
    : value
      ? 'Seu cadastro será enviado para aprovação do administrador.'
      : 'Entre para acompanhar suas vistorias e demandas.';
  for (const part of ['Name', 'Confirm']) {
    el('auth' + part + 'Field').hidden = !value;
    el('auth' + part).disabled = !value;
    el('auth' + part).required = value;
  }
  const extra = el('authExtraFields');
  extra.hidden = !value || setup;
  for (const id of ['authPhone', 'authCargo', 'authDepartamento']) {
    el(id).disabled = !value || setup;
  }
  el('setupField').hidden = !setup;
  el('setupKey').disabled = !setup;
  el('setupKey').required = setup;
  el('authPassword').minLength = 10;
  el('authPassword').maxLength = 72;
  el('authPassword').autocomplete = value ? 'new-password' : 'current-password';
  el('authPasswordHelp').hidden = !value;
  el('authSubmit').textContent = setup ? 'Criar administrador' : value ? 'Solicitar cadastro' : 'Entrar';
  el('authSwitchText').textContent = value ? 'Já tem uma conta?' : 'Ainda não tem uma conta?';
  el('authSwitch').textContent = value ? 'Entrar' : 'Cadastre-se';
  el('authPassword').type = 'password';
  el('togglePassword').textContent = 'Mostrar';
  el('togglePassword').setAttribute('aria-pressed', 'false');
}

async function loadSession() {
  try {
    const data = await api('session');
    setupRequired = data.setup_required;
    if (data.user) {
      location.replace('index.php');
      return;
    }
    setAuthMode(setupRequired);
  } catch (e) {
    authMessage(e.message);
  }
}

el('authSwitch').addEventListener('click', () => setAuthMode(!registering));
el('togglePassword').addEventListener('click', () => {
  const p = el('authPassword');
  const show = p.type === 'password';
  p.type = show ? 'text' : 'password';
  el('togglePassword').textContent = show ? 'Ocultar' : 'Mostrar';
  el('togglePassword').setAttribute('aria-label', show ? 'Ocultar senha' : 'Mostrar senha');
  el('togglePassword').setAttribute('aria-pressed', String(show));
});

el('authForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (authBusy) return;
  authMessage('');
  const body = {
    email: el('authEmail').value.trim(),
    password: el('authPassword').value,
    name: el('authName').value.trim(),
    setup_key: el('setupKey').value,
    phone: el('authPhone').value.trim(),
    cargo: el('authCargo').value.trim(),
    departamento: el('authDepartamento').value.trim(),
  };
  if (registering && body.password !== el('authConfirm').value) {
    authMessage('As senhas não coincidem.');
    return;
  }
  if (new TextEncoder().encode(body.password).length > 72) {
    authMessage('A senha é muito longa. Use no máximo 72 bytes.');
    return;
  }
  authBusy = true;
  el('authSubmit').disabled = true;
  el('authSwitch').disabled = true;
  try {
    const action = registering ? (setupRequired ? 'setup' : 'register') : 'login';
    const result = await api(action, body);
    if (registering) {
      setupRequired = false;
      authBusy = false;
      setAuthMode(false);
      el('authEmail').value = body.email;
      authMessage(result.message, true);
    } else {
      location.replace('index.php');
    }
  } catch (error) {
    authMessage(error.message);
  } finally {
    authBusy = false;
    el('authSubmit').disabled = false;
    el('authSwitch').disabled = false;
  }
});

void loadSession();
