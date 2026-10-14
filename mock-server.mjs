/**
 * API local de desenvolvimento — espelha api.php para testar login e ferramentas
 * sem MySQL/PHP. Uso: node mock-server.mjs
 *
 * Conta demo (já ativa):
 *   e-mail: admin@plenty.local
 *   senha:  plentyadmin1
 */
import http from 'node:http'
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import { readFileSync, existsSync, statSync } from 'node:fs'
import { extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('.', import.meta.url))
const PORT = Number(process.env.PORT || 8787)
const SETUP_KEY = 'dev-setup-key-plenty'

function hashPassword(password, salt = randomBytes(16).toString('hex')) {
  const hash = scryptSync(password, salt, 32).toString('hex')
  return `${salt}:${hash}`
}
function verifyPassword(password, stored) {
  const [salt, hash] = String(stored).split(':')
  if (!salt || !hash) return false
  const next = scryptSync(password, salt, 32)
  const prev = Buffer.from(hash, 'hex')
  return prev.length === next.length && timingSafeEqual(prev, next)
}

const db = {
  users: [
    {
      id: 1,
      name: 'Admin Plenty',
      email: 'admin@plenty.local',
      password_hash: hashPassword('plentyadmin1'),
      role: 'admin',
      status: 'active',
      phone: '',
      cargo: 'Administrador',
      departamento: 'Engenharia',
      documento: '',
      notes: '',
      created_at: new Date().toISOString(),
      updated_at: null,
    },
  ],
  state: { visits: [], settings: { obras: ['Residencial Aurora'], usuarios: ['Eng. Ana'] } },
  revision: 0,
  rate: new Map(),
}

const sessions = new Map()

function json(res, status, data) {
  const body = JSON.stringify(data)
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  })
  res.end(body)
}
function fail(res, message, status = 400) {
  json(res, status, { ok: false, message })
}
function parseCookies(req) {
  const out = {}
  for (const part of String(req.headers.cookie || '').split(';')) {
    const [k, ...rest] = part.trim().split('=')
    if (k) out[k] = decodeURIComponent(rest.join('='))
  }
  return out
}
function getSession(req) {
  const id = parseCookies(req).PLENTY_SESSION
  if (!id || !sessions.has(id)) return null
  const s = sessions.get(id)
  if (s.expires <= Date.now()) {
    sessions.delete(id)
    return null
  }
  return s
}
function setSessionCookie(res, id) {
  res.setHeader(
    'Set-Cookie',
    `PLENTY_SESSION=${encodeURIComponent(id)}; Path=/; HttpOnly; SameSite=Lax`,
  )
}
function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', 'PLENTY_SESSION=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax')
}
function publicUser(u) {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    status: u.status,
    phone: u.phone || '',
    cargo: u.cargo || '',
    departamento: u.departamento || '',
    documento: u.documento || '',
    notes: u.notes || '',
    created_at: u.created_at || null,
    updated_at: u.updated_at || null,
  }
}
function employeePublic(u) {
  return publicUser(u)
}
function requireUser(req, res) {
  const s = getSession(req)
  if (!s) {
    fail(res, 'Sua sessão expirou. Entre novamente.', 401)
    return null
  }
  const u = db.users.find((x) => x.id === s.uid && x.status === 'active')
  if (!u) {
    fail(res, 'Sua sessão expirou. Entre novamente.', 401)
    return null
  }
  return { session: s, user: u }
}
async function readBody(req) {
  const chunks = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.length
    if (size > 24 * 1024 * 1024) throw new Error('Envio muito grande.')
    chunks.push(chunk)
  }
  if (!chunks.length) return {}
  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}
