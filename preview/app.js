(() => {
  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const rows = value => Array.isArray(value) ? value : [];
  const fmtDate = value => {
    if (!value) return '';
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    return m ? m[3] + '/' + m[2] + '/' + m[1] : value;
  };
  const pageLabels = {
    general:'Generali',
    departures:'Ondate',
    timeline:'Timeline',
    officials:'Ufficiali gara',
    roles:'Ruoli',
    notes:'Note e checklist',
    permissions:'Permessi'
  };

  let session = null;
  let globalAccess = {isAdmin:false,canCreate:false,canImport:false};
  let state = null;
  let access = null;
  let currentPage = 'general';
  let eventRows = [];
  let dirty = false;

  function toast(text, error) {
    const node = $('status');
    node.textContent = text || '';
    node.classList.toggle('error', !!error);
    node.classList.toggle('show', !!text);
    clearTimeout(toast.timer);
    if (text) toast.timer = setTimeout(() => node.classList.remove('show'), 3500);
  }

  function initials(value) {
    return String(value || 'U').split(/[@.\s_-]+/).filter(Boolean).slice(0,2).map(x => x[0].toUpperCase()).join('') || 'U';
  }

  function roleLabel(role) {
    return ({admin:'Admin',responsabile:'Responsabile',visualizzatore:'Visualizzatore'}[role] || '');
  }

  function normalize(data) {
    const x = structuredClone(data || {});
    x.event = x.event || {};
    x.event.athleteDepartures = rows(x.event.athleteDepartures);
    x.timeline = rows(x.timeline);
    x.officials = rows(x.officials);
    x.roleCategories = rows(x.roleCategories).map(c => ({
      ...c,
      subcategories:rows(c.subcategories),
      roles:rows(c.roles).map(r => ({
        ...r,
        officialIds:rows(r.officialIds),
        officialIdsBySubcategory:r.officialIdsBySubcategory || {}
      }))
    }));
    x.refereeNotes = x.refereeNotes || {};
    x.refereeNotes.checklist = rows(x.refereeNotes.checklist);
    return x;
  }

  function updateUser() {
    const email = session?.user?.email || 'Utente';
    const label = email.split('@')[0].replace(/[._-]+/g,' ').replace(/\b\w/g,c=>c.toUpperCase());
    $('sidebarUserName').textContent = label;
    $('sidebarUserRole').textContent = globalAccess.isAdmin ? 'Admin' : '';
    $('sidebarInitials').textContent = initials(label);
    $('userBadge').textContent = initials(label);
  }

  function showHome() {
    state = null;
    access = null;
    dirty = false;
    $('homeView').classList.remove('hidden');
    $('eventView').classList.add('hidden');
    $('homeNav').classList.remove('hidden');
    $('eventNav').classList.add('hidden');
    $('backEventsBtn').classList.add('hidden');
    $('permissionsSideLink').classList.add('hidden');
    $('mobileActionBar').classList.add('hidden');
    $('breadcrumb').textContent = '';
    $('newEventBtn').classList.toggle('hidden', !globalAccess.canCreate);
    $('importEventBtn').classList.toggle('hidden', !globalAccess.canImport);
    loadEvents();
  }

  async function loadEvents() {
    const box = $('eventList');
    box.innerHTML = '<div class="surface empty-state">Caricamento eventi…</div>';
    try {
      eventRows = await OWDatabase.listEvents();
      renderEventCards();
    } catch (e) {
      box.innerHTML = '<div class="surface empty-state error">' + esc(e.message) + '</div>';
    }
  }

  function renderEventCards() {
    const q = $('eventSearch').value.trim().toLowerCase();
    const list = eventRows.filter(e => !q || [e.name,e.event_date,e.venue].some(v => String(v || '').toLowerCase().includes(q)));
    const box = $('eventList');
    box.innerHTML = '';
    if (!list.length) {
      box.innerHTML = '<div class="surface empty-state">Nessun evento trovato.</div>';
      return;
    }
    list.forEach(e => {
      const card = document.createElement('article');
      card.className = 'surface event-card';
      card.innerHTML =
        '<div class="event-card-head"><div><h2>' + esc(e.name || 'Evento') + '</h2>' +
        '<div class="event-meta" style="margin-top:10px">' +
        (e.event_date ? '<span><span class="material-symbols-rounded">calendar_month</span>' + esc(fmtDate(e.event_date)) + '</span>' : '') +
        (e.venue ? '<span><span class="material-symbols-rounded">location_on</span>' + esc(e.venue) + '</span>' : '') +
        (Number.isFinite(e.athlete_total) ? '<span><span class="material-symbols-rounded">groups</span>' + e.athlete_total + ' atleti</span>' : '') +
        '</div></div>' +
        (e.access_role ? '<span class="access-pill">' + esc(roleLabel(e.access_role)) + '</span>' : '') +
        '</div><div class="event-card-foot"><span class="row-muted">' +
        (e.updated_at ? 'Aggiornato ' + new Date(e.updated_at).toLocaleString('it-IT') : '') +
        '</span><div class="row-actions"><button class="button ghost open-event"><span class="material-symbols-rounded">arrow_forward</span>Apri</button></div></div>';
      card.querySelector('.open-event').onclick = () => openEvent(e.event_id);
      box.append(card);
    });
  }

  async function openEvent(id) {
    try {
      const result = await Promise.all([OWDatabase.getEvent(id),OWDatabase.eventAccess(id)]);
      if (!result[0]) throw new Error('Evento non trovato.');
      state = normalize(result[0]);
      access = result[1];
      dirty = false;
      currentPage = 'general';
      $('homeView').classList.add('hidden');
      $('eventView').classList.remove('hidden');
      $('homeNav').classList.add('hidden');
      $('eventNav').classList.remove('hidden');
      $('backEventsBtn').classList.remove('hidden');
      $('permissionsSideLink').classList.toggle('hidden', !access?.canManagePermissions);
      $('mobileActionBar').classList.remove('hidden');
      updateHeader();
      updateActions();
      showPage('general');
    } catch (e) {
      toast(e.message,true);
    }
  }

  function updateHeader() {
    if (!state) return;
    $('eventTitle').textContent = state.event.name || 'Evento';
    $('eventSubtitle').textContent = [fmtDate(state.event.date),state.event.venue].filter(Boolean).join(' · ');
    $('breadcrumb').innerHTML = '<span>Eventi</span><span>›</span><span>' + esc(state.event.name || 'Evento') + '</span><span>›</span><strong>' + esc(pageLabels[currentPage]) + '</strong>';
  }

  function updateActions() {
    $('saveEventBtn').classList.toggle('hidden', !access?.canEdit);
    $('mobileSaveBtn').classList.toggle('hidden', !access?.canEdit || !dirty);
    $('copyEventBtn').classList.toggle('hidden', !globalAccess.isAdmin || !state?.id);
    $('exportEventBtn').classList.toggle('hidden', !access?.canExport || !state?.id);
    $('pdfBtn').classList.toggle('hidden', !access?.canPrint);
    $('summaryPdfBtn').classList.toggle('hidden', !access?.canPrint);
  }

  function markDirty() {
    if (!access?.canEdit) return;
    dirty = true;
    updateActions();
  }

  function setReadOnly() {
    const readOnly = !access?.canEdit;
    $('pageContent').querySelectorAll('input,textarea,select').forEach(el => {
      if (currentPage !== 'permissions') el.disabled = readOnly;
    });
    $('pageContent').querySelectorAll('[data-edit]').forEach(el => el.classList.toggle('hidden', readOnly));
  }

  function showPage(page) {
    if (page === 'permissions' && !access?.canManagePermissions) return;
    currentPage = page;
    document.querySelectorAll('.side-link[data-page]').forEach(b => b.classList.toggle('active', b.dataset.page === page));
    updateHeader();
    renderPage();
  }

  function renderPage() {
    if (currentPage === 'general') renderGeneral();
    if (currentPage === 'departures') renderDepartures();
    if (currentPage === 'timeline') renderTimeline();
    if (currentPage === 'officials') renderOfficials();
    if (currentPage === 'roles') renderRoles();
    if (currentPage === 'notes') renderNotes();
    if (currentPage === 'permissions') renderPermissions();
    if (currentPage !== 'permissions') setReadOnly();
  }

  function renderGeneral() {
    $('pageContent').innerHTML =
      '<section class="surface page-card"><div class="card-head"><div class="card-title"><span class="material-symbols-rounded">description</span><h2>Dati evento</h2></div></div>' +
      '<div class="form-grid">' +
      '<label class="wide">Nome evento<input id="fName" value="' + esc(state.event.name || '') + '"></label>' +
      '<label>Data<input id="fDate" type="date" value="' + esc(state.event.date || '') + '"></label>' +
      '<label>Luogo / impianto<input id="fVenue" value="' + esc(state.event.venue || '') + '"></label>' +
      '<label class="wide">Note generali<textarea id="fNotes">' + esc(state.event.notes || '') + '</textarea></label>' +
      '<label class="wide">Note percorso<textarea id="fPath">' + esc(state.event.pathNotes || '') + '</textarea></label>' +
      '</div></section>';
    [['fName','name'],['fDate','date'],['fVenue','venue'],['fNotes','notes'],['fPath','pathNotes']].forEach(pair => {
      $(pair[0]).oninput = e => {
        state.event[pair[1]] = e.target.value;
        markDirty();
        updateHeader();
      };
    });
  }

  function renderDepartures() {
    const items = state.event.athleteDepartures.map(x =>
      '<div class="data-row"><div><div class="row-title">' + esc(x.name || 'Partenza') + '</div><div class="row-muted">' + esc(x.time || '') + '</div></div>' +
      '<div><div class="row-muted">Atleti</div><strong>' + esc(x.athletes ?? '') + '</strong></div>' +
      '<div><div class="row-muted">Numeri</div>' + esc(x.numbers || '') + '</div>' +
      '<div><div class="row-muted">Note</div>' + esc(x.notes || '') + '</div>' +
      '<div></div></div>'
    ).join('');
    $('pageContent').innerHTML =
      '<section class="surface page-card"><div class="card-head"><div class="card-title"><span class="material-symbols-rounded">waves</span><h2>Ondate</h2></div></div>' +
      '<div class="form-grid" style="margin-bottom:18px"><label>Totale atleti<input id="fAthletes" type="number" min="0" value="' + Number(state.event.athleteTotal || 0) + '"></label>' +
      '<label class="wide">Note atleti<textarea id="fAthleteNotes">' + esc(state.event.athleteDescription || '') + '</textarea></label></div>' +
      '<div class="data-list">' + (items || '<div class="empty-state">Nessuna partenza inserita.</div>') + '</div></section>';
    $('fAthletes').oninput = e => { state.event.athleteTotal = Number(e.target.value || 0); markDirty(); };
    $('fAthleteNotes').oninput = e => { state.event.athleteDescription = e.target.value; markDirty(); };
  }

  function renderTimeline() {
    const items = state.timeline.map(x =>
      '<div class="data-row timeline-row"><div class="row-title">' + esc(x.time || '--:--') + '</div>' +
      '<div><div class="row-title">' + esc(x.title || 'Fase') + '</div><div class="row-muted">' + esc(x.place || '') + '</div></div>' +
      '<div class="row-muted">' + esc(x.notes || '') + '</div><div></div></div>'
    ).join('');
    $('pageContent').innerHTML =
      '<section class="surface page-card"><div class="card-head"><div class="card-title"><span class="material-symbols-rounded">schedule</span><h2>Timeline</h2></div></div>' +
      '<div class="data-list">' + (items || '<div class="empty-state">Nessuna fase inserita.</div>') + '</div></section>';
  }

  function renderOfficials() {
    const items = state.officials.map(x =>
      '<div class="data-row official-row"><div class="row-title">' + esc(x.name || 'UG senza nome') + '</div><div class="row-muted">' + esc(x.notes || '') + '</div><div></div></div>'
    ).join('');
    $('pageContent').innerHTML =
      '<section class="surface page-card"><div class="card-head"><div class="card-title"><span class="material-symbols-rounded">groups</span><h2>Ufficiali gara</h2></div></div>' +
      '<div class="data-list">' + (items || '<div class="empty-state">Nessun UG inserito.</div>') + '</div></section>';
  }

  function renderRoles() {
    const officialName = id => state.officials.find(o => o.id === id)?.name || 'UG senza nome';
    const categories = state.roleCategories.map((cat,index) => {
      const subs = state.roleSubcategoriesEnabled ? rows(cat.subcategories) : [];
      const roleRows = rows(cat.roles).map(role => {
        if (subs.length) {
          return '<tr><td>' + esc(role.name || 'Ruolo') + '</td>' + subs.map(s =>
            '<td>' + esc(rows(role.officialIdsBySubcategory?.[s.id]).map(officialName).join(' - ')) + '</td>'
          ).join('') + '</tr>';
        }
        return '<tr><td>' + esc(role.name || 'Ruolo') + '</td><td>' + esc(rows(role.officialIds).map(officialName).join(' - ')) + '</td></tr>';
      }).join('');
      const head = subs.length
        ? '<tr><th>Ruolo</th>' + subs.map(s => '<th>' + esc(s.name || 'Sottocategoria') + '</th>').join('') + '</tr>'
        : '<tr><th>Ruolo</th><th>Ufficiali gara assegnati</th></tr>';
      return '<section class="surface page-card"><div class="card-title" style="margin-bottom:14px"><span class="access-pill">' + (index+1) + '</span><h2>' + esc(cat.name || 'Categoria') + '</h2></div>' +
        '<div class="table-wrap"><table><thead>' + head + '</thead><tbody>' + roleRows + '</tbody></table></div></section>';
    }).join('');
    $('pageContent').innerHTML =
      '<section class="surface page-card"><div class="toggle-line"><div class="card-title"><span class="material-symbols-rounded">layers</span><div><h2 style="margin:0">Sottocategorie ruoli</h2><div class="row-muted">' +
      (state.roleSubcategoriesEnabled ? 'Attive per questo evento.' : 'Non attive per questo evento.') +
      '</div></div></div></div></section>' +
      (categories || '<div class="surface empty-state">Nessuna categoria ruoli.</div>');
  }

  function renderNotes() {
    const checklist = state.refereeNotes.checklist.map(x =>
      '<div class="check-row"><input type="checkbox" ' + (x.checked ? 'checked' : '') + ' disabled><span>' + esc(x.label) + '</span><span></span></div>'
    ).join('');
    $('pageContent').innerHTML =
      '<section class="surface page-card"><div class="card-title" style="margin-bottom:16px"><span class="material-symbols-rounded">description</span><h2>Briefing Atleti</h2></div>' +
      '<label>Testo briefing per gli atleti<textarea id="fBriefA">' + esc(state.refereeNotes.briefingAthletes || '') + '</textarea></label></section>' +
      '<section class="surface page-card"><div class="card-title" style="margin-bottom:16px"><span class="material-symbols-rounded">description</span><h2>Briefing Giuria</h2></div>' +
      '<label>Testo briefing per la giuria<textarea id="fBriefJ">' + esc(state.refereeNotes.briefingJury || '') + '</textarea></label></section>' +
      '<section class="surface page-card"><div class="card-title" style="margin-bottom:16px"><span class="material-symbols-rounded">fact_check</span><h2>Checklist operativa</h2></div>' +
      '<div class="checklist">' + (checklist || '<div class="empty-state">Nessuna voce checklist.</div>') + '</div></section>';
    $('fBriefA').oninput = e => { state.refereeNotes.briefingAthletes = e.target.value; markDirty(); };
    $('fBriefJ').oninput = e => { state.refereeNotes.briefingJury = e.target.value; markDirty(); };
  }

  async function renderPermissions() {
    $('pageContent').innerHTML =
      '<section class="surface page-card"><div class="card-head"><div class="card-title"><span class="material-symbols-rounded">lock</span><div><h2>Permessi</h2><div class="row-muted">Gestisci chi può accedere a questo evento.</div></div></div></div>' +
      '<div id="permissionRows"><div class="empty-state">Caricamento permessi…</div></div></section>';
    try {
      const users = await OWDatabase.listEventPermissions(state.id);
      const box = $('permissionRows');
      box.innerHTML = '';
      users.forEach(user => {
        const row = document.createElement('div');
        row.className = 'permission-row';
        const isAdmin = user.role === 'admin';
        row.innerHTML =
          '<div><div class="permission-name">' + esc(user.display_name || user.email) + '</div></div>' +
          '<div class="permission-email">' + esc(user.email || '') + '</div>' +
          '<select ' + (isAdmin ? 'disabled' : '') + '>' +
          '<option value="" ' + (!user.role ? 'selected' : '') + '>Nessun accesso</option>' +
          '<option value="responsabile" ' + (user.role === 'responsabile' ? 'selected' : '') + '>Responsabile</option>' +
          '<option value="visualizzatore" ' + (user.role === 'visualizzatore' ? 'selected' : '') + '>Visualizzatore</option>' +
          (isAdmin ? '<option value="admin" selected>Admin</option>' : '') + '</select>';
        const select = row.querySelector('select');
        if (!isAdmin) select.onchange = async () => {
          const previous = user.role || '';
          select.disabled = true;
          try {
            await OWDatabase.setEventPermission(state.id,user.user_id,select.value || null);
            user.role = select.value || null;
            toast('Permesso aggiornato.');
          } catch (e) {
            select.value = previous;
            toast(e.message,true);
          } finally {
            select.disabled = false;
          }
        };
        box.append(row);
      });
    } catch (e) {
      $('permissionRows').innerHTML = '<div class="empty-state error">' + esc(e.message) + '</div>';
    }
  }

  async function saveEvent() {
    if (!access?.canEdit) return;
    try {
      const now = new Date().toISOString();
      const payload = structuredClone(state);
      payload.version = 4;
      payload.createdAt = payload.createdAt || now;
      payload.savedAt = now;
      state = normalize(await OWDatabase.saveEvent(payload));
      dirty = false;
      updateHeader();
      updateActions();
      toast('Evento salvato.');
    } catch (e) {
      toast(e.message,true);
    }
  }

  function exportCurrent() {
    if (!state?.id) return;
    const blob = new Blob([JSON.stringify(state,null,2)],{type:'application/json'});
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = (state.event.name || 'evento').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'') + '.json';
    link.click();
    URL.revokeObjectURL(url);
  }

  function printHtml(summary,lang) {
    const en = lang === 'en';
    const L = en
      ? {event:'Event',athletes:'Athletes',starts:'Starts',timeline:'Timeline',officials:'Officials',roles:'Roles',course:'Course notes',briefA:'Athletes briefing',briefJ:'Officials briefing'}
      : {event:'Evento',athletes:'Atleti',starts:'Partenze',timeline:'Timeline',officials:'Ufficiali gara',roles:'Ruoli',course:'Note percorso',briefA:'Briefing Atleti',briefJ:'Briefing Giuria'};
    const dep = rows(state.event.athleteDepartures).map(x => '<tr><td>' + esc(x.name) + '</td><td>' + esc(x.time) + '</td><td>' + esc(x.athletes) + '</td><td>' + esc(x.numbers) + '</td><td>' + esc(x.notes) + '</td></tr>').join('');
    const timeline = rows(state.timeline).map(x => '<tr><td>' + esc(x.time) + '</td><td>' + esc(x.title) + '</td><td>' + esc(x.place) + '</td><td>' + esc(x.notes) + '</td></tr>').join('');
    return '<!doctype html><html><head><meta charset="utf-8"><style>body{font-family:Arial,sans-serif;padding:28px;color:#14233c}h2{margin-top:24px;border-bottom:1px solid #ccc}table{width:100%;border-collapse:collapse}td,th{border:1px solid #ddd;padding:7px;text-align:left}.muted{white-space:pre-wrap;color:#56657a}</style></head><body>' +
      '<h1>' + esc(state.event.name) + '</h1><div>' + esc([fmtDate(state.event.date),state.event.venue].filter(Boolean).join(' · ')) + '</div>' +
      (!summary && state.event.notes ? '<h2>' + L.event + '</h2><div class="muted">' + esc(state.event.notes) + '</div>' : '') +
      '<h2>' + L.athletes + '</h2><p><strong>' + esc(state.event.athleteTotal || 0) + '</strong></p>' +
      (state.event.athleteDescription ? '<div class="muted">' + esc(state.event.athleteDescription) + '</div>' : '') +
      (dep ? '<h2>' + L.starts + '</h2><table><thead><tr><th>' + L.starts + '</th><th>Ora</th><th>' + L.athletes + '</th><th>Numeri</th><th>Note</th></tr></thead><tbody>' + dep + '</tbody></table>' : '') +
      (timeline ? '<h2>' + L.timeline + '</h2><table><tbody>' + timeline + '</tbody></table>' : '') +
      (state.refereeNotes.briefingAthletes ? '<h2>' + L.briefA + '</h2><div class="muted">' + esc(state.refereeNotes.briefingAthletes) + '</div>' : '') +
      (state.refereeNotes.briefingJury ? '<h2>' + L.briefJ + '</h2><div class="muted">' + esc(state.refereeNotes.briefingJury) + '</div>' : '') +
      (state.event.pathNotes ? '<h2>' + L.course + '</h2><div class="muted">' + esc(state.event.pathNotes) + '</div>' : '') +
      '</body></html>';
  }

  function openPrint(summary) {
    $('pdfDialogTitle').textContent = summary ? 'Stampa sintetica' : 'Anteprima PDF';
    $('pdfDialog').dataset.summary = summary ? '1' : '0';
    $('pdfFrame').srcdoc = printHtml(summary,$('printLanguage').value);
    $('pdfDialog').showModal();
  }

  function toggleMenu(open) {
    $('sidebar').classList.toggle('open',open);
    $('mobileScrim').classList.toggle('hidden',!open);
  }

  $('loginForm').onsubmit = async e => {
    e.preventDefault();
    $('loginError').textContent = '';
    try {
      await OWAuth.signIn($('loginEmail').value.trim(),$('loginPassword').value);
      location.reload();
    } catch (err) {
      $('loginError').textContent = err.message;
    }
  };

  $('logoutBtn').onclick = async () => {
    if (dirty && !confirm('Ci sono modifiche non salvate. Uscire comunque?')) return;
    await OWAuth.signOut();
    location.reload();
  };
  $('eventSearch').oninput = renderEventCards;
  $('refreshBtn').onclick = loadEvents;
  $('backEventsBtn').onclick = () => {
    if (dirty && !confirm('Ci sono modifiche non salvate. Tornare agli eventi e perderle?')) return;
    showHome();
  };
  $('mobileBackBtn').onclick = $('backEventsBtn').onclick;
  document.querySelectorAll('.side-link[data-page]').forEach(btn => btn.onclick = () => { showPage(btn.dataset.page); toggleMenu(false); });
  $('saveEventBtn').onclick = saveEvent;
  $('mobileSaveBtn').onclick = saveEvent;
  $('exportEventBtn').onclick = exportCurrent;
  $('sheetExportBtn').onclick = exportCurrent;
  $('pdfBtn').onclick = () => openPrint(false);
  $('mobilePdfBtn').onclick = () => openPrint(false);
  $('summaryPdfBtn').onclick = () => openPrint(true);
  $('sheetSummaryBtn').onclick = () => openPrint(true);
  $('closePdfBtn').onclick = () => $('pdfDialog').close();
  $('printPdfBtn').onclick = () => { $('pdfFrame').contentWindow.focus(); $('pdfFrame').contentWindow.print(); };
  $('printLanguage').onchange = () => {
    if ($('pdfDialog').open) $('pdfFrame').srcdoc = printHtml($('pdfDialog').dataset.summary === '1',$('printLanguage').value);
  };
  $('mobileMenuBtn').onclick = () => toggleMenu(true);
  $('mobileScrim').onclick = () => toggleMenu(false);
  $('mobileMoreBtn').onclick = () => $('mobileMoreSheet').classList.remove('hidden');
  $('sheetCloseBtn').onclick = () => $('mobileMoreSheet').classList.add('hidden');

  async function init() {
    session = await OWAuth.session();
    if (!session) {
      $('loginView').classList.remove('hidden');
      $('appView').classList.add('hidden');
      return;
    }
    $('loginView').classList.add('hidden');
    $('appView').classList.remove('hidden');
    globalAccess = await OWDatabase.currentUserAccess();
    updateUser();
    showHome();
  }

  init().catch(e => {
    $('loginView').classList.remove('hidden');
    $('appView').classList.add('hidden');
    $('loginError').textContent = e.message;
  });
})();