/* =========================================================
   EDIT YOUR DETAILS HERE (name, links, founder's note)
   ========================================================= */
const FOUNDER = {
  name: 'Vijay P. N',
  role: 'Founder & Video Editor',
  instagram: 'just.vj.here',
  email: 'vijayneeralakeri77@gmail.com',
  image: 'founder.jpg',   // the photo file sits next to index.html
  note: 'Write the founder\'s note here. Tell clients who you are, what you edit, ' +
        'and how you work with them. You can use several lines.'
};

/* ---------- helpers ---------- */
const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtDate = d => new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

// Only allow normal web links (blocks javascript: and similar tricks)
function cleanUrl(raw) {
  let v = String(raw || '').trim();
  if (!v) return null;
  if (!/^[a-z][a-z0-9+.-]*:/i.test(v)) v = 'https://' + v;
  try {
    const u = new URL(v);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
    return u.href;
  } catch (_) { return null; }
}

/* ---------- Supabase ---------- */
const configured = typeof SUPABASE_URL === 'string' && /^https:\/\/.+\.supabase\.co/.test(SUPABASE_URL)
  && typeof SUPABASE_ANON_KEY === 'string' && SUPABASE_ANON_KEY.length > 20;
let sb = null;
if (configured && window.supabase) sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let me = null;            // logged-in user {id, role, name, email} or null
let afterLogin = '#home'; // where to go after login
let editorFilter = 'All';

async function loadMe() {
  me = null;
  if (!sb) return;
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return;
  const { data: prof } = await sb.from('profiles').select('name,email,role').eq('id', session.user.id).maybeSingle();
  me = {
    id: session.user.id,
    role: prof && prof.role === 'editor' ? 'editor' : 'client',
    name: (prof && prof.name) || (session.user.user_metadata && session.user.user_metadata.name) || 'Client',
    email: (prof && prof.email) || session.user.email
  };
}

