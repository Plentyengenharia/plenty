
let visits=[],settings={obras:[],usuarios:[]},currentPage='dashboard',activeModule=null;
/** Catálogo da central — só Vistorias abre o app existente; os demais ficam preparados. */
const SYSTEM_MODULES=[
  {id:'vistorias',title:'Vistorias',desc:'Demandas, visitas técnicas, relatórios e cadastros.',status:'live',icon:'clip'},
  {id:'obras',title:'Obras',desc:'Empreendimentos, etapas e acompanhamento de canteiro.',status:'soon',icon:'building'},
  {id:'engenharia',title:'Engenharia',desc:'Projetos, memoriais, revisões e compatibilização.',status:'soon',icon:'compass'},
  {id:'pedidos',title:'Pedidos',desc:'Solicitações internas de materiais e serviços.',status:'soon',icon:'list'},
  {id:'compras',title:'Compras',desc:'Cotações, fornecedores e ordens de compra.',status:'soon',icon:'cart'},
  {id:'financeiro',title:'Financeiro',desc:'Contas, fluxo de caixa e medições.',status:'soon',icon:'ledger'},
  {id:'administrativo',title:'Administrativo',desc:'Contratos, documentos e rotinas de escritório.',status:'soon',icon:'folder'},
  {id:'qualidade',title:'Qualidade',desc:'Não conformidades, checklists e assistência técnica.',status:'soon',icon:'shield'},
  {id:'rh',title:'Pessoas',desc:'Equipe, cargos e acessos (ligado ao cadastro de usuários).',status:'soon',icon:'people'},
  {id:'planejamento',title:'Planejamento',desc:'Cronogramas, avanços físicos e marcos de obra.',status:'soon',icon:'calendar'},
];
const MODULE_ICONS={
  clip:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 7h8M8 11h8M8 15h5"/><rect x="4.5" y="3.5" width="15" height="17" rx="2"/></svg>',
  building:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h16M6 20V6l6-2 6 2v14"/><path d="M10 10h1M13 10h1M10 14h1M13 14h1"/></svg>',
  compass:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="m14.5 9.5-1.8 4.7-4.7 1.8 1.8-4.7z"/></svg>',
  list:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 7h10M9 12h10M9 17h10"/><circle cx="5" cy="7" r="1"/><circle cx="5" cy="12" r="1"/><circle cx="5" cy="17" r="1"/></svg>',
  cart:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 5h2l1.2 9.5h10.6L19.5 8H7"/><circle cx="9" cy="19" r="1.2"/><circle cx="16" cy="19" r="1.2"/></svg>',
  ledger:'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4.5" y="3.5" width="15" height="17" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/></svg>',
  folder:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 8.5V7a2 2 0 0 1 2-2h4l2 2h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z"/></svg>',
  shield:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.5 5 6.5v5.2c0 4.2 2.8 7.2 7 8.8 4.2-1.6 7-4.6 7-8.8V6.5z"/><path d="m9.5 12 1.8 1.8 3.7-3.8"/></svg>',
  people:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="9" r="2.5"/><path d="M4.5 18c.5-2.5 2.4-4 4.5-4s4 1.5 4.5 4"/><circle cx="16.5" cy="9.5" r="2"/><path d="M15 14.2c1.7.3 3 1.5 3.5 3.8"/></svg>',
  calendar:'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="5" width="16" height="15" rx="2"/><path d="M8 3.5v3M16 3.5v3M4 9.5h16"/></svg>',
};
function moduleIcon(name){return MODULE_ICONS[name]||MODULE_ICONS.clip}
function showModuleSoon(title){
  const banner=document.getElementById('moduleSoonBanner');
  if(!banner)return;
  banner.textContent=title+' estará disponível em breve.';
  banner.classList.add('open');
}
function hideModuleSoon(){
  const banner=document.getElementById('moduleSoonBanner');
  if(!banner)return;
  banner.classList.remove('open');
  banner.textContent='';
}
function renderModuleHome(){
  const grid=document.getElementById('moduleGrid');
  if(!grid)return;
  grid.innerHTML=SYSTEM_MODULES.map(m=>{
    const live=m.status==='live';
    return '<button type="button" class="module-tile'+(live?'':' is-soon')+'" data-module="'+m.id+'" aria-label="'+esc(m.title)+(live?'':' (em breve)')+'">'+
      '<span class="module-ico" aria-hidden="true">'+moduleIcon(m.icon)+'</span>'+
      '<span class="module-copy"><strong>'+esc(m.title)+'</strong><em>'+esc(m.desc)+'</em></span>'+
      '<span class="module-badge '+(live?'live':'soon')+'">'+(live?'DISPONÍVEL':'EM BREVE')+'</span>'+
      '</button>';
  }).join('');
}
function showModuleHome(){
  activeModule=null;
  hideModuleSoon();
  closeSidebar();
  closeModal();
  closeEmployeeModal();
  document.body.classList.add('module-home-open');
  const home=document.getElementById('moduleHome');
  if(home)home.classList.add('open');
  document.querySelectorAll('.nav button').forEach(b=>b.classList.remove('active'));
  const modulesBtn=document.querySelector('.nav button[data-page="modules"]');
  if(modulesBtn)modulesBtn.classList.add('active');
}
function openModule(id){
  const mod=SYSTEM_MODULES.find(m=>m.id===id);
  if(!mod)return;
  if(mod.status!=='live'){showModuleSoon(mod.title);return;}
  hideModuleSoon();
  activeModule=id;
  document.body.classList.remove('module-home-open');
  const home=document.getElementById('moduleHome');
  if(home)home.classList.remove('open');
  if(id==='vistorias'){
    currentPage='dashboard';
    showPage('dashboard');
  }
}
function sortNames(a){return Array.from(new Set((a||[]).map(x=>String(x).trim()).filter(Boolean))).sort((x,y)=>x.localeCompare(y,'pt-BR',{sensitivity:'base'}))}
function fillLists(){let o=document.getElementById('obrasList'),u=document.getElementById('usuariosList');settings.obras=sortNames(settings.obras);settings.usuarios=sortNames(settings.usuarios);if(o)o.innerHTML=settings.obras.map(x=>'<option value="'+esc(x)+'"></option>').join('');if(u)u.innerHTML=settings.usuarios.map(x=>'<option value="'+esc(x)+'"></option>').join('')}
/** Prévia da numeração automática de chamado/OS: AAAAMMDD#### (confirmada no servidor ao salvar). */
function osForDate(d){
  const b=String(d||'').replace(/-/g,'');
  if(!/^\d{8}$/.test(b))return '';
  let seq=0;
  for(const x of visits){
    const os=String(x.os||'');
    if(os.length===12&&os.startsWith(b)){
      const n=parseInt(os.slice(8),10);
      if(Number.isFinite(n))seq=Math.max(seq,n);
    }
  }
  return b+String(seq+1).padStart(4,'0');
}
function refreshOsPreview(){
  const editId=authEl('editId')?.value;
  const osEl=authEl('os');
  const dataEl=authEl('data');
  if(!osEl||!dataEl)return;
  if(editId){
    const v=visits.find(x=>x.id===editId);
    osEl.value=v?.os||'';
    return;
  }
  osEl.value=osForDate(dataEl.value)||'Será gerada ao salvar';
}
function dateBR(v){if(!v)return'Não informado';let p=v.split('-');return p[2]+'/'+p[1]+'/'+p[0]}
function esc(v){return String(v||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]))}
function tag(v){let c='gray';if(v==='Concluída'||v==='Programada')c='green';if(v==='Em análise'||v==='Aguardando validação'||v==='Média')c='yellow';if(v==='Crítico'||v==='Alta'||v==='Aberta')c='red';if(v==='Em execução'||v==='Vistoria técnica')c='blue';return'<span class="tag '+c+'">'+esc(v)+'</span>'}
function setSidebarOpen(open){
  const sidebar=document.getElementById('sidebar');
  const backdrop=document.getElementById('sidebarBackdrop');
  const toggle=document.getElementById('menuToggle');
  if(!sidebar)return;
  sidebar.classList.toggle('open',open);
  if(backdrop)backdrop.classList.toggle('open',open);
  if(toggle)toggle.setAttribute('aria-expanded',String(open));
  document.body.style.overflow=open&&window.matchMedia('(max-width:900px)').matches?'hidden':'';
}
function closeSidebar(){setSidebarOpen(false)}
function showPage(p,el){
  currentPage=p;
  document.querySelectorAll('.nav button').forEach(b=>b.classList.remove('active'));
  if(el)el.classList.add('active');
  else{
    const match=document.querySelector('.nav button[data-page="'+p+'"]');
    if(match)match.classList.add('active');
  }
  closeSidebar();
  render();
}
function render(){
  const titles={dashboard:'Visão geral',demandas:'Demandas e visitas',relatorios:'Relatórios',equipe:'Equipe',config:'Cadastros',funcionarios:'Funcionários',acessos:'Acessos'};
  if((currentPage==='funcionarios'||currentPage==='acessos')&&currentUser?.role!=='admin'){currentPage='dashboard';}
  document.getElementById('pageTitle').textContent=titles[currentPage]||'Visão geral';
  if(currentPage==='dashboard')renderDash();
  else if(currentPage==='demandas')renderDemandas();
  else if(currentPage==='relatorios')renderReports();
  else if(currentPage==='equipe')renderEquipe();
  else if(currentPage==='funcionarios')renderFuncionarios();
  else if(currentPage==='acessos')renderAcessos();
  else renderConfig();
}
function syncAdminNav(){
  const isAdmin=currentUser?.role==='admin';
  document.querySelectorAll('.admin-only').forEach(n=>{n.hidden=!isAdmin;});
}
function statusLabel(s){return({active:'Ativo',pending:'Aguardando aprovação',disabled:'Desativado'}[s]||s)}
function statusTag(s){
  const c=s==='active'?'green':s==='pending'?'yellow':'red';
  return'<span class="tag '+c+'">'+esc(statusLabel(s))+'</span>';
}
function roleLabel(r){return r==='admin'?'Administrador':'Colaborador'}
let employeesCache=[];
async function loadEmployees(force=false){
  if(currentUser?.role!=='admin')return[];
  if(!force&&employeesCache.length)return employeesCache;
  const data=await api('employees');
  employeesCache=data.employees||[];
  return employeesCache;
}
function renderFuncionarios(){
  document.getElementById('page').innerHTML='<div class="toolbar"><div><h2>Funcionários</h2><div class="muted">Cadastro completo ligado às contas de acesso no banco de dados</div></div><div class="actions"><button type="button" class="btn primary" onclick="openEmployeeModal()">＋ Novo funcionário</button></div></div><div class="card" id="employeesBox"><div class="empty">Carregando…</div></div>';
  void fillEmployeesTable();
}
async function fillEmployeesTable(){
  const box=document.getElementById('employeesBox');
  if(!box)return;
  try{
    const list=await loadEmployees(true);
    if(!list.length){box.innerHTML='<div class="empty">Nenhum funcionário cadastrado. Inclua a equipe ou aprove solicitações em Acessos.</div>';return;}
    box.innerHTML='<div class="tablewrap"><table class="table"><thead><tr><th>Nome</th><th>E-mail</th><th>Cargo / depto</th><th>Perfil</th><th>Acesso</th><th></th></tr></thead><tbody>'+
      list.map(u=>'<tr><td><b>'+esc(u.name)+'</b><div class="muted">'+esc(u.phone||'—')+(u.documento?' · '+esc(u.documento):'')+'</div></td><td>'+esc(u.email)+'</td><td>'+esc(u.cargo||'—')+'<div class="muted">'+esc(u.departamento||'')+'</div></td><td>'+esc(roleLabel(u.role))+'</td><td>'+statusTag(u.status)+'</td><td><span class="link" data-edit-employee="'+Number(u.id)+'">Editar</span></td></tr>').join('')+
      '</tbody></table></div>';
  }catch(e){box.innerHTML='<div class="empty">'+esc(e.message)+'</div>';}
}
function renderAcessos(){
  document.getElementById('page').innerHTML='<div class="toolbar"><div><h2>Autorizações de acesso</h2><div class="muted">O administrador aprova cadastros, edita e-mails e libera ou bloqueia usuários</div></div><div class="actions"><button type="button" class="btn" onclick="showPage(\'funcionarios\')">Ver cadastro completo</button></div></div><div class="card" style="margin-bottom:20px"><h3>Pendentes de aprovação</h3><div id="pendingAccess"><div class="empty">Carregando…</div></div></div><div class="card"><h3>Todos os acessos</h3><div id="allAccess"><div class="empty">Carregando…</div></div></div>';
  void fillAccessLists();
}
async function fillAccessLists(){
  const pending=document.getElementById('pendingAccess');
  const all=document.getElementById('allAccess');
  try{
    const list=await loadEmployees(true);
    const wait=list.filter(u=>u.status==='pending');
    if(pending){
      pending.innerHTML=wait.length
        ? wait.map(u=>'<div class="configitem"><span><b>'+esc(u.name)+'</b><br><span class="muted">'+esc(u.email)+(u.cargo?' · '+esc(u.cargo):'')+'</span></span><span style="display:flex;gap:8px;flex-wrap:wrap"><button type="button" class="btn primary" data-user-id="'+Number(u.id)+'" data-user-status="active">Aprovar</button><button type="button" class="btn danger" data-user-id="'+Number(u.id)+'" data-user-status="disabled">Recusar</button><button type="button" class="btn" data-edit-employee="'+Number(u.id)+'">Editar</button></span></div>').join('')
        : '<div class="empty">Nenhuma solicitação pendente.</div>';
    }
    if(all){
      all.innerHTML=list.map(u=>{
        const actions=u.role==='admin'
          ? '<button type="button" class="btn" data-edit-employee="'+Number(u.id)+'">Editar e-mail / dados</button>'
          : '<span style="display:flex;gap:8px;flex-wrap:wrap"><button type="button" class="btn" data-user-id="'+Number(u.id)+'" data-user-status="'+(u.status==='active'?'disabled':'active')+'">'+(u.status==='active'?'Desativar':'Ativar')+'</button><button type="button" class="btn" data-edit-employee="'+Number(u.id)+'">Editar</button></span>';
        return '<div class="configitem"><span><b>'+esc(u.name)+'</b><br><span class="muted">'+esc(u.email)+' · '+esc(roleLabel(u.role))+'</span></span><span style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">'+statusTag(u.status)+actions+'</span></div>';
      }).join('');
    }
  }catch(e){
    if(pending)pending.textContent=e.message;
    if(all)all.textContent=e.message;
  }
}
function openEmployeeModal(id){
  const form=document.getElementById('employeeForm');
  if(!form)return;
  form.reset();
  document.getElementById('empId').value=id||'';
  document.getElementById('employeeModalTitle').textContent=id?'Editar funcionário':'Novo funcionário';
  document.getElementById('empPasswordHint').textContent=id?'(deixe em branco para manter)':'(obrigatória no cadastro)';
  document.getElementById('empPassword').required=!id;
  if(id){
    const u=employeesCache.find(x=>Number(x.id)===Number(id));
    if(!u){alert('Funcionário não encontrado. Atualize a lista.');return;}
    document.getElementById('empName').value=u.name||'';
    document.getElementById('empEmail').value=u.email||'';
    document.getElementById('empPhone').value=u.phone||'';
    document.getElementById('empDocumento').value=u.documento||'';
    document.getElementById('empCargo').value=u.cargo||'';
    document.getElementById('empDepartamento').value=u.departamento||'';
    document.getElementById('empRole').value=u.role||'member';
    document.getElementById('empStatus').value=u.status||'pending';
    document.getElementById('empNotes').value=u.notes||'';
  }else{
    document.getElementById('empRole').value='member';
    document.getElementById('empStatus').value='active';
  }
  document.getElementById('employeeModalBg').style.display='flex';
  document.body.classList.add('modal-open');
}
function closeEmployeeModal(){
  const bg=document.getElementById('employeeModalBg');
  if(bg)bg.style.display='none';
  if(document.getElementById('modalbg')?.style.display!=='flex')document.body.classList.remove('modal-open');
}
async function saveEmployee(event){
  event.preventDefault();
  const button=event.submitter||document.querySelector('#employeeForm button.primary');
  if(button)button.disabled=true;
  try{
    const id=document.getElementById('empId').value;
    const body={
      id:id?Number(id):null,
      name:document.getElementById('empName').value.trim(),
      email:document.getElementById('empEmail').value.trim(),
      phone:document.getElementById('empPhone').value.trim(),
      documento:document.getElementById('empDocumento').value.trim(),
      cargo:document.getElementById('empCargo').value.trim(),
      departamento:document.getElementById('empDepartamento').value.trim(),
      role:document.getElementById('empRole').value,
      status:document.getElementById('empStatus').value,
      notes:document.getElementById('empNotes').value.trim(),
      password:document.getElementById('empPassword').value,
    };
    const data=await api('employee_save',body);
    if(data.employee&&Number(data.employee.id)===Number(currentUser?.id)){
      currentUser={...currentUser,...data.employee};
      authEl('signedInName').textContent=currentUser.name;
      authEl('signedInAvatar').textContent=currentUser.name.trim().split(/\s+/).slice(0,2).map(x=>x[0]).join('').toUpperCase();
    }
    employeesCache=[];
    closeEmployeeModal();
    if(currentPage==='funcionarios')await fillEmployeesTable();
    if(currentPage==='acessos')await fillAccessLists();
    authEl('syncStatus').textContent='Funcionário salvo no banco';
  }catch(e){alert(e.message);}
  finally{if(button)button.disabled=false;}
}
function renderDash(){let total=visits.length,open=visits.filter(x=>!['Concluída','Cancelada'].includes(x.status)).length,high=visits.filter(x=>x.prioridade==='Alta'&&!['Concluída','Cancelada'].includes(x.status)).length,done=visits.filter(x=>x.status==='Concluída').length;document.getElementById('page').innerHTML='<div class="toolbar"><div><h2>Painel de engenharia</h2><div class="muted">Acompanhamento das visitas e demandas</div></div><div class="actions"><button class="btn" onclick="exportCSV()">Exportar CSV</button><button class="btn primary" onclick="openModal()">＋ Nova vistoria</button></div></div><div class="stats"><div class="stat"><span class="label">Total de demandas</span><strong>'+total+'</strong><em>registros no repositório</em></div><div class="stat"><span class="label">Em andamento</span><strong>'+open+'</strong><em>exigem acompanhamento</em></div><div class="stat"><span class="label">Prioridade alta</span><strong>'+high+'</strong><em>ação prioritária</em></div><div class="stat"><span class="label">Concluídas</span><strong>'+done+'</strong><em>serviços finalizados</em></div></div><div class="grid"><div class="card"><h3>Demandas recentes</h3>'+tableHTML(visits.slice().sort((a,b)=>b.data.localeCompare(a.data)).slice(0,6))+'</div><div class="card"><h3>Fluxo por status</h3><div class="list">'+['Aberta','Em análise','Programada','Em execução','Aguardando validação','Concluída'].map(s=>{let n=visits.filter(x=>x.status===s).length,p=total?Math.round(n/total*100):0;return'<div class="listitem"><div style="display:flex;justify-content:space-between">'+tag(s)+' <b>'+n+'</b></div><div class="progress"><i style="width:'+p+'%"></i></div></div>'}).join('')+'</div></div></div>'}
function tableHTML(a){if(!a.length)return'<div class="empty">Nenhuma demanda encontrada.</div>';return'<div class="tablewrap"><table class="table"><thead><tr><th>Registro</th><th>Obra / unidade</th><th>Tipo</th><th>Prioridade</th><th>Status</th><th></th></tr></thead><tbody>'+a.map(x=>'<tr><td><b>'+esc(x.id)+'</b><div class="muted">'+dateBR(x.data)+'</div></td><td>'+esc(x.obra)+'<div class="muted">'+esc(x.local)+'</div></td><td>'+esc(x.tipo)+'</td><td>'+tag(x.prioridade)+'</td><td>'+tag(x.status)+'</td><td><span class="link" onclick="viewVisit(\''+x.id+'\')">Abrir</span></td></tr>').join('')+'</tbody></table></div>'}
function renderDemandas(){document.getElementById('page').innerHTML='<div class="toolbar"><div><h2>Demandas e visitas</h2><div class="muted">Repositório central para consulta e tomada de decisão</div></div><div class="actions"><button class="btn primary" onclick="openModal()">＋ Nova vistoria</button></div></div><div class="card"><div class="filters"><div class="field"><label>Buscar</label><input id="search" placeholder="Obra, OS, unidade ou solicitante" oninput="renderList()"></div><div class="field"><label>Status</label><select id="fstatus" onchange="renderList()"><option value="">Todos</option><option>Aberta</option><option>Em análise</option><option>Programada</option><option>Em execução</option><option>Aguardando validação</option><option>Concluída</option><option>Cancelada</option></select></div><div class="field"><label>Tipo</label><select id="ftype" onchange="renderList()"><option value="">Todos</option><option>Vistoria técnica</option><option>Manutenção preventiva</option><option>Manutenção corretiva</option><option>Assistência técnica pós-obra</option><option>Atendimento a chamado</option></select></div><div class="field"><label>Prioridade</label><select id="fpriority" onchange="renderList()"><option value="">Todas</option><option>Alta</option><option>Média</option><option>Baixa</option></select></div></div><div id="list"></div></div>';renderList()}
function renderList(){let q=((document.getElementById('search')||{}).value||'').toLowerCase(),s=(document.getElementById('fstatus')||{}).value||'',t=(document.getElementById('ftype')||{}).value||'',p=(document.getElementById('fpriority')||{}).value||'';let a=visits.filter(x=>(!q||JSON.stringify(x).toLowerCase().includes(q))&&(!s||x.status===s)&&(!t||x.tipo===t)&&(!p||x.prioridade===p));let e=document.getElementById('list');if(e)e.innerHTML=tableHTML(a)}
function closeModal(){
  document.getElementById('modalbg').style.display='none';
  document.body.classList.remove('modal-open');
  document.querySelectorAll('.nav button').forEach(b=>b.classList.remove('active'));
  const match=document.querySelector('.nav button[data-page="'+currentPage+'"]');
  if(match)match.classList.add('active');
}
function renderReports(){let types={};visits.forEach(x=>types[x.tipo]=(types[x.tipo]||0)+1);document.getElementById('page').innerHTML='<div class="toolbar"><div><h2>Relatórios gerenciais</h2><div class="muted">Indicadores para acompanhamento da diretoria</div></div><div class="actions"><button class="btn" onclick="exportJSON()">Baixar backup JSON</button><button class="btn primary" onclick="exportCSV()">Exportar CSV</button></div></div><div class="grid"><div class="card"><h3>Distribuição por tipo de atendimento</h3><div class="list">'+Object.keys(types).map(k=>'<div class="listitem"><div style="display:flex;justify-content:space-between"><span>'+esc(k)+'</span><b>'+types[k]+'</b></div><div class="progress"><i style="width:'+Math.round(types[k]/visits.length*100)+'%"></i></div></div>').join('')+'</div></div><div class="card"><h3>Prioridades abertas</h3><div class="list">'+['Alta','Média','Baixa'].map(k=>'<div class="listitem">'+tag(k)+' <b style="float:right">'+visits.filter(x=>x.prioridade===k&&!['Concluída','Cancelada'].includes(x.status)).length+'</b></div>').join('')+'</div></div></div><div class="card" style="margin-top:20px"><h3>Base completa</h3>'+tableHTML(visits)+'</div>'}
function renderEquipe(){
  const a={};visits.forEach(x=>a[x.responsavel]=(a[x.responsavel]||0)+1);
  const cadastrados=sortNames(settings.usuarios);
  const cadastroCard='<div class="card" style="margin-bottom:20px"><div class="toolbar"><div><h3 style="margin:0">Responsáveis cadastrados no escritório</h3><div class="muted">Pré-cadastro usado no campo “Responsável no escritório”</div></div><button type="button" class="btn primary" onclick="showPage(\'config\')">＋ Cadastrar responsável</button></div>'+(cadastrados.length?'<div class="list">'+cadastrados.map(n=>'<div class="configitem"><span>'+esc(n)+'</span></div>').join('')+'</div>':'<div class="empty">Nenhum responsável pré-cadastrado. Vá em Cadastros para incluir.</div>')+'</div>';
  const demandaCard='<div class="card"><h3>Demandas por responsável</h3><div class="list">'+(Object.keys(a).length?Object.keys(a).sort((x,y)=>x.localeCompare(y,'pt-BR')).map(k=>{const n=a[k],d=visits.filter(x=>x.responsavel===k&&x.status==='Concluída').length;return'<div class="listitem"><b>'+esc(k)+'</b><span style="float:right">'+n+' demandas</span><div class="muted">'+d+' concluídas</div><div class="progress"><i style="width:'+Math.round(d/n*100)+'%"></i></div></div>'}).join(''):'<div class="empty">Ainda não há vistorias atribuídas.</div>')+'</div></div>';
  document.getElementById('page').innerHTML='<div class="toolbar"><div><h2>Equipe</h2><div class="muted">Cadastre os nomes do escritório e acompanhe a distribuição das demandas</div></div></div>'+cadastroCard+demandaCard;
}
function csvCell(v){return'"'+String(v||'').replace(/"/g,'""')+'"'}
function exportCSV(){let h=['ID','Obra','Data','Local','OS','Tipo','Responsável','Técnico','Anomalia','Origem','Risco','Prioridade','Ação','Prazo','Status'],r=visits.map(x=>[x.id,x.obra,x.data,x.local,x.os,x.tipo,x.responsavel,x.tecnico,x.anomalia,x.origem,x.risco,x.prioridade,x.acao,x.prazo,x.status].map(csvCell).join(';'));download('\ufeff'+h.map(csvCell).join(';')+'\n'+r.join('\n'),'plenty-visitas.csv','text/csv')}
function exportJSON(){download(JSON.stringify(visits,null,2),'plenty-backup.json','application/json')}
function download(d,n,t){let a=document.createElement('a');a.href=URL.createObjectURL(new Blob([d],{type:t}));a.download=n;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),500)}


