(() => {
  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const rows = value => Array.isArray(value) ? value : [];
  const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);
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
  let selectedRoleCategoryId = null;
  let selectedRoleId = null;
  let selectedRoleSubcategoryId = null;
  let rolesViewMode = 'role';
  let selectedOfficialId = null;

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
    $('mobileActionBar')?.classList.add('hidden');
    $('mobileTopBackBtn')?.classList.add('hidden');
    $('mobileMenuBtn')?.classList.remove('hidden');
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
      $('mobileActionBar')?.classList.remove('hidden');
      $('mobileTopBackBtn')?.classList.remove('hidden');
      $('mobileMenuBtn')?.classList.remove('hidden');
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
    $('breadcrumb').innerHTML = '<span>' + esc(state.event.name || 'Evento') + '</span><span>›</span><strong>' + esc(pageLabels[currentPage]) + '</strong>';
  }

  function updateActions() {
    $('saveEventBtn').classList.toggle('hidden', !access?.canEdit);
    $('mobileSaveBtn')?.classList.toggle('hidden', !access?.canEdit);
    if ($('mobileSaveBtn')) $('mobileSaveBtn').disabled = !!access?.canEdit && !dirty;
    $('mobileActionBar')?.classList.toggle('viewer-only', !access?.canEdit);
    $('copyEventBtn').classList.toggle('hidden', !globalAccess.isAdmin || !state?.id);
    $('exportEventBtn').classList.toggle('hidden', !access?.canExport || !state?.id);
    $('pdfBtn').classList.toggle('hidden', !access?.canPrint);
    $('summaryPdfBtn').classList.toggle('hidden', !access?.canPrint);
    $('mobilePdfBtn')?.classList.toggle('hidden', !access?.canPrint);
    $('mobileSummaryBtn')?.classList.toggle('hidden', !access?.canPrint);
  }

  function markDirty() {
    if (!access?.canEdit) return;
    dirty = true;
    updateActions();
  }

  function setReadOnly() {
    const readOnly = !access?.canEdit;
    $('pageContent').querySelectorAll('input,textarea,select').forEach(el => {
      if (currentPage !== 'permissions' && !el.hasAttribute('data-readonly-allow')) el.disabled = readOnly;
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

  let editContext = null;

  function openEditor(title, fields, values, onSave) {
    editContext = { onSave };
    $('formDialogTitle').textContent = title;
    $('formDialogSubtitle').textContent = '';
    const body = $('formDialogBody');
    body.innerHTML = '<div class="form-grid"></div>';
    const grid = body.firstElementChild;
    fields.forEach(([key,label,type]) => {
      const wrapper = document.createElement('label');
      if (type === 'textarea') wrapper.classList.add('wide');
      wrapper.innerHTML = type === 'textarea'
        ? esc(label) + '<textarea data-key="' + esc(key) + '">' + esc(values[key] || '') + '</textarea>'
        : esc(label) + '<input data-key="' + esc(key) + '" type="' + esc(type || 'text') + '" value="' + esc(values[key] ?? '') + '">';
      grid.append(wrapper);
    });
    $('formDialog').showModal();
  }

  $('formDialogSave').onclick = e => {
    e.preventDefault();
    if (!editContext) return;
    const values = {};
    $('formDialogBody').querySelectorAll('[data-key]').forEach(el => {
      values[el.dataset.key] = el.type === 'number' ? Number(el.value || 0) : el.value;
    });
    editContext.onSave(values);
    editContext = null;
    $('formDialog').close();
  };

  function renderDepartures() {
    $('pageContent').innerHTML =
      '<section class="surface page-card">' +
      '<div class="card-head"><div class="card-title"><span class="material-symbols-rounded">waves</span><h2>Ondate</h2></div>' +
      '<button id="addDepartureBtn" class="button primary" data-edit><span class="material-symbols-rounded">add</span>Aggiungi partenza</button></div>' +
      '<div class="form-grid" style="margin-bottom:18px"><label>Totale atleti<input id="fAthletes" type="number" min="0" value="' + Number(state.event.athleteTotal || 0) + '"></label>' +
      '<label class="wide">Note atleti<textarea id="fAthleteNotes">' + esc(state.event.athleteDescription || '') + '</textarea></label></div>' +
      '<div id="departureRows" class="data-list"></div></section>';
    $('fAthletes').oninput = e => { state.event.athleteTotal = Number(e.target.value || 0); markDirty(); };
    $('fAthleteNotes').oninput = e => { state.event.athleteDescription = e.target.value; markDirty(); };
    $('addDepartureBtn').onclick = () => editDeparture();
    renderDepartureRows();
  }

  function renderDepartureRows() {
    const box = $('departureRows');
    box.innerHTML = '';
    if (!state.event.athleteDepartures.length) {
      box.innerHTML = '<div class="empty-state">Nessuna partenza inserita.</div>';
      return;
    }
    state.event.athleteDepartures.forEach(item => {
      const row = document.createElement('div');
      row.className = 'data-row';
      row.innerHTML =
        '<div><div class="row-title">' + esc(item.name || 'Partenza') + '</div><div class="row-muted">' + esc(item.time || '') + '</div></div>' +
        '<div><div class="row-muted">Atleti</div><strong>' + esc(item.athletes ?? '') + '</strong></div>' +
        '<div><div class="row-muted">Numeri</div>' + esc(item.numbers || '') + '</div>' +
        '<div><div class="row-muted">Note</div>' + esc(item.notes || '') + '</div>' +
        '<div class="row-actions" data-edit><button class="icon-button edit"><span class="material-symbols-rounded">edit</span></button>' +
        '<button class="icon-button remove"><span class="material-symbols-rounded">delete</span></button></div>';
      row.querySelector('.edit').onclick = () => editDeparture(item.id);
      row.querySelector('.remove').onclick = () => {
        state.event.athleteDepartures = state.event.athleteDepartures.filter(x => x.id !== item.id);
        markDirty();
        renderDepartureRows();
        setReadOnly();
      };
      box.append(row);
    });
  }

  function editDeparture(id) {
    const original = state.event.athleteDepartures.find(x => x.id === id);
    const item = original ? structuredClone(original) : {id:uid(),name:'Partenza',time:'',athletes:'',numbers:'',notes:''};
    openEditor(original ? 'Modifica partenza' : 'Nuova partenza', [
      ['name','Nome','text'],
      ['time','Orario','time'],
      ['athletes','Numero atleti','number'],
      ['numbers','Numeri','text'],
      ['notes','Note','textarea']
    ], item, values => {
      Object.assign(item, values);
      if (original) Object.assign(original,item);
      else state.event.athleteDepartures.push(item);
      markDirty();
      renderDepartureRows();
      setReadOnly();
    });
  }

  function renderTimeline() {
    $('pageContent').innerHTML =
      '<section class="surface page-card"><div class="card-head"><div class="card-title"><span class="material-symbols-rounded">schedule</span><h2>Timeline</h2></div>' +
      '<button id="addTimelineBtn" class="button primary" data-edit><span class="material-symbols-rounded">add</span>Aggiungi fase</button></div>' +
      '<div id="timelineRows" class="data-list"></div></section>';
    $('addTimelineBtn').onclick = () => editTimeline();
    renderTimelineRows();
  }

  function renderTimelineRows() {
    const box = $('timelineRows');
    box.innerHTML = '';
    if (!state.timeline.length) {
      box.innerHTML = '<div class="empty-state">Nessuna fase inserita.</div>';
      return;
    }
    state.timeline.forEach(item => {
      const row = document.createElement('div');
      row.className = 'data-row timeline-row';
      row.innerHTML =
        '<div class="row-title">' + esc(item.time || '--:--') + '</div>' +
        '<div><div class="row-title">' + esc(item.title || 'Fase') + '</div><div class="row-muted">' + esc(item.place || '') + '</div></div>' +
        '<div class="row-muted">' + esc(item.notes || '') + '</div>' +
        '<div class="row-actions" data-edit><button class="icon-button edit"><span class="material-symbols-rounded">edit</span></button>' +
        '<button class="icon-button remove"><span class="material-symbols-rounded">delete</span></button></div>';
      row.querySelector('.edit').onclick = () => editTimeline(item.id);
      row.querySelector('.remove').onclick = () => {
        state.timeline = state.timeline.filter(x => x.id !== item.id);
        markDirty();
        renderTimelineRows();
        setReadOnly();
      };
      box.append(row);
    });
  }

  function editTimeline(id) {
    const original = state.timeline.find(x => x.id === id);
    const item = original ? structuredClone(original) : {id:uid(),time:'',title:'',place:'',notes:''};
    openEditor(original ? 'Modifica fase timeline' : 'Nuova fase timeline', [
      ['time','Orario','time'],
      ['title','Titolo','text'],
      ['place','Luogo','text'],
      ['notes','Note','textarea']
    ], item, values => {
      Object.assign(item, values);
      if (original) Object.assign(original,item);
      else state.timeline.push(item);
      markDirty();
      renderTimelineRows();
      setReadOnly();
    });
  }

  function renderOfficials() {
    if (selectedOfficialId && state.officials.some(official => official.id === selectedOfficialId)) {
      renderOfficialDetail();
      setReadOnly();
      return;
    }
    selectedOfficialId = null;
    renderOfficialsList();
    setReadOnly();
  }

  function renderOfficialsList() {
    $('pageContent').innerHTML =
      '<div class="officials-page-head">' +
        '<div><h2>Ufficiali gara</h2><div class="row-muted">Apri un ufficiale gara per vedere i dati e il riepilogo completo dei ruoli assegnati.</div></div>' +
        '<button id="addOfficialBtn" class="button primary" data-edit><span class="material-symbols-rounded">person_add</span>Aggiungi UG</button>' +
      '</div>' +
      '<section class="surface page-card">' +
        '<div id="officialRows" class="data-list"></div>' +
      '</section>';

    $('addOfficialBtn').onclick = () => editOfficial();
    renderOfficialRows();
  }

  function renderOfficialDetail() {
    const official = state.officials.find(item => item.id === selectedOfficialId);
    if (!official) {
      selectedOfficialId = null;
      renderOfficialsList();
      return;
    }

    const summary = buildSingleOfficialRoleSummary(official.id);
    const totalRoles = summary.reduce((total,category) => total + category.assignmentCount,0);
    const conflictContexts = summary.reduce((total,category) => total + category.conflictContexts,0);

    $('pageContent').innerHTML =
      '<div class="official-detail-toolbar">' +
        '<button id="backToOfficialsBtn" class="button ghost"><span class="material-symbols-rounded">arrow_back</span>Torna agli UG</button>' +
        '<div class="row-actions" data-edit><button id="editCurrentOfficialBtn" class="button tonal"><span class="material-symbols-rounded">edit</span>Modifica UG</button></div>' +
      '</div>' +
      '<section class="surface official-detail-header">' +
        '<span class="official-chip-avatar official-detail-avatar">' + esc(initials(official.name || 'UG')) + '</span>' +
        '<div class="official-detail-person"><h2>' + esc(official.name || 'UG senza nome') + '</h2>' +
          (official.notes ? '<p>' + esc(official.notes) + '</p>' : '<p class="row-muted">Nessuna nota</p>') +
        '</div>' +
        '<div class="official-detail-metrics">' +
          '<div><span>Ruoli assegnati</span><strong>' + totalRoles + '</strong></div>' +
          '<div class="' + (conflictContexts ? 'warning' : '') + '"><span>Ambiti da verificare</span><strong>' + conflictContexts + '</strong></div>' +
        '</div>' +
      '</section>' +
      '<div class="official-role-summary-heading"><div><h2>Riepilogo ruoli</h2><p>Ordine: categorie → sottocategorie → ruoli, come configurato nella sezione Ruoli.</p></div></div>' +
      '<div id="singleOfficialRoleSummary" class="single-official-role-summary"></div>';

    $('backToOfficialsBtn').onclick = () => {
      selectedOfficialId = null;
      renderOfficials();
    };
    $('editCurrentOfficialBtn').onclick = () => editOfficial(official.id);

    renderSingleOfficialRoleSummary(summary);
  }

  function renderOfficialRows() {
    const box = $('officialRows');
    box.innerHTML = '';
    if (!state.officials.length) {
      box.innerHTML = '<div class="empty-state">Nessun UG inserito.</div>';
      return;
    }

    state.officials.forEach(item => {
      const row = document.createElement('div');
      row.className = 'official-list-row';
      row.innerHTML =
        '<button type="button" class="official-list-main">' +
          '<span class="official-chip-avatar official-list-avatar">' + esc(initials(item.name || 'UG')) + '</span>' +
          '<span class="official-list-copy"><strong>' + esc(item.name || 'UG senza nome') + '</strong>' +
          (item.notes ? '<small>' + esc(item.notes) + '</small>' : '<small>Nessuna nota</small>') + '</span>' +
          '<span class="material-symbols-rounded">chevron_right</span>' +
        '</button>' +
        '<div class="row-actions" data-edit>' +
          '<button class="icon-button edit" title="Modifica"><span class="material-symbols-rounded">edit</span></button>' +
          '<button class="icon-button remove" title="Elimina"><span class="material-symbols-rounded">delete</span></button>' +
        '</div>';

      row.querySelector('.official-list-main').onclick = () => {
        selectedOfficialId = item.id;
        renderOfficials();
      };
      row.querySelector('.edit').onclick = () => editOfficial(item.id);
      row.querySelector('.remove').onclick = () => {
        if (!confirm('Eliminare questo ufficiale gara e rimuoverlo da tutti i ruoli?')) return;
        state.officials = state.officials.filter(x => x.id !== item.id);
        state.roleCategories.forEach(category => rows(category.roles).forEach(role => {
          role.officialIds = rows(role.officialIds).filter(id => id !== item.id);
          Object.keys(role.officialIdsBySubcategory || {}).forEach(key => {
            role.officialIdsBySubcategory[key] = rows(role.officialIdsBySubcategory[key]).filter(id => id !== item.id);
          });
        }));
        if (selectedOfficialId === item.id) selectedOfficialId = null;
        markDirty();
        renderOfficials();
      };
      box.append(row);
    });
  }

  function editOfficial(id) {
    const original = state.officials.find(x => x.id === id);
    const item = original ? structuredClone(original) : {id:uid(),name:'',notes:''};
    openEditor(original ? 'Modifica ufficiale gara' : 'Nuovo ufficiale gara', [
      ['name','Nome e cognome','text'],
      ['notes','Note','textarea']
    ], item, values => {
      Object.assign(item, values);
      if (original) {
        Object.assign(original,item);
        selectedOfficialId = original.id;
      } else {
        state.officials.push(item);
        selectedOfficialId = item.id;
      }
      markDirty();
      renderOfficials();
      setReadOnly();
    });
  }

  function renderRoles() {
    const categories = state.roleCategories;
    if (!selectedRoleCategoryId || !categories.some(category => category.id === selectedRoleCategoryId)) {
      selectedRoleCategoryId = categories[0]?.id || null;
    }

    const selectedCategory = categories.find(category => category.id === selectedRoleCategoryId);
    if (selectedCategory) {
      selectedCategory.roles = rows(selectedCategory.roles);
      selectedCategory.subcategories = rows(selectedCategory.subcategories);
      if (!selectedRoleId || !selectedCategory.roles.some(role => role.id === selectedRoleId)) {
        selectedRoleId = selectedCategory.roles[0]?.id || null;
      }
    } else {
      selectedRoleId = null;
    }

    $('pageContent').innerHTML =
      '<div class="roles-editor-heading">' +
        '<div><h2>Gestione ruoli</h2><div class="row-muted">Definisci categorie e ruoli, poi assegna gli ufficiali gara.</div></div>' +
      '</div>' +
      '<div class="roles-editor-layout">' +
        '<aside class="surface roles-structure-panel">' +
          '<div class="structure-block">' +
            '<div class="structure-head"><div><span class="eyebrow">1</span><strong>Categorie</strong></div>' +
            '<button id="addCategoryBtn" class="icon-button" data-edit title="Nuova categoria"><span class="material-symbols-rounded">add</span></button></div>' +
            '<div id="roleCategoryNav" class="role-category-list"></div>' +
          '</div>' +
          '<div class="structure-divider"></div>' +
          '<div class="structure-block">' +
            '<div class="structure-head"><div><span class="eyebrow">2</span><strong>Ruoli</strong></div>' +
            '<button id="addRoleBtn" class="small-add-button" data-edit title="Nuovo ruolo"><span class="material-symbols-rounded">add</span></button></div>' +
            '<div id="roleNavList" class="role-nav-list"></div>' +
          '</div>' +
        '</aside>' +
        '<main class="roles-editor-main">' +
          '<section class="surface category-settings-card"><div id="categoryEditor"></div></section>' +
          '<section class="surface assignment-pane">' +
            '<div class="role-pane-head"><div><span class="eyebrow">3</span><h2>Assegnazioni</h2></div></div>' +
            '<div id="roleAssignmentEditor"></div>' +
          '</section>' +
        '</main>' +
      '</div>';

    $('addCategoryBtn').onclick = () => {
      const category = {id:uid(),name:'Nuova categoria',subcategories:[],roles:[]};
      categories.push(category);
      selectedRoleCategoryId = category.id;
      selectedRoleId = null;
      selectedRoleSubcategoryId = null;
      markDirty();
      renderRoles();
    };

    $('addRoleBtn').onclick = () => {
      const category = getSelectedRoleCategory();
      if (!category) return;
      const role = {id:uid(),name:'Nuovo ruolo',officialIds:[],officialIdsBySubcategory:{}};
      category.roles.push(role);
      selectedRoleId = role.id;
      selectedRoleSubcategoryId = null;
      markDirty();
      renderRoles();
    };

    renderRoleCategoryList();
    renderCategoryEditor();
    renderRoleNavList();
    renderRoleAssignmentEditor();
    setReadOnly();
  }

  function getSelectedRoleCategory() {
    return state.roleCategories.find(category => category.id === selectedRoleCategoryId) || null;
  }

  function getSelectedRole() {
    const category = getSelectedRoleCategory();
    return category?.roles?.find(role => role.id === selectedRoleId) || null;
  }

  function roleAssignmentCount(category,role) {
    if (!role) return 0;
    if (state.roleSubcategoriesEnabled && rows(category.subcategories).length) {
      const ids = [];
      rows(category.subcategories).forEach(sub => ids.push(...rows(role.officialIdsBySubcategory?.[sub.id])));
      return new Set(ids).size;
    }
    return new Set(rows(role.officialIds)).size;
  }

  function renderRoleCategoryList() {
    const box = $('roleCategoryNav');
    box.innerHTML = '';
    if (!state.roleCategories.length) {
      box.innerHTML = '<div class="compact-empty">Nessuna categoria.<br>Creane una con il pulsante +.</div>';
      return;
    }

    state.roleCategories.forEach((category,index) => {
      category.roles = rows(category.roles);
      const withoutOfficials = category.roles.filter(role => roleAssignmentCount(category,role) === 0).length;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'category-tile' + (category.id === selectedRoleCategoryId ? ' active' : '');
      button.innerHTML =
        '<span class="category-tile-number">' + String(index + 1).padStart(2,'0') + '</span>' +
        '<span class="category-tile-copy"><strong>' + esc(category.name || 'Categoria') + '</strong>' +
        '<small>' + category.roles.length + ' ruoli' + (withoutOfficials ? ' · ' + withoutOfficials + ' da assegnare' : '') + '</small></span>' +
        '<span class="material-symbols-rounded">chevron_right</span>';
      button.onclick = () => {
        selectedRoleCategoryId = category.id;
        selectedRoleId = category.roles[0]?.id || null;
        selectedRoleSubcategoryId = null;
        renderRoles();
      };
      box.append(button);
    });
  }

  function renderCategoryEditor() {
    const box = $('categoryEditor');
    const category = getSelectedRoleCategory();
    if (!category) {
      box.innerHTML = '<div class="role-empty-panel"><span class="material-symbols-rounded">folder_off</span><p>Seleziona o crea una categoria.</p></div>';
      $('addRoleBtn').disabled = true;
      return;
    }

    const index = state.roleCategories.indexOf(category);
    box.innerHTML =
      '<div class="category-editor">' +
        '<div class="category-editor-top">' +
          '<input id="categoryNameInput" class="category-title-input" value="' + esc(category.name || '') + '">' +
          '<div class="row-actions" data-edit>' +
            '<button id="categoryUpBtn" class="icon-button" ' + (index === 0 ? 'disabled' : '') + ' title="Sposta su"><span class="material-symbols-rounded">arrow_upward</span></button>' +
            '<button id="categoryDownBtn" class="icon-button" ' + (index === state.roleCategories.length - 1 ? 'disabled' : '') + ' title="Sposta giù"><span class="material-symbols-rounded">arrow_downward</span></button>' +
            '<button id="deleteCategoryBtn" class="icon-button danger-icon" title="Elimina categoria"><span class="material-symbols-rounded">delete</span></button>' +
          '</div>' +
        '</div>' +
        '<div class="category-options">' +
          '<div><strong>Sottocategorie</strong><span>Assegnazioni separate quando servono</span></div>' +
          '<label class="switch"><input id="roleSubToggle" type="checkbox" ' + (state.roleSubcategoriesEnabled ? 'checked' : '') + '><span></span></label>' +
        '</div>' +
        '<div id="subcategoryEditor"></div>' +
      '</div>';

    $('categoryNameInput').oninput = e => {
      category.name = e.target.value;
      markDirty();
      renderRoleCategoryList();
    };
    $('categoryUpBtn').onclick = () => moveCategory(-1);
    $('categoryDownBtn').onclick = () => moveCategory(1);
    $('deleteCategoryBtn').onclick = () => {
      if (!confirm('Eliminare la categoria e tutti i suoi ruoli?')) return;
      state.roleCategories = state.roleCategories.filter(item => item.id !== category.id);
      selectedRoleCategoryId = state.roleCategories[Math.max(0,index - 1)]?.id || state.roleCategories[0]?.id || null;
      selectedRoleId = null;
      selectedRoleSubcategoryId = null;
      markDirty();
      renderRoles();
    };
    $('roleSubToggle').onchange = e => {
      state.roleSubcategoriesEnabled = e.target.checked;
      selectedRoleSubcategoryId = null;
      markDirty();
      renderRoles();
    };

    renderSubcategoryEditor(category);
  }

  function renderSubcategoryEditor(category) {
    const box = $('subcategoryEditor');
    if (!state.roleSubcategoriesEnabled) {
      box.innerHTML = '';
      return;
    }

    box.innerHTML =
      '<div class="subcategory-editor-row"><div id="subcategoryPills" class="subcategory-pills"></div>' +
      '<button id="addSubcategoryBtn" class="small-add-button" data-edit><span class="material-symbols-rounded">add</span></button></div>';

    const pills = $('subcategoryPills');
    if (!category.subcategories.length) {
      pills.innerHTML = '<span class="row-muted">Nessuna sottocategoria</span>';
    }

    category.subcategories.forEach(sub => {
      const pill = document.createElement('div');
      pill.className = 'subcategory-edit-pill';
      pill.innerHTML =
        '<input value="' + esc(sub.name || '') + '" placeholder="Nome">' +
        '<button type="button" data-edit><span class="material-symbols-rounded">close</span></button>';
      pill.querySelector('input').oninput = e => {
        sub.name = e.target.value;
        markDirty();
        renderRoleAssignmentEditor();
      };
      pill.querySelector('button').onclick = () => {
        category.subcategories = category.subcategories.filter(item => item.id !== sub.id);
        category.roles.forEach(role => {
          if (role.officialIdsBySubcategory) delete role.officialIdsBySubcategory[sub.id];
        });
        if (selectedRoleSubcategoryId === sub.id) selectedRoleSubcategoryId = null;
        markDirty();
        renderRoles();
      };
      pills.append(pill);
    });

    $('addSubcategoryBtn').onclick = () => {
      category.subcategories.push({id:uid(),name:''});
      markDirty();
      renderRoles();
    };
  }

  function renderRoleNavList() {
    const box = $('roleNavList');
    const category = getSelectedRoleCategory();
    box.innerHTML = '';
    if (!category) {
      box.innerHTML = '<div class="compact-empty">Nessuna categoria selezionata.</div>';
      return;
    }
    if (!category.roles.length) {
      box.innerHTML = '<div class="compact-empty">Nessun ruolo.<br>Premi “Nuovo ruolo”.</div>';
      return;
    }

    category.roles.forEach((role,index) => {
      const count = roleAssignmentCount(category,role);
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'role-tile' + (role.id === selectedRoleId ? ' active' : '');
      button.innerHTML =
        '<span class="role-tile-main"><strong>' + esc(role.name || 'Ruolo') + '</strong>' +
        '<small class="' + (count ? 'assigned' : 'unassigned') + '">' +
        (count ? count + ' UG assegnati' : 'Nessun UG assegnato') +
        '</small></span>' +
        '<span class="material-symbols-rounded">chevron_right</span>';
      button.onclick = () => {
        selectedRoleId = role.id;
        selectedRoleSubcategoryId = null;
        renderRoleNavList();
        renderRoleAssignmentEditor();
        setReadOnly();
      };
      box.append(button);
    });
  }

  function renderRoleAssignmentEditor() {
    const box = $('roleAssignmentEditor');
    const category = getSelectedRoleCategory();
    const role = getSelectedRole();

    if (!category || !role) {
      box.innerHTML =
        '<div class="role-empty-panel tall"><span class="material-symbols-rounded">person_search</span>' +
        '<h3>Seleziona un ruolo</h3><p>Qui compariranno le assegnazioni degli ufficiali gara.</p></div>';
      return;
    }

    const index = category.roles.indexOf(role);
    const hasSubcategories = state.roleSubcategoriesEnabled && category.subcategories.length > 0;
    if (hasSubcategories && (!selectedRoleSubcategoryId || !category.subcategories.some(sub => sub.id === selectedRoleSubcategoryId))) {
      selectedRoleSubcategoryId = category.subcategories[0].id;
    }
    if (!hasSubcategories) selectedRoleSubcategoryId = null;

    box.innerHTML =
      '<div class="assignment-editor">' +
        '<div class="assignment-editor-head">' +
          '<div><span class="assignment-kicker">Ruolo selezionato</span>' +
          '<input id="selectedRoleName" class="assignment-title-input" value="' + esc(role.name || '') + '"></div>' +
          '<div class="row-actions" data-edit>' +
            '<button id="roleUpBtn" class="icon-button" ' + (index === 0 ? 'disabled' : '') + ' title="Sposta su"><span class="material-symbols-rounded">arrow_upward</span></button>' +
            '<button id="roleDownBtn" class="icon-button" ' + (index === category.roles.length - 1 ? 'disabled' : '') + ' title="Sposta giù"><span class="material-symbols-rounded">arrow_downward</span></button>' +
            '<button id="deleteRoleBtn" class="icon-button danger-icon" title="Elimina"><span class="material-symbols-rounded">delete</span></button>' +
          '</div>' +
        '</div>' +
        '<div id="assignmentContext"></div>' +
        '<div id="assignedOfficialsArea"></div>' +
        '<div class="official-search-panel">' +
          '<div class="official-search-head"><strong>Aggiungi ufficiale gara</strong><span>Seleziona tra gli UG presenti nell’evento</span></div>' +
          '<label class="official-search-input"><span class="material-symbols-rounded">search</span><input id="officialSearchInput" type="search" placeholder="Cerca per nome"></label>' +
          '<div id="officialSearchResults" class="official-search-results"></div>' +
        '</div>' +
      '</div>';

    $('selectedRoleName').oninput = e => {
      role.name = e.target.value;
      markDirty();
      renderRoleNavList();
    };
    $('roleUpBtn').onclick = () => moveRole(-1);
    $('roleDownBtn').onclick = () => moveRole(1);
    $('deleteRoleBtn').onclick = () => {
      if (!confirm('Eliminare questo ruolo?')) return;
      category.roles.splice(index,1);
      selectedRoleId = category.roles[Math.max(0,index - 1)]?.id || category.roles[0]?.id || null;
      selectedRoleSubcategoryId = null;
      markDirty();
      renderRoleNavList();
      renderRoleAssignmentEditor();
      renderRoleCategoryList();
      setReadOnly();
    };

    renderAssignmentContext(category,role);
    renderAssignedOfficials(category,role);
    renderOfficialSearch(category,role);
  }

  function renderAssignmentContext(category,role) {
    const box = $('assignmentContext');
    if (!(state.roleSubcategoriesEnabled && category.subcategories.length)) {
      box.innerHTML =
        '<div class="assignment-context-single"><span class="material-symbols-rounded">group</span>' +
        '<div><strong>UG assegnati</strong><span>Assegnazione generale per questo ruolo</span></div></div>';
      return;
    }

    box.innerHTML =
      '<div class="assignment-context-tabs">' +
      category.subcategories.map(sub =>
        '<button type="button" class="' + (sub.id === selectedRoleSubcategoryId ? 'active' : '') + '" data-sub="' + esc(sub.id) + '">' +
        esc(sub.name || 'Sottocategoria') + '</button>'
      ).join('') +
      '</div>';

    box.querySelectorAll('[data-sub]').forEach(button => {
      button.onclick = () => {
        selectedRoleSubcategoryId = button.dataset.sub;
        renderRoleAssignmentEditor();
        setReadOnly();
      };
    });
  }

  function currentAssignmentIds(category,role) {
    if (state.roleSubcategoriesEnabled && category.subcategories.length) {
      return rows(role.officialIdsBySubcategory?.[selectedRoleSubcategoryId]);
    }
    return rows(role.officialIds);
  }

  function setCurrentAssignmentIds(category,role,ids) {
    if (state.roleSubcategoriesEnabled && category.subcategories.length) {
      role.officialIdsBySubcategory = role.officialIdsBySubcategory || {};
      role.officialIdsBySubcategory[selectedRoleSubcategoryId] = ids;
    } else {
      role.officialIds = ids;
    }
  }

  function renderAssignedOfficials(category,role) {
    const box = $('assignedOfficialsArea');
    const ids = currentAssignmentIds(category,role);
    const assigned = ids.map(id => state.officials.find(official => official.id === id)).filter(Boolean);

    box.innerHTML =
      '<div class="assigned-section-head"><div><strong>Assegnati</strong><span>' + assigned.length + ' ufficiali gara</span></div></div>' +
      '<div id="assignedOfficialCards" class="assigned-official-cards"></div>';

    const cards = $('assignedOfficialCards');
    if (!assigned.length) {
      cards.innerHTML =
        '<div class="assigned-empty"><span class="material-symbols-rounded">person_off</span>' +
        '<div><strong>Nessun UG assegnato</strong><span>Cercane uno qui sotto e aggiungilo.</span></div></div>';
      return;
    }

    assigned.forEach(official => {
      const card = document.createElement('div');
      card.className = 'assigned-official-card';
      card.innerHTML =
        '<span class="official-chip-avatar large-avatar">' + esc(initials(official.name || 'UG')) + '</span>' +
        '<span class="assigned-official-copy"><strong>' + esc(official.name || 'UG senza nome') + '</strong>' +
        (official.notes ? '<small>' + esc(official.notes) + '</small>' : '') + '</span>' +
        '<button type="button" class="remove-assignment" data-edit title="Rimuovi"><span class="material-symbols-rounded">close</span></button>';
      card.querySelector('button').onclick = () => {
        setCurrentAssignmentIds(category,role,ids.filter(id => id !== official.id));
        markDirty();
        renderRoleAssignmentEditor();
        renderRoleNavList();
        renderRoleCategoryList();
        setReadOnly();
      };
      cards.append(card);
    });
  }

  function renderOfficialSearch(category,role) {
    const input = $('officialSearchInput');
    const results = $('officialSearchResults');

    const draw = () => {
      const currentIds = currentAssignmentIds(category,role);
      const query = input.value.trim().toLowerCase();
      const candidates = state.officials.filter(official =>
        !currentIds.includes(official.id) &&
        (!query || String(official.name || '').toLowerCase().includes(query))
      );

      results.innerHTML = '';
      if (!candidates.length) {
        results.innerHTML = '<div class="official-search-empty">Nessun UG disponibile.</div>';
        return;
      }

      candidates.forEach(official => {
        const item = document.createElement('button');
        item.type = 'button';
        item.className = 'official-search-result';
        item.innerHTML =
          '<span class="official-chip-avatar large-avatar">' + esc(initials(official.name || 'UG')) + '</span>' +
          '<span class="official-result-copy"><strong>' + esc(official.name || 'UG senza nome') + '</strong>' +
          (official.notes ? '<small>' + esc(official.notes) + '</small>' : '') + '</span>' +
          '<span class="add-official-mark"><span class="material-symbols-rounded">add</span></span>';
        item.onclick = () => {
          setCurrentAssignmentIds(category,role,[...new Set([...currentIds,official.id])]);
          markDirty();
          renderRoleAssignmentEditor();
          renderRoleNavList();
          renderRoleCategoryList();
          setReadOnly();
        };
        results.append(item);
      });
    };

    input.oninput = draw;
    draw();
  }

  function moveCategory(direction) {
    const index = state.roleCategories.findIndex(category => category.id === selectedRoleCategoryId);
    const next = index + direction;
    if (index < 0 || next < 0 || next >= state.roleCategories.length) return;
    [state.roleCategories[index],state.roleCategories[next]] = [state.roleCategories[next],state.roleCategories[index]];
    markDirty();
    renderRoles();
  }

  function moveRole(direction) {
    const category = getSelectedRoleCategory();
    if (!category) return;
    const index = category.roles.findIndex(role => role.id === selectedRoleId);
    const next = index + direction;
    if (index < 0 || next < 0 || next >= category.roles.length) return;
    [category.roles[index],category.roles[next]] = [category.roles[next],category.roles[index]];
    markDirty();
    renderRoleNavList();
    renderRoleAssignmentEditor();
    setReadOnly();
  }


  function buildSingleOfficialRoleSummary(officialId) {
    return state.roleCategories.map((category,categoryIndex) => {
      const roles = rows(category.roles);
      const subcategories = state.roleSubcategoriesEnabled ? rows(category.subcategories) : [];
      const categorySummary = {
        categoryId: category.id,
        categoryIndex,
        categoryName: category.name || 'Categoria',
        assignmentCount: 0,
        conflictContexts: 0,
        hasAssignments: false,
        contexts: []
      };

      if (subcategories.length) {
        subcategories.forEach((sub,subIndex) => {
          const assignedRoles = roles
            .map((role,roleIndex) => ({
              role,
              roleIndex,
              assigned: rows(role.officialIdsBySubcategory?.[sub.id]).includes(officialId)
            }))
            .filter(item => item.assigned);

          if (assignedRoles.length > 1) categorySummary.conflictContexts += 1;
          categorySummary.assignmentCount += assignedRoles.length;
          categorySummary.contexts.push({
            subcategoryId: sub.id,
            subcategoryIndex: subIndex,
            label: sub.name || 'Sottocategoria',
            assignedRoles,
            hasConflict: assignedRoles.length > 1
          });
        });
      } else {
        const assignedRoles = roles
          .map((role,roleIndex) => ({
            role,
            roleIndex,
            assigned: rows(role.officialIds).includes(officialId)
          }))
          .filter(item => item.assigned);

        if (assignedRoles.length > 1) categorySummary.conflictContexts += 1;
        categorySummary.assignmentCount += assignedRoles.length;
        categorySummary.contexts.push({
          subcategoryId: null,
          subcategoryIndex: 0,
          label: 'Generale',
          assignedRoles,
          hasConflict: assignedRoles.length > 1
        });
      }

      categorySummary.hasAssignments = categorySummary.assignmentCount > 0;
      return categorySummary;
    });
  }

  function renderSingleOfficialRoleSummary(summary) {
    const box = $('singleOfficialRoleSummary');
    box.innerHTML = '';

    if (!state.roleCategories.length) {
      box.innerHTML = '<div class="surface compact-empty">Non sono state configurate categorie di ruolo.</div>';
      return;
    }

    summary.forEach(category => {
      const card = document.createElement('section');
      card.className = 'surface official-category-summary' + (category.hasAssignments ? '' : ' empty-category');
      card.innerHTML =
        '<div class="official-category-summary-head">' +
          '<span class="category-tile-number">' + String(category.categoryIndex + 1).padStart(2,'0') + '</span>' +
          '<div><h3>' + esc(category.categoryName) + '</h3>' +
            '<span>' + (category.hasAssignments
              ? category.assignmentCount + ' ' + (category.assignmentCount === 1 ? 'ruolo assegnato' : 'ruoli assegnati')
              : 'Nessun ruolo assegnato in questa categoria') +
            '</span></div>' +
          (category.conflictContexts
            ? '<span class="conflict-badge"><span class="material-symbols-rounded">warning</span>Da verificare</span>'
            : '') +
        '</div>' +
        '<div class="official-category-contexts"></div>';

      const contexts = card.querySelector('.official-category-contexts');

      category.contexts.forEach(context => {
        const block = document.createElement('div');
        block.className = 'official-context-block' + (context.hasConflict ? ' conflict' : '') + (context.assignedRoles.length ? '' : ' empty-context');
        block.innerHTML =
          '<div class="official-context-head">' +
            '<div><span class="assignment-context">' + esc(context.label) + '</span>' +
            (context.hasConflict
              ? '<span class="context-warning"><span class="material-symbols-rounded">warning</span>Più ruoli nello stesso ambito</span>'
              : '') +
            '</div>' +
          '</div>' +
          '<div class="official-context-roles"></div>';

        const roleList = block.querySelector('.official-context-roles');

        if (!context.assignedRoles.length) {
          roleList.innerHTML =
            '<div class="official-no-role"><span class="material-symbols-rounded">remove_circle_outline</span>' +
            '<span>Nessun ruolo assegnato</span></div>';
        } else {
          context.assignedRoles.forEach(item => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'official-role-summary-row' + (context.hasConflict ? ' conflict' : '');
            button.innerHTML =
              '<span class="role-order-number">' + String(item.roleIndex + 1).padStart(2,'0') + '</span>' +
              '<span class="role-summary-name">' + esc(item.role.name || 'Ruolo') + '</span>' +
              '<span class="material-symbols-rounded">arrow_forward</span>';
            button.onclick = () => {
              selectedRoleCategoryId = category.categoryId;
              selectedRoleId = item.role.id;
              selectedRoleSubcategoryId = context.subcategoryId;
              showPage('roles');
            };
            roleList.append(button);
          });
        }

        contexts.append(block);
      });

      box.append(card);
    });
  }

  function renderNotes() {
    $('pageContent').innerHTML =
      '<section class="surface page-card"><div class="card-title" style="margin-bottom:16px"><span class="material-symbols-rounded">description</span><h2>Briefing Atleti</h2></div>' +
      '<label>Testo briefing per gli atleti<textarea id="fBriefA">' + esc(state.refereeNotes.briefingAthletes || '') + '</textarea></label></section>' +
      '<section class="surface page-card"><div class="card-title" style="margin-bottom:16px"><span class="material-symbols-rounded">description</span><h2>Briefing Giuria</h2></div>' +
      '<label>Testo briefing per la giuria<textarea id="fBriefJ">' + esc(state.refereeNotes.briefingJury || '') + '</textarea></label></section>' +
      '<section class="surface page-card"><div class="card-title" style="margin-bottom:16px"><span class="material-symbols-rounded">fact_check</span><h2>Checklist operativa</h2></div>' +
      '<div class="form-grid" style="grid-template-columns:1fr auto;margin-bottom:14px"><input id="checkInput" placeholder="Nuova voce checklist"><button id="addCheckBtn" class="button primary" data-edit><span class="material-symbols-rounded">add</span>Aggiungi</button></div>' +
      '<div id="checkRows" class="checklist"></div></section>';
    $('fBriefA').oninput = e => { state.refereeNotes.briefingAthletes = e.target.value; markDirty(); };
    $('fBriefJ').oninput = e => { state.refereeNotes.briefingJury = e.target.value; markDirty(); };
    $('addCheckBtn').onclick = addChecklist;
    $('checkInput').onkeydown = e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        addChecklist();
      }
    };
    renderChecklistRows();
  }

  function addChecklist() {
    const input = $('checkInput');
    const label = input.value.trim();
    if (!label) return;
    state.refereeNotes.checklist.push({id:uid(),label,checked:false});
    input.value = '';
    markDirty();
    renderChecklistRows();
    setReadOnly();
  }

  function renderChecklistRows() {
    const box = $('checkRows');
    box.innerHTML = '';
    if (!state.refereeNotes.checklist.length) {
      box.innerHTML = '<div class="empty-state">Nessuna voce checklist.</div>';
      return;
    }
    state.refereeNotes.checklist.forEach(item => {
      const row = document.createElement('div');
      row.className = 'check-row';
      row.innerHTML =
        '<input class="check-toggle" type="checkbox" ' + (item.checked ? 'checked' : '') + '>' +
        '<input class="check-label" value="' + esc(item.label) + '">' +
        '<button class="icon-button remove" data-edit><span class="material-symbols-rounded">delete</span></button>';
      row.querySelector('.check-toggle').onchange = e => { item.checked = e.target.checked; markDirty(); };
      row.querySelector('.check-label').oninput = e => { item.label = e.target.value; markDirty(); };
      row.querySelector('.remove').onclick = () => {
        state.refereeNotes.checklist = state.refereeNotes.checklist.filter(x => x.id !== item.id);
        markDirty();
        renderChecklistRows();
        setReadOnly();
      };
      box.append(row);
    });
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
    const lang = $('printLanguage').value;
    $('pdfFrame').srcdoc = summary && window.OWPrintI18n
      ? OWPrintI18n.buildSummaryPrintHtml(
          state,
          new URL('css/print-summary.css?v=20260921-summary-layout', document.baseURI).href,
          lang
        )
      : printHtml(false, lang);
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
  if ($('mobileTopBackBtn')) $('mobileTopBackBtn').onclick = $('backEventsBtn').onclick;
  document.querySelectorAll('.side-link[data-page]').forEach(btn => btn.onclick = () => { showPage(btn.dataset.page); toggleMenu(false); });
  $('saveEventBtn').onclick = saveEvent;
  if ($('mobileSaveBtn')) $('mobileSaveBtn').onclick = saveEvent;
  $('exportEventBtn').onclick = exportCurrent;
  $('pdfBtn').onclick = () => openPrint(false);
  if ($('mobilePdfBtn')) $('mobilePdfBtn').onclick = () => openPrint(false);
  $('summaryPdfBtn').onclick = () => openPrint(true);
  if ($('mobileSummaryBtn')) $('mobileSummaryBtn').onclick = () => openPrint(true);
  $('closePdfBtn').onclick = () => $('pdfDialog').close();
  $('printPdfBtn').onclick = () => { $('pdfFrame').contentWindow.focus(); $('pdfFrame').contentWindow.print(); };
  $('printLanguage').onchange = () => {
    if (!$('pdfDialog').open) return;
    const summary = $('pdfDialog').dataset.summary === '1';
    const lang = $('printLanguage').value;
    $('pdfFrame').srcdoc = summary && window.OWPrintI18n
      ? OWPrintI18n.buildSummaryPrintHtml(
          state,
          new URL('css/print-summary.css?v=20260921-summary-layout', document.baseURI).href,
          lang
        )
      : printHtml(false, lang);
  };
  if ($('mobileMenuBtn')) $('mobileMenuBtn').onclick = () => toggleMenu(true);
  if ($('mobileScrim')) $('mobileScrim').onclick = () => toggleMenu(false);

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