/* ---------- founder box ---------- */
function founderCard(compact) {
  const initials = FOUNDER.name.split(' ').map(w => w[0]).join('').slice(0, 2);
  return `
  <div class="founder ${compact ? 'compact' : ''}">
    <img class="avatar" src="${esc(FOUNDER.image)}" alt="${esc(FOUNDER.name)}"
         onerror="this.outerHTML='<div class=&quot;avatar&quot;>${esc(initials)}</div>'">
    <div>
      <h2>${esc(FOUNDER.name)}</h2>
      <p class="role">${esc(FOUNDER.role)}</p>
      <div class="links">
        <a href="https://instagram.com/${esc(FOUNDER.instagram)}" target="_blank" rel="noopener">Instagram: ${esc(FOUNDER.instagram)}</a>
        <a href="mailto:${esc(FOUNDER.email)}">${esc(FOUNDER.email)}</a>
      </div>
    </div>
    ${compact ? '' : `<div class="note"><h3>Founder's note</h3><p>${esc(FOUNDER.note)}</p></div>`}
  </div>`;
}

/* ---------- navigation ---------- */
function renderNav() {
  const nav = $('#navLinks');
  if (!me) {
    nav.innerHTML = `<a href="#login">Log in</a>`;
  } else if (me.role === 'editor') {
    nav.innerHTML = `<span class="who">Editor: ${esc(me.name)}</span><a href="#editor">Dashboard</a><button id="logoutBtn">Log out</button>`;
  } else {
    nav.innerHTML = `<span class="who">${esc(me.name)}</span><a href="#mine">My projects</a><button id="logoutBtn">Log out</button>`;
  }
  const lo = $('#logoutBtn');
  if (lo) lo.onclick = async () => {
    if (sb) await sb.auth.signOut();
    me = null; renderNav(); navigate('#home');
  };
}

function show(name) {
  document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.id === 'view-' + name));
  window.scrollTo(0, 0);
}

function navigate(hash) {
  if (location.hash === hash) route(); else location.hash = hash;
}
function go(hash, back) { if (back) afterLogin = back; navigate(hash); }

function route() {
  const page = (location.hash || '#home').slice(1);
  if (page === 'project') { show('project'); renderProject(); }
  else if (page === 'login') { show('login'); renderLogin('client'); }
  else if (page === 'mine') {
    if (!me) return go('#login', '#mine');
    if (me.role === 'editor') return navigate('#editor');
    show('mine'); loadMine();
  }
  else if (page === 'editor') {
    if (!me) return go('#login', '#editor');
    if (me.role !== 'editor') return navigate('#mine');
    show('editor'); loadEditor();
  }
  else { show('home'); $('#homeFounder').innerHTML = founderCard(true); }
}
window.addEventListener('hashchange', route);

/* ---------- login / register ---------- */
let loginTab = 'client';
function renderLogin(tab) {
  loginTab = tab;
  document.querySelectorAll('#loginTabs button').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  $('#loginMsg').textContent = ''; $('#loginMsg').className = 'msg';
  const reg = tab === 'register';
  $('#loginForm').innerHTML = `
    ${reg ? `<label class="field">Your name<input type="text" id="lName" autocomplete="name" required></label>` : ''}
    <label class="field">Email<input type="email" id="lEmail" autocomplete="email" required></label>
    <label class="field">Password${reg ? ' (at least 6 characters)' : ''}<input type="password" id="lPass" autocomplete="${reg ? 'new-password' : 'current-password'}" required></label>
    <button type="submit" class="btn" style="width:100%">${reg ? 'Create account' : tab === 'editor' ? 'Log in as editor' : 'Log in'}</button>`;
}
document.querySelectorAll('#loginTabs button').forEach(b => b.onclick = () => renderLogin(b.dataset.tab));

$('#loginForm').addEventListener('submit', async e => {
  e.preventDefault();
  const msg = $('#loginMsg');
  const setMsg = (cls, text) => { msg.className = 'msg ' + cls; msg.textContent = text; };
  if (!sb) return setMsg('err', 'The website is not connected to its database yet.');
  setMsg('', 'Please wait…');
  const email = $('#lEmail').value.trim().toLowerCase();
  const password = $('#lPass').value;
  try {
    if (loginTab === 'register') {
      const name = $('#lName').value.trim();
      if (!name) return setMsg('err', 'Please enter your name.');
      if (password.length < 6) return setMsg('err', 'Password must be at least 6 characters.');
      const { data, error } = await sb.auth.signUp({ email, password, options: { data: { name } } });
      if (error) throw error;
      if (!data.session) {
        return setMsg('ok', 'Account created. Check your email to confirm it, then log in.');
      }
    } else {
      const { error } = await sb.auth.signInWithPassword({ email, password });
      if (error) throw error;
    }
    await loadMe();
    if (loginTab === 'editor' && (!me || me.role !== 'editor')) {
      await sb.auth.signOut(); me = null; renderNav();
      return setMsg('err', 'This account is not the editor account.');
    }
    renderNav();
    const dest = me.role === 'editor' ? '#editor' : afterLogin;
    afterLogin = '#home';
    navigate(dest);
  } catch (err) {
    setMsg('err', err.message === 'Invalid login credentials' ? 'Wrong email or password.' : (err.message || 'Something went wrong.'));
  }
});

/* ---------- start project (founder box + send-clips form) ---------- */
function linkRow() {
  const div = document.createElement('div');
  div.className = 'linkrow';
  div.innerHTML = `<input type="text" class="linkInput" inputmode="url" autocapitalize="off" autocorrect="off" placeholder="Paste a Google Drive / WeTransfer / Dropbox link">
    <button type="button" class="rm" aria-label="Remove link">✕</button>`;
  div.querySelector('.rm').onclick = () => { if (document.querySelectorAll('.linkrow').length > 1) div.remove(); else div.querySelector('input').value = ''; };
  return div;
}

function renderProject() {
  $('#projectFounder').innerHTML = founderCard(false);
  const p = $('#uploadPanel');
  if (!me) {
    p.innerHTML = `<h2>Send your clips</h2>
      <p class="sub">Log in as a client to send your video links, describe your edits and set a deadline.</p>
      <a class="btn" href="#login" id="toLogin">Log in or create an account</a>`;
    $('#toLogin').onclick = () => { afterLogin = '#project'; };
    return;
  }
  if (me.role === 'editor') {
    p.innerHTML = `<h2>You are logged in as the editor</h2>
      <p class="sub">Clients send their projects from this page. Open your dashboard to see them.</p>
      <a class="btn" href="#editor">Open dashboard</a>`;
    return;
  }
  p.innerHTML = `
    <h2>Send your clips</h2>
    <p class="sub">Upload your videos to Google Drive, Dropbox or WeTransfer first. Set sharing to
      <strong>"Anyone with the link can view"</strong>, then paste the link(s) below.</p>
    <form id="upForm" novalidate>
      <label class="field">Project name (optional)<input type="text" id="upTitle" maxlength="120" placeholder="e.g. Wedding highlight reel"></label>
      <div class="field">Video / file links
        <div id="linkRows"></div>
        <button type="button" class="btn ghost small" id="addLink" style="margin-top:8px">+ Add another link</button>
      </div>
      <label class="field">What edits do you need?
        <textarea id="upDemands" maxlength="5000" placeholder="Describe cuts, music, colour, captions, length, style…"></textarea></label>
      <label class="field">Deadline<input type="date" id="upDeadline"></label>
      <button type="submit" class="btn" id="upBtn">Send to editor</button>
      <p class="msg" id="upMsg"></p>
    </form>`;
  $('#linkRows').appendChild(linkRow());
  $('#addLink').onclick = () => {
    if (document.querySelectorAll('.linkrow').length >= 10) return;
    $('#linkRows').appendChild(linkRow());
  };
  $('#upDeadline').min = new Date().toISOString().slice(0, 10);
  $('#upForm').addEventListener('submit', submitProject);
}

async function submitProject(e) {
  e.preventDefault();
  const msg = $('#upMsg'), btn = $('#upBtn');
  const setMsg = (cls, text) => { msg.className = 'msg ' + cls; msg.textContent = text; };
  const demands = $('#upDemands').value.trim(), deadline = $('#upDeadline').value;
  const raw = [...document.querySelectorAll('.linkInput')].map(i => i.value.trim()).filter(Boolean);
  if (!raw.length) return setMsg('err', 'Please paste at least one link to your clips.');
  const links = [];
  for (const r of raw) {
    const u = cleanUrl(r);
    if (!u) return setMsg('err', `This does not look like a valid web link: ${r}`);
    if (u.length > 2000) return setMsg('err', 'One of the links is too long.');
    links.push(u);
  }
  if (!demands) return setMsg('err', 'Please describe the edits you need.');
  if (!deadline) return setMsg('err', 'Please choose a deadline.');

  btn.disabled = true; setMsg('', 'Sending…');
  const { error } = await sb.from('projects').insert({
    client_id: me.id,
    title: $('#upTitle').value.trim() || 'Untitled project',
    links, demands, deadline
  });
  btn.disabled = false;
  if (error) {
    if (/JWT|expired|not authenticated/i.test(error.message)) { me = null; renderNav(); renderProject(); return; }
    return setMsg('err', 'Could not send. Please try again. (' + error.message + ')');
  }
  setMsg('ok', 'Sent! Vijay can now see your project.');
  setTimeout(() => navigate('#mine'), 1200);
}

/* ---------- project lists ---------- */
function projectCard(p, isEditor) {
  const key = p.status.replace(/\s/g, '');
  const links = (p.links || []).map(l => {
    const href = cleanUrl(l);
    if (!href) return '';
    let host = href; try { host = new URL(href).hostname.replace(/^www\./, ''); } catch (_) {}
    return `<div class="file">
      <span class="lnk">${esc(href)}</span>
      <span class="acts"><a href="${esc(href)}" target="_blank" rel="noopener noreferrer">Open (${esc(host)})</a></span>
    </div>`;
  }).join('');
  return `<article class="proj" data-id="${esc(p.id)}">
    <div class="proj-head">
      <div>
        <h3>${esc(p.title)}</h3>
        <p class="meta">${isEditor ? `${esc(p.client_name)} · <a href="mailto:${esc(p.client_email)}" style="color:inherit">${esc(p.client_email)}</a> · ` : ''}Sent ${fmtDate(p.created_at)} · Deadline ${fmtDate(p.deadline)}</p>
      </div>
      ${isEditor
        ? `<select class="status" aria-label="Status">${['New', 'In progress', 'Done'].map(s => `<option ${s === p.status ? 'selected' : ''}>${s}</option>`).join('')}</select>`
        : `<span class="badge ${key}">${esc(p.status)}</span>`}
    </div>
    <p class="demands">${esc(p.demands)}</p>
    <div class="files">${links}</div>
  </article>`;
}

function wireStatus(root) {
  root.querySelectorAll('select.status').forEach(s => s.onchange = async () => {
    const { error } = await sb.from('projects').update({ status: s.value }).eq('id', s.closest('.proj').dataset.id);
    if (error) { alert('Could not change status: ' + error.message); loadEditor(); }
  });
}

async function fetchProjects() {
  const { data, error } = await sb.from('projects').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

async function loadMine() {
  const target = $('#myList');
  target.innerHTML = '<p class="empty">Loading…</p>';
  try {
    const list = await fetchProjects();
    target.innerHTML = list.length ? list.map(p => projectCard(p, false)).join('')
      : '<p class="empty">You have not sent any projects yet. Use Start Project on the home page.</p>';
  } catch (err) { target.innerHTML = `<p class="msg err">${esc(err.message)}</p>`; }
}

async function loadEditor() {
  const target = $('#editorList');
  target.innerHTML = '<p class="empty">Loading…</p>';
  try {
    const all = await fetchProjects();
    const count = s => s === 'All' ? all.length : all.filter(p => p.status === s).length;
    $('#editorFilter').innerHTML = ['All', 'New', 'In progress', 'Done'].map(s =>
      `<button type="button" class="${s === editorFilter ? 'active' : ''}" data-f="${s}">${s} (${count(s)})</button>`).join('');
    $('#editorFilter').querySelectorAll('button').forEach(b => b.onclick = () => { editorFilter = b.dataset.f; loadEditor(); });
    const list = editorFilter === 'All' ? all : all.filter(p => p.status === editorFilter);
    target.innerHTML = list.length ? list.map(p => projectCard(p, true)).join('')
      : '<p class="empty">No projects here yet. New client projects will show up here.</p>';
    wireStatus(target);
  } catch (err) { target.innerHTML = `<p class="msg err">${esc(err.message)}</p>`; }
}

/* ---------- start ---------- */
(async function init() {
  if (!sb) {
    const w = $('#setupWarn');
    w.style.display = 'block';
    w.textContent = configured
      ? 'Could not load the database library. Check your internet connection and refresh.'
      : 'Setup needed: open config.js and paste your Supabase URL and anon key.';
  }
  try { await loadMe(); } catch (_) { me = null; }
  renderNav(); route();
})();