let csrf='',currentUser=null,revision=0,mutationBusy=false;
const authEl=id=>document.getElementById(id);
const formTemplate=authEl('visitForm').innerHTML;
function lockScreen(){currentUser=null;visits=[];settings={obras:[],usuarios:[]};employeesCache=[];closeModal();closeEmployeeModal();location.replace('index.php');}
async function api(action,body){
 const options={credentials:'same-origin',cache:'no-store',headers:{Accept:'application/json'}};
 if(body!==undefined){options.method='POST';options.headers['Content-Type']='application/json';options.headers['X-CSRF-Token']=csrf;options.body=JSON.stringify(body);}
 let response;try{response=await fetch('api.php?action='+encodeURIComponent(action),options);}catch(e){throw new Error('Sem conexão. Seus dados ainda não foram enviados. Tente novamente.');}
 let data;try{data=await response.json();}catch(e){throw new Error('O servidor não respondeu corretamente. Verifique se o PHP está ativo e se api.php foi enviado.');}
 if(!response.ok||!data.ok){if(response.status===401){lockScreen();throw new Error(data.message||'Sessão encerrada.');}throw new Error(data.message||'Não foi possível concluir a operação.');}
 if(data.csrf)csrf=data.csrf;return data;
}
function applyState(data){
  visits=data.state.visits;
  settings=data.state.settings||{obras:[],usuarios:[]};
  settings.obras=sortNames(settings.obras);
  settings.usuarios=sortNames(settings.usuarios);
  revision=data.revision;
  if(activeModule==='vistorias')render();
  fillLists();
  authEl('syncStatus').textContent='Dados carregados do servidor';
}
async function refreshPanel(){try{applyState(await api('state'));}catch(e){alert(e.message);}}
async function mutate(action,body){if(mutationBusy)throw new Error('Aguarde a operação atual terminar.');mutationBusy=true;authEl('syncStatus').textContent='Salvando…';try{const data=await api(action,{...body,revision});applyState(data);authEl('syncStatus').textContent='Salvo no servidor';return data;}catch(e){authEl('syncStatus').textContent='Alteração não salva';throw e;}finally{mutationBusy=false;}}
async function enterApp(account){
  currentUser=account;currentPage='dashboard';syncAdminNav();
  const initials=account.name.trim().split(/\s+/).slice(0,2).map(x=>x[0]).join('').toUpperCase();
  authEl('signedInName').textContent=account.name;
  authEl('signedInAvatar').textContent=initials;
  const homeName=document.getElementById('homeSignedInName');
  const homeAvatar=document.getElementById('homeSignedInAvatar');
  if(homeName)homeName.textContent=account.name;
  if(homeAvatar)homeAvatar.textContent=initials;
  renderModuleHome();
  showModuleHome();
  try{applyState(await api('state'));}catch(e){currentUser=null;throw e;}
  // Mantém a central de módulos após carregar os dados do servidor
  showModuleHome();
}
async function loadSession(){
  try{
    const data=await api('session');
    if(!data.user){location.replace('index.php');return;}
    await enterApp(data.user);
  }catch(e){
    authEl('syncStatus').textContent=e.message;
    if(!currentUser)location.replace('index.php');
  }
}
async function logout(){try{await api('logout',{});}catch(e){/* ainda assim encerra local */}lockScreen();}