function textField(data, key, max = 1000, required = false) {
  const value = String(data[key] ?? '').trim()
  if ((required && !value) || value.length > max) throw new Error('Verifique o campo: ' + key)
  return value
}
function visitInput(raw) {
  const keys = [
    'obra',
    'data',
    'local',
    'endereco',
    'solicitante',
    'tipo',
    'responsavel',
    'tecnico',
    'objetivo',
    'situacao',
    'elemento',
    'anomalia',
    'causa',
    'origem',
    'risco',
    'prioridade',
    'diagnostico',
    'acao',
    'prazo',
    'status',
  ]
  const v = {}
  for (const key of keys) {
    v[key] = textField(raw, key, 10000, ['obra', 'data', 'tipo', 'responsavel', 'status'].includes(key))
  }
  if (raw.foto) v.foto = String(raw.foto)
  return v
}
function mime(path) {
  return (
    {
      '.html': 'text/html; charset=utf-8',
      '.js': 'text/javascript; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.webp': 'image/webp',
      '.txt': 'text/plain; charset=utf-8',
      '.sql': 'text/plain; charset=utf-8',
      '.json': 'application/json; charset=utf-8',
    }[extname(path)] || 'application/octet-stream'
  )
}
function serveAsset(req, res, url) {
  const name = String(url.searchParams.get('f') || '')
  const map = {
    'plenty-logo.jpg': { path: join(root, 'plenty-logo.jpg'), type: 'image/jpeg', auth: false },
    'auth.js': { path: join(root, 'private', 'auth.js'), type: 'text/javascript; charset=utf-8', auth: false },
    'app.js': { path: join(root, 'private', 'app.js'), type: 'text/javascript; charset=utf-8', auth: true },
    'apple-touch-icon.png': { path: join(root, 'private', 'apple-touch-icon.png'), type: 'image/png', auth: false },
    'apple-touch-icon-180.png': { path: join(root, 'private', 'apple-touch-icon-180.png'), type: 'image/png', auth: false },
    'apple-touch-icon-192.png': { path: join(root, 'private', 'apple-touch-icon-192.png'), type: 'image/png', auth: false },
    'apple-touch-icon-512.png': { path: join(root, 'private', 'apple-touch-icon-512.png'), type: 'image/png', auth: false },
    'icon.svg': { path: join(root, 'private', 'icon.svg'), type: 'image/svg+xml', auth: false },
    'site.webmanifest': { path: join(root, 'private', 'site.webmanifest'), type: 'application/manifest+json', auth: false },
  }
  const item = map[name]
  if (!item || !existsSync(item.path)) {
    res.writeHead(404)
    res.end('Not found')
    return
  }
  if (item.auth) {
    const s = getSession(req)
    const u = s?.uid ? db.users.find((x) => x.id === s.uid && x.status === 'active') : null
    if (!u) {
      return json(res, 401, { ok: false, message: 'Faça login para acessar o sistema.' })
    }
  }
  res.writeHead(200, { 'Content-Type': item.type, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' })
  res.end(readFileSync(item.path))
}

function serveIndex(req, res) {
  const s = getSession(req)
  const u = s?.uid ? db.users.find((x) => x.id === s.uid && x.status === 'active') : null
  const file = join(root, 'private', u ? 'ui.html' : 'login.html')
  res.writeHead(200, {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Robots-Tag': 'noindex, nofollow',
  })
  res.end(readFileSync(file))
}

function serveStatic(req, res, urlPath) {
  let rel = decodeURIComponent(urlPath.split('?')[0])
  if (rel === '/' || rel === '/index.php' || rel === '/index.html') {
    return serveIndex(req, res)
  }
  if (rel.startsWith('/private') || rel === '/app.js' || rel === '/index.html') {
    res.writeHead(403)
    res.end('Forbidden')
    return
  }
  const denied = /\.(sql|log|bak|env|md|zip)$/i.test(rel) || /LEIA-ME|mock-server|composer\./i.test(rel)
  if (denied) {
    res.writeHead(403)
    res.end('Forbidden')
    return
  }
  const file = normalize(join(root, rel.replace(/^\/+/, '')))
  if (!file.startsWith(root) || !existsSync(file) || !statSync(file).isFile()) {
    res.writeHead(404)
    res.end('Not found')
    return
  }
  res.writeHead(200, { 'Content-Type': mime(file), 'Cache-Control': 'no-store' })
  res.end(readFileSync(file))
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`)
  try {
    if (url.pathname === '/asset.php') {
      return serveAsset(req, res, url)
    }
    if (url.pathname === '/api.php') {
      const action = url.searchParams.get('action') || 'session'
      if (action === 'session' && req.method === 'GET') {
        let s = getSession(req)
        if (!s) {
          const id = randomBytes(24).toString('hex')
          s = { uid: null, csrf: randomBytes(16).toString('hex'), expires: Date.now() + 8 * 3600 * 1000 }
          sessions.set(id, s)
          setSessionCookie(res, id)
        }
        const u = s.uid ? db.users.find((x) => x.id === s.uid && x.status === 'active') : null
        return json(res, 200, {
          ok: true,
          user: u ? publicUser(u) : null,
          csrf: s.csrf,
          setup_required: db.users.length === 0,
        })
      }

      let body = {}
      if (req.method === 'POST') {
        body = await readBody(req)
        const s = getSession(req)
        if (!s || (req.headers['x-csrf-token'] || '') !== s.csrf) {
          return fail(res, 'Sua sessão mudou. Atualize a página e tente novamente.', 403)
        }
      }

      if (['setup', 'register', 'login'].includes(action)) {
        const email = String(body.email || '')
          .trim()
          .toLowerCase()
        const password = String(body.password || '')
        if (!email.includes('@')) return fail(res, 'Informe um e-mail válido.')
        if (password.length < 10 || password.length > 72) return fail(res, 'Use uma senha de 10 a 72 bytes.')

        if (action === 'login') {
          const u = db.users.find((x) => x.email === email)
          if (!u || !verifyPassword(password, u.password_hash)) return fail(res, 'E-mail ou senha incorretos.', 401)
          if (u.status !== 'active') {
            return fail(res, 'Seu cadastro aguarda aprovação ou está desativado. Fale com o administrador.', 403)
          }
          const sid = parseCookies(req).PLENTY_SESSION
          const csrf = randomBytes(16).toString('hex')
          sessions.set(sid, { uid: u.id, csrf, expires: Date.now() + 8 * 3600 * 1000 })
          setSessionCookie(res, sid)
          return json(res, 200, { ok: true, user: publicUser(u), csrf })
        }

        const name = String(body.name || '').trim()
        if (name.length < 2) return fail(res, 'Informe seu nome.')

        if (action === 'setup') {
          if (body.setup_key !== SETUP_KEY) return fail(res, 'Chave de instalação incorreta.', 403)
          if (db.users.length) return fail(res, 'A instalação já foi concluída.', 409)
          db.users.push({
            id: 1,
            name,
            email,
            password_hash: hashPassword(password),
            role: 'admin',
            status: 'active',
          })
          return json(res, 200, { ok: true, message: 'Administrador criado. Entre com seu e-mail e senha.' })
        }

        if (!db.users.length) return fail(res, 'O administrador precisa concluir a instalação primeiro.', 409)
        if (db.users.some((x) => x.email === email)) return fail(res, 'Este e-mail já possui cadastro.', 409)
        db.users.push({
          id: db.users.reduce((m, u) => Math.max(m, u.id), 0) + 1,
          name,
          email,
          password_hash: hashPassword(password),
          role: 'member',
          status: 'pending',
          phone: String(body.phone || '').trim(),
          cargo: String(body.cargo || '').trim(),
          departamento: String(body.departamento || '').trim(),
          documento: '',
          notes: '',
          created_at: new Date().toISOString(),
          updated_at: null,
        })
        return json(res, 200, { ok: true, message: 'Cadastro recebido. Aguarde a aprovação do administrador.' })
      }

      const auth = requireUser(req, res)
      if (!auth) return
      const { session, user } = auth

      if (action === 'state' && req.method === 'GET') {
        return json(res, 200, { ok: true, state: db.state, revision: db.revision })
      }
      if ((action === 'users' || action === 'employees') && req.method === 'GET') {
        if (user.role !== 'admin') return fail(res, 'Apenas o administrador pode realizar esta ação.', 403)
        const list = db.users.map(employeePublic)
        return json(res, 200, action === 'employees' ? { ok: true, employees: list } : { ok: true, users: list })
      }

      if (action === 'logout') {
        sessions.delete(parseCookies(req).PLENTY_SESSION)
        clearSessionCookie(res)
        return json(res, 200, { ok: true })
      }
      if (action === 'user_status') {
        if (user.role !== 'admin') return fail(res, 'Apenas o administrador pode realizar esta ação.', 403)
        const id = Number(body.id)
        const target = db.users.find((x) => x.id === id && x.role !== 'admin')
        if (!target || id === user.id) return fail(res, 'Não é possível alterar seu próprio acesso.')
        if (!['active', 'disabled', 'pending'].includes(body.status)) return fail(res, 'Status inválido.')
        target.status = body.status
        target.updated_at = new Date().toISOString()
        return json(res, 200, { ok: true })
      }
      if (action === 'employee_save') {
        if (user.role !== 'admin') return fail(res, 'Apenas o administrador pode realizar esta ação.', 403)
        const id = body.id ? Number(body.id) : null
        const name = String(body.name || '').trim()
        const email = String(body.email || '')
          .trim()
          .toLowerCase()
        if (name.length < 2) return fail(res, 'Informe o nome completo.')
        if (!email.includes('@')) return fail(res, 'Informe um e-mail válido.')
        const status = String(body.status || '')
        const role = String(body.role || '')
        if (!['active', 'pending', 'disabled'].includes(status)) return fail(res, 'Status inválido.')
        if (!['member', 'admin'].includes(role)) return fail(res, 'Perfil inválido.')
        const password = body.password || ''
        if (password !== '' && (String(password).length < 10 || String(password).length > 72)) {
          return fail(res, 'Use uma senha de 10 a 72 bytes, ou deixe em branco para manter.')
        }
        if (db.users.some((x) => x.email === email && x.id !== id)) return fail(res, 'Este e-mail já está em uso.', 409)
        let target
        if (id) {
          target = db.users.find((x) => x.id === id)
          if (!target) return fail(res, 'Funcionário não encontrado.', 404)
          if (target.id === user.id && status !== 'active') return fail(res, 'Não é possível desativar o próprio acesso.')
          Object.assign(target, {
            name,
            email,
            phone: String(body.phone || '').trim(),
            cargo: String(body.cargo || '').trim(),
            departamento: String(body.departamento || '').trim(),
            documento: String(body.documento || '').trim(),
            notes: String(body.notes || '').trim(),
            status,
            role,
            updated_at: new Date().toISOString(),
          })
          if (password) target.password_hash = hashPassword(String(password))
        } else {
          if (!password) return fail(res, 'Defina uma senha inicial de 10 a 72 bytes.')
          target = {
            id: db.users.reduce((m, u) => Math.max(m, u.id), 0) + 1,
            name,
            email,
            password_hash: hashPassword(String(password)),
            role,
            status,
            phone: String(body.phone || '').trim(),
            cargo: String(body.cargo || '').trim(),
            departamento: String(body.departamento || '').trim(),
            documento: String(body.documento || '').trim(),
            notes: String(body.notes || '').trim(),
            created_at: new Date().toISOString(),
            updated_at: null,
          }
          db.users.push(target)
        }
        return json(res, 200, { ok: true, employee: employeePublic(target) })
      }

      if (!['visit_save', 'visit_delete', 'catalog', 'import'].includes(action)) {
        return fail(res, 'Ação desconhecida.', 404)
      }
      if (action === 'import' && user.role !== 'admin') {
        return fail(res, 'Apenas o administrador pode realizar esta ação.', 403)
      }
      if (Number(body.revision) !== db.revision) {
        return fail(res, 'Outro usuário atualizou a base. Atualize o painel antes de tentar novamente.', 409)
      }

      const state = structuredClone(db.state)
      if (action === 'visit_save') {
        const raw = body.visit
        if (!raw || typeof raw !== 'object') return fail(res, 'Vistoria inválida.')
        let v = visitInput(raw)
        const id = String(raw.id || '')
        if (id) {
          const idx = state.visits.findIndex((x) => x.id === id)
          if (idx < 0) return fail(res, 'Vistoria não encontrada.', 404)
          v = { ...state.visits[idx], ...v }
          state.visits[idx] = v
        } else {
          v.id = 'V' + randomBytes(8).toString('hex').toUpperCase()
          const prefix = v.data.replaceAll('-', '')
          let seq = 0
          for (const old of state.visits) {
            const m = String(old.os || '').match(new RegExp('^' + prefix + '(\\d+)$'))
            if (m) seq = Math.max(seq, Number(m[1]))
          }
          v.os = prefix + String(seq + 1).padStart(4, '0')
          state.visits.unshift(v)
        }
        for (const [key, field] of [
          ['obras', 'obra'],
          ['usuarios', 'responsavel'],
        ]) {
          if (!state.settings[key].includes(v[field])) state.settings[key].push(v[field])
        }
      }
      if (action === 'visit_delete') {
        const id = textField(body, 'id', 64, true)
        state.visits = state.visits.filter((v) => v.id !== id)
      }
      if (action === 'catalog') {
        const key = body.kind
        if (!['obras', 'usuarios'].includes(key)) return fail(res, 'Cadastro inválido.')
        const value = textField(body, 'value', 1000, true)
        if (body.operation === 'add') {
          if (!state.settings[key].includes(value)) state.settings[key].push(value)
        } else if (body.operation === 'remove') {
          state.settings[key] = state.settings[key].filter((x) => x !== value)
        } else return fail(res, 'Operação inválida.')
      }
      if (action === 'import') {
        const items = body.visits
        if (!Array.isArray(items) || items.length > 2000) return fail(res, 'Importação inválida ou acima de 2.000 registros.')
        for (const raw of items) {
          const v = visitInput(raw)
          const id = textField(raw, 'id', 64, true)
          if (state.visits.some((x) => x.id === id)) continue
          v.id = id
          v.os = textField(raw, 'os', 64, true)
          state.visits.push(v)
        }
      }

      db.state = state
      db.revision += 1
      session.csrf = randomBytes(16).toString('hex')
      return json(res, 200, { ok: true, state: db.state, revision: db.revision, csrf: session.csrf })
    }

    return serveStatic(req, res, url.pathname)
  } catch (e) {
    console.error(e)
    return fail(res, e.message || 'Erro interno', 500)
  }
})

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Plenty mock em http://127.0.0.1:${PORT}`)
  console.log('Login demo: admin@plenty.local / plentyadmin1')
  console.log('setup_key (se zerar users):', SETUP_KEY)
})