function today(){const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
function openModal(id){
 if(!currentUser)return;authEl('visitForm').innerHTML=formTemplate;
 closeSidebar();
 document.querySelectorAll('.nav button').forEach(b=>b.classList.remove('active'));
 const nova=document.querySelector('.nav button[data-page="nova"]');
 if(nova&&!id)nova.classList.add('active');
 authEl('modalTitle').textContent=id?'Editar vistoria':'Nova vistoria técnica';authEl('editId').value=id||'';authEl('data').value=today();fillLists();
 if(id){const v=visits.find(x=>x.id===id);if(!v)return;Object.keys(v).forEach(k=>{const el=authEl(k);if(el&&k!=='foto')el.value=v[k]||'';});}
 refreshOsPreview();
 authEl('data').addEventListener('change',refreshOsPreview);
 authEl('data').addEventListener('input',refreshOsPreview);
 authEl('foto').accept='image/jpeg,image/png,image/webp';authEl('modalbg').style.display='flex';document.body.classList.add('modal-open');
}
function readPhoto(file){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(new Error('Não foi possível ler a foto.'));reader.readAsDataURL(file);});}
async function saveVisit(event){
 event.preventDefault();if(mutationBusy)return;const button=event.submitter||authEl('visitForm').querySelector('button.primary');button.disabled=true;
 try{
  const v={};['obra','data','local','endereco','solicitante','tipo','responsavel','tecnico','objetivo','situacao','elemento','anomalia','causa','origem','risco','prioridade','diagnostico','acao','prazo','status'].forEach(k=>v[k]=authEl(k).value);
  v.id=authEl('editId').value;const file=authEl('foto').files[0];
  if(file){if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>2097152)throw new Error('Use uma foto JPG, PNG ou WebP de até 2 MB.');v.foto=await readPhoto(file);}
  await mutate('visit_save',{visit:v});closeModal();
 }catch(e){alert(e.message);}finally{button.disabled=false;}
}
function viewVisit(id){
 const v=visits.find(x=>x.id===id);if(!v)return;
 authEl('modalTitle').textContent=v.id+' | '+v.obra;
 const head=[
  ['Obra / unidade',esc(v.obra)+'<br>'+esc(v.local)],
  ['Data / OS',esc(dateBR(v.data))+'<br>'+esc(v.os)],
  ['Tipo',esc(v.tipo)],
  ['Responsável',esc(v.responsavel)],
  ['Status',tag(v.status)],
  ['Prioridade / risco',tag(v.prioridade)+' '+tag(v.risco)],
  ['Solicitante',esc(v.solicitante)],
  ['Técnico em campo',esc(v.tecnico)],
  ['Endereço',esc(v.endereco)],
 ];
 const body=
  '<div class="notice">Registro completo da visita técnica.</div>'+
  '<div class="detailgrid">'+head.map(([label,html])=>'<div class="detailbox"><b>'+label+'</b><span style="white-space:pre-wrap">'+html+'</span></div>').join('')+'</div>'+
  '<div class="detailbox" style="margin-top:12px"><b>Objetivo</b><span style="white-space:pre-wrap">'+esc(v.objetivo)+'</span></div>'+
  '<div class="detailbox" style="margin-top:12px"><b>Situação encontrada</b><span style="white-space:pre-wrap">'+esc(v.situacao)+'</span></div>'+
  '<div class="detailbox" style="margin-top:12px"><b>Anomalia / patologia</b><span style="white-space:pre-wrap">'+esc(v.elemento)+(v.elemento&&v.anomalia?'<br>':'')+esc(v.anomalia)+'<br><span class="muted">Causa: '+esc(v.causa)+' · Origem: '+esc(v.origem)+'</span></span></div>'+
  '<div class="detailbox" style="margin-top:12px"><b>Diagnóstico técnico</b><span style="white-space:pre-wrap">'+esc(v.diagnostico)+'</span></div>'+
  '<div class="detailbox" style="margin-top:12px"><b>Plano de ação</b><span style="white-space:pre-wrap">'+esc(v.acao)+'<br><span class="muted">Prazo: '+esc(dateBR(v.prazo))+'</span></span></div>'+
  (v.foto?'<img class="photo" style="height:auto;max-height:420px;object-fit:contain;margin-top:12px" alt="Evidência da vistoria" src="'+esc(v.foto)+'">':'')+
  '<div class="modalfoot"><button type="button" class="btn danger" onclick="removeVisit(\''+v.id+'\')">Excluir</button><button type="button" class="btn" onclick="closeModal()">Fechar</button><button type="button" class="btn primary" onclick="openModal(\''+v.id+'\')">Editar</button></div>';
 authEl('visitForm').innerHTML=body;
 authEl('modalbg').style.display='flex';document.body.classList.add('modal-open');
}
async function removeVisit(id){if(!confirm('Excluir esta vistoria do servidor para toda a equipe?'))return;try{await mutate('visit_delete',{id});closeModal();}catch(e){alert(e.message);}}
async function changeCatalog(kind,operation,value){await mutate('catalog',{kind,operation,value});}
async function submitCatalog(kind,inputId){
  const input=document.getElementById(inputId);
  const value=(input?.value||'').trim();
  if(!value){alert(kind==='obras'?'Informe o nome da obra.':'Informe o nome do responsável no escritório.');return;}
  if(sortNames(settings[kind]).some(x=>x.localeCompare(value,'pt-BR',{sensitivity:'base'})===0)){
    alert('Este nome já está cadastrado.');
    if(input)input.focus();
    return;
  }
  try{
    await changeCatalog(kind,'add',value);
    if(input){input.value='';input.focus();}
  }catch(e){alert(e.message);}
}
function catalogHTML(kind,title,hint,placeholder,inputId){
  const items=sortNames(settings[kind]);
  const list=items.length
    ? items.map(value=>'<div class="configitem"><span>'+esc(value)+'</span><button type="button" class="btn danger" data-catalog-kind="'+kind+'" data-catalog-value="'+esc(value)+'">Excluir</button></div>').join('')
    : '<div class="empty">Nenhum cadastro ainda. Inclua abaixo para usar depois na vistoria.</div>';
  return '<div class="card"><h3 style="margin:0 0 8px">'+title+'</h3><p class="muted" style="margin:0 0 14px">'+hint+' Lista em ordem alfabética (A–Z).</p><form class="filters" style="margin-bottom:14px" onsubmit="event.preventDefault();void submitCatalog(\''+kind+'\',\''+inputId+'\')"><div class="field" style="min-width:200px"><label for="'+inputId+'">Novo cadastro</label><input id="'+inputId+'" maxlength="100" placeholder="'+placeholder+'" autocomplete="off"></div><div class="field" style="flex:0;min-width:auto;justify-content:flex-end"><label>&nbsp;</label><button type="submit" class="btn primary">＋ Cadastrar</button></div></form><div class="list">'+list+'</div></div>';
}
function renderConfig(){
 authEl('page').innerHTML='<div class="toolbar"><div><h2>Cadastros prévios</h2><div class="muted">Obras e responsáveis no escritório em ordem alfabética — não criam login</div></div></div><div class="configgrid">'+catalogHTML('obras','Empreendimentos / obras','Cadastro prévio das obras usadas no formulário.','Ex.: CLIGED BARRA DA TIJUCA','newObra')+catalogHTML('usuarios','Responsáveis no escritório','Nomes usados em “Responsável no escritório”. Contas de login ficam em Funcionários / Acessos.','Ex.: Mariana Costa','newResponsavel')+'</div><div class="card" style="margin-top:20px"><h3>Numeração automática</h3><p class="muted">As novas OS seguem o padrão <b>AAAAMMDD####</b>, por exemplo: <b>'+osForDate(today())+'</b>. A numeração definitiva é confirmada no servidor ao salvar.</p></div><div class="card" style="margin-top:20px"><h3>Backup e atualização</h3><p class="muted">Use Atualizar painel para carregar alterações de outros usuários.</p><button class="btn" onclick="exportJSON()">Baixar backup de vistorias</button>'+(currentUser?.role==='admin'?' <label class="btn" style="display:inline-block;cursor:pointer">Importar backup JSON<input type="file" id="importBackup" accept="application/json,.json" hidden></label><p class="muted">Para trazer vistorias da versão antiga, importe o backup JSON. Registros com o mesmo ID são ignorados.</p><p class="muted">Contas e autorizações: use os módulos <b>Funcionários</b> e <b>Acessos</b> no menu.</p>':'')+'</div>';
}
document.addEventListener('click',async e=>{
 const mod=e.target.closest('[data-module]');
 if(mod){openModule(mod.dataset.module);return;}
 const cat=e.target.closest('[data-catalog-kind]');
 if(cat&&confirm('Excluir este nome do cadastro?')){
   try{await changeCatalog(cat.dataset.catalogKind,'remove',cat.dataset.catalogValue);}catch(error){alert(error.message);}
 }
 const editEmp=e.target.closest('[data-edit-employee]');
 if(editEmp){openEmployeeModal(Number(editEmp.dataset.editEmployee));return;}
 const userButton=e.target.closest('[data-user-id]');
 if(userButton){
   userButton.disabled=true;
   try{
     await api('user_status',{id:Number(userButton.dataset.userId),status:userButton.dataset.userStatus});
     employeesCache=[];
     if(currentPage==='acessos')await fillAccessLists();
     else if(currentPage==='funcionarios')await fillEmployeesTable();
   }catch(error){alert(error.message);userButton.disabled=false;}
 }
});
document.addEventListener('change',async e=>{
 if(e.target.id!=='importBackup')return;const file=e.target.files[0];if(!file)return;
 try{if(file.size>20*1024*1024)throw new Error('Backup acima de 20 MB.');const items=JSON.parse(await file.text());if(!Array.isArray(items))throw new Error('Selecione um backup de vistorias em JSON.');if(confirm('Importar '+items.length+' vistorias? IDs já existentes serão preservados.')){await mutate('import',{visits:items});alert('Importação concluída.');}}catch(error){alert(error.message);}finally{e.target.value='';}
});
document.getElementById('menuToggle')?.addEventListener('click',()=>{
  const sidebar=document.getElementById('sidebar');
  setSidebarOpen(!sidebar.classList.contains('open'));
});
document.getElementById('sidebarClose')?.addEventListener('click',closeSidebar);
document.getElementById('sidebarBackdrop')?.addEventListener('click',closeSidebar);
window.addEventListener('resize',()=>{if(!window.matchMedia('(max-width:900px)').matches)closeSidebar();});
document.addEventListener('keydown',e=>{
  if(e.key==='Escape'){
    closeSidebar();
    if(authEl('modalbg').style.display==='flex')closeModal();
    if(document.getElementById('employeeModalBg')?.style.display==='flex')closeEmployeeModal();
  }
});
void loadSession();
