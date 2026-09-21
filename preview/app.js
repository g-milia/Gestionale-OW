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
    $('pageContent').innerHTML =
      '<section class="surface page-card"><div class="card-head"><div class="card-title"><span class="material-symbols-rounded">groups</span><h2>Ufficiali gara</h2></div>' +
      '<button id="addOfficialBtn" class="button primary" data-edit><span class="material-symbols-rounded">person_add</span>Aggiungi UG</button></div>' +
      '<div id="officialRows" class="data-list"></div></section>';
    $('addOfficialBtn').onclick = () => editOfficial();
    renderOfficialRows();
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
      row.className = 'data-row official-row';
      row.innerHTML =
        '<div class="row-title">' + esc(item.name || 'UG senza nome') + '</div>' +
        '<div class="row-muted">' + esc(item.notes || '') + '</div>' +
        '<div class="row-actions" data-edit><button class="icon-button edit"><span class="material-symbols-rounded">edit</span></button>' +
        '<button class="icon-button remove"><span class="material-symbols-rounded">delete</span></button></div>';
      row.querySelector('.edit').onclick = () => editOfficial(item.id);
      row.querySelector('.remove').onclick = () => {
        state.officials = state.officials.filter(x => x.id !== item.id);
        state.roleCategories.forEach(category => rows(category.roles).forEach(role => {
          role.officialIds = rows(role.officialIds).filter(id => id !== item.id);
          Object.keys(role.officialIdsBySubcategory || {}).forEach(key => {
            role.officialIdsBySubcategory[key] = rows(role.officialIdsBySubcategory[key]).filter(id => id !== item.id);
          });
        }));
        markDirty();
        renderOfficialRows();
        setReadOnly();
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
      if (original) Object.assign(original,item);
      else state.officials.push(item);
      markDirty();
      renderOfficialRows();
      setReadOnly();
    });
  }

  function renderRoles() {
    if (!selectedRoleCategoryId || !state.roleCategories.some(category => category.id === selectedRoleCategoryId)) {
      selectedRoleCategoryId = state.roleCategories[0]?.id || null;
    }

    $('pageContent').innerHTML =
      '<div class="roles-master-detail">' +
        '<aside class="surface roles-master">' +
          '<div class="roles-master-head">' +
            '<div><h2>Categorie</h2><div class="row-muted">Seleziona una categoria per gestirne i ruoli.</div></div>' +
            '<button id="addCategoryBtn" class="icon-button" data-edit title="Nuova categoria"><span class="material-symbols-rounded">add</span></button>' +
          '</div>' +
          '<div id="roleCategoryNav" class="role-category-nav"></div>' +
        '</aside>' +
        '<section id="roleCategoryDetail" class="roles-detail"></section>' +
      '</div>';

    $('addCategoryBtn').onclick = () => {
      const category = {id:uid(),name:'Nuova categoria',subcategories:[],roles:[]};
      state.roleCategories.push(category);
      selectedRoleCategoryId = category.id;
      markDirty();
      renderRoles();
    };

    renderRoleCategoryNav();
    renderSelectedRoleCategory();
    setReadOnly();
  }

  function countRoleAssignments(category) {
    let assigned = 0;
    let empty = 0;
    rows(category.roles).forEach(role => {
      let ids = [];
      if (state.roleSubcategoriesEnabled && rows(category.subcategories).length) {
        rows(category.subcategories).forEach(sub => {
          ids.push(...rows(role.officialIdsBySubcategory?.[sub.id]));
        });
      } else {
        ids = rows(role.officialIds);
      }
      const unique = [...new Set(ids)];
      if (unique.length) assigned += unique.length;
      else empty += 1;
    });
    return {assigned, empty};
  }

  function renderRoleCategoryNav() {
    const nav = $('roleCategoryNav');
    nav.innerHTML = '';
    if (!state.roleCategories.length) {
      nav.innerHTML = '<div class="empty-state compact-empty">Nessuna categoria.</div>';
      return;
    }

    state.roleCategories.forEach((category,index) => {
      const stats = countRoleAssignments(category);
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'role-category-nav-item' + (category.id === selectedRoleCategoryId ? ' active' : '');
      button.innerHTML =
        '<span class="role-category-index">' + String(index + 1).padStart(2,'0') + '</span>' +
        '<span class="role-category-nav-copy"><strong>' + esc(category.name || 'Categoria') + '</strong>' +
        '<small>' + rows(category.roles).length + ' ruoli' + (stats.empty ? ' · ' + stats.empty + ' senza UG' : '') + '</small></span>' +
        '<span class="material-symbols-rounded">chevron_right</span>';
      button.onclick = () => {
        selectedRoleCategoryId = category.id;
        renderRoleCategoryNav();
        renderSelectedRoleCategory();
        setReadOnly();
      };
      nav.append(button);
    });
  }

  function renderSelectedRoleCategory() {
    const detail = $('roleCategoryDetail');
    const category = state.roleCategories.find(item => item.id === selectedRoleCategoryId);

    if (!category) {
      detail.innerHTML =
        '<section class="surface empty-role-detail">' +
          '<span class="material-symbols-rounded">shield_person</span>' +
          '<h2>Nessuna categoria selezionata</h2>' +
          '<p>Aggiungi una categoria per iniziare.</p>' +
        '</section>';
      return;
    }

    category.subcategories = rows(category.subcategories);
    category.roles = rows(category.roles);
    const categoryIndex = state.roleCategories.indexOf(category);

    detail.innerHTML =
      '<section class="surface role-detail-card">' +
        '<div class="role-detail-head">' +
          '<div class="role-detail-title">' +
            '<span class="role-category-index large">' + String(categoryIndex + 1).padStart(2,'0') + '</span>' +
            '<div><input id="selectedCategoryName" class="inline-title-input" value="' + esc(category.name || '') + '">' +
            '<div class="row-muted">' + category.roles.length + ' ruoli in questa categoria</div></div>' +
          '</div>' +
          '<div class="row-actions" data-edit>' +
            '<button id="categoryUpBtn" class="icon-button" ' + (categoryIndex === 0 ? 'disabled' : '') + ' title="Sposta su"><span class="material-symbols-rounded">arrow_upward</span></button>' +
            '<button id="categoryDownBtn" class="icon-button" ' + (categoryIndex === state.roleCategories.length - 1 ? 'disabled' : '') + ' title="Sposta giù"><span class="material-symbols-rounded">arrow_downward</span></button>' +
            '<button id="deleteCategoryBtn" class="icon-button danger-icon" title="Elimina categoria"><span class="material-symbols-rounded">delete</span></button>' +
          '</div>' +
        '</div>' +

        '<div class="role-subcategory-bar">' +
          '<div><strong>Sottocategorie</strong><div class="row-muted">Assegna UG distinti per sottocategoria quando necessario.</div></div>' +
          '<label class="switch"><input id="roleSubToggle" type="checkbox" ' + (state.roleSubcategoriesEnabled ? 'checked' : '') + '><span></span></label>' +
        '</div>' +

        '<div id="subcategoryManager"></div>' +

        '<div class="roles-section-head">' +
          '<div><h3>Ruoli</h3><div class="row-muted">Ogni card mostra subito le assegnazioni correnti.</div></div>' +
          '<button id="addRoleBtn" class="button primary" data-edit><span class="material-symbols-rounded">add</span>Aggiungi ruolo</button>' +
        '</div>' +
        '<div id="selectedRoleList" class="selected-role-list"></div>' +
      '</section>';

    $('selectedCategoryName').oninput = e => {
      category.name = e.target.value;
      markDirty();
      renderRoleCategoryNav();
    };

    $('categoryUpBtn').onclick = () => moveSelectedCategory(-1);
    $('categoryDownBtn').onclick = () => moveSelectedCategory(1);
    $('deleteCategoryBtn').onclick = () => {
      if (!confirm('Eliminare questa categoria e tutti i suoi ruoli?')) return;
      state.roleCategories = state.roleCategories.filter(item => item.id !== category.id);
      selectedRoleCategoryId = state.roleCategories[Math.max(0, categoryIndex - 1)]?.id || state.roleCategories[0]?.id || null;
      markDirty();
      renderRoles();
    };

    $('roleSubToggle').onchange = e => {
      state.roleSubcategoriesEnabled = e.target.checked;
      markDirty();
      renderSelectedRoleCategory();
      setReadOnly();
    };

    $('addRoleBtn').onclick = () => {
      category.roles.push({id:uid(),name:'Nuovo ruolo',officialIds:[],officialIdsBySubcategory:{}});
      markDirty();
      renderSelectedRoleCategory();
      renderRoleCategoryNav();
      setReadOnly();
    };

    renderSubcategoryManager(category);
    renderSelectedRoleList(category);
  }

  function moveSelectedCategory(direction) {
    const index = state.roleCategories.findIndex(item => item.id === selectedRoleCategoryId);
    const next = index + direction;
    if (index < 0 || next < 0 || next >= state.roleCategories.length) return;
    [state.roleCategories[index],state.roleCategories[next]] = [state.roleCategories[next],state.roleCategories[index]];
    markDirty();
    renderRoleCategoryNav();
    renderSelectedRoleCategory();
    setReadOnly();
  }

  function renderSubcategoryManager(category) {
    const box = $('subcategoryManager');
    if (!state.roleSubcategoriesEnabled) {
      box.innerHTML = '';
      return;
    }

    box.innerHTML =
      '<div class="subcategory-chip-row" id="subcategoryChips"></div>' +
      '<button id="addSubcategoryBtn" class="button ghost compact-button" data-edit><span class="material-symbols-rounded">add</span>Aggiungi sottocategoria</button>';

    const chips = $('subcategoryChips');
    if (!category.subcategories.length) {
      chips.innerHTML = '<span class="row-muted">Nessuna sottocategoria configurata.</span>';
    }

    category.subcategories.forEach(sub => {
      const chip = document.createElement('div');
      chip.className = 'editable-subcategory-chip';
      chip.innerHTML =
        '<input value="' + esc(sub.name || '') + '" placeholder="Sottocategoria">' +
        '<button type="button" data-edit title="Elimina"><span class="material-symbols-rounded">close</span></button>';
      chip.querySelector('input').oninput = e => {
        sub.name = e.target.value;
        markDirty();
        renderSelectedRoleList(category);
      };
      chip.querySelector('button').onclick = () => {
        category.subcategories = category.subcategories.filter(item => item.id !== sub.id);
        category.roles.forEach(role => {
          if (role.officialIdsBySubcategory) delete role.officialIdsBySubcategory[sub.id];
        });
        markDirty();
        renderSubcategoryManager(category);
        renderSelectedRoleList(category);
        setReadOnly();
      };
      chips.append(chip);
    });

    $('addSubcategoryBtn').onclick = () => {
      category.subcategories.push({id:uid(),name:''});
      markDirty();
      renderSubcategoryManager(category);
      renderSelectedRoleList(category);
      setReadOnly();
    };
  }

  function renderSelectedRoleList(category) {
    const list = $('selectedRoleList');
    list.innerHTML = '';

    if (!category.roles.length) {
      list.innerHTML = '<div class="empty-state compact-empty">Nessun ruolo in questa categoria.</div>';
      return;
    }

    category.roles.forEach((role,index) => {
      role.officialIds = rows(role.officialIds);
      role.officialIdsBySubcategory = role.officialIdsBySubcategory || {};
      const card = document.createElement('article');
      card.className = 'modern-role-card';

      const groups = state.roleSubcategoriesEnabled && category.subcategories.length
        ? category.subcategories.map(sub => ({id:sub.id,label:sub.name || 'Sottocategoria'}))
        : [{id:'',label:'UG assegnati'}];

      let totalAssigned = 0;
      groups.forEach(group => {
        const ids = group.id ? rows(role.officialIdsBySubcategory[group.id]) : rows(role.officialIds);
        totalAssigned += new Set(ids).size;
      });

      card.innerHTML =
        '<div class="modern-role-head">' +
          '<div class="modern-role-name-wrap">' +
            '<span class="material-symbols-rounded drag-handle">drag_indicator</span>' +
            '<div><input class="modern-role-name" value="' + esc(role.name || '') + '">' +
            '<div class="role-assignment-summary ' + (totalAssigned ? '' : 'missing') + '">' +
              (totalAssigned ? totalAssigned + ' UG assegnati' : 'Nessun UG assegnato') +
            '</div></div>' +
          '</div>' +
          '<div class="row-actions" data-edit>' +
            '<button class="icon-button role-up" ' + (index===0?'disabled':'') + ' title="Sposta su"><span class="material-symbols-rounded">arrow_upward</span></button>' +
            '<button class="icon-button role-down" ' + (index===category.roles.length-1?'disabled':'') + ' title="Sposta giù"><span class="material-symbols-rounded">arrow_downward</span></button>' +
            '<button class="icon-button role-remove danger-icon" title="Elimina"><span class="material-symbols-rounded">delete</span></button>' +
          '</div>' +
        '</div>' +
        '<div class="role-assignment-grid"></div>';

      card.querySelector('.modern-role-name').oninput = e => {
        role.name = e.target.value;
        markDirty();
      };
      card.querySelector('.role-up').onclick = () => moveRoleWithinCategory(category,index,-1);
      card.querySelector('.role-down').onclick = () => moveRoleWithinCategory(category,index,1);
      card.querySelector('.role-remove').onclick = () => {
        category.roles.splice(index,1);
        markDirty();
        renderSelectedRoleList(category);
        renderRoleCategoryNav();
        setReadOnly();
      };

      const assignmentGrid = card.querySelector('.role-assignment-grid');
      groups.forEach(group => assignmentGrid.append(buildModernAssignment(category,role,group.id,group.label)));

      list.append(card);
    });
    setReadOnly();
  }

  function moveRoleWithinCategory(category,index,direction) {
    const next = index + direction;
    if (next < 0 || next >= category.roles.length) return;
    [category.roles[index],category.roles[next]] = [category.roles[next],category.roles[index]];
    markDirty();
    renderSelectedRoleList(category);
    setReadOnly();
  }

  function buildModernAssignment(category,role,subId,label) {
    const ids = subId ? rows(role.officialIdsBySubcategory?.[subId]) : rows(role.officialIds);
    const box = document.createElement('section');
    box.className = 'modern-assignment-box';
    box.innerHTML =
      '<div class="modern-assignment-head"><strong>' + esc(label) + '</strong>' +
      '<button type="button" class="assign-official-button" data-edit><span class="material-symbols-rounded">person_add</span>Assegna UG</button></div>' +
      '<div class="assignment-chips"></div>' +
      '<div class="official-picker-slot"></div>';

    const chips = box.querySelector('.assignment-chips');
    if (!ids.length) chips.innerHTML = '<span class="no-assignment">Nessun UG assegnato</span>';

    ids.forEach(id => {
      const official = state.officials.find(item => item.id === id);
      const chip = document.createElement('span');
      chip.className = 'official-chip';
      chip.innerHTML =
        '<span class="official-chip-avatar">' + esc(initials(official?.name || 'UG')) + '</span>' +
        '<span>' + esc(official?.name || 'UG senza nome') + '</span>' +
        '<button type="button" data-edit aria-label="Rimuovi">×</button>';
      chip.querySelector('button').onclick = () => {
        setAssignmentIds(role,subId,ids.filter(value => value !== id));
        markDirty();
        renderSelectedRoleList(category);
        renderRoleCategoryNav();
        setReadOnly();
      };
      chips.append(chip);
    });

    box.querySelector('.assign-official-button').onclick = () => {
      renderOfficialPicker(box.querySelector('.official-picker-slot'),category,role,subId,ids);
    };
    return box;
  }

  function renderOfficialPicker(slot,category,role,subId,currentIds) {
    slot.innerHTML =
      '<div class="official-picker">' +
        '<div class="official-picker-search"><span class="material-symbols-rounded">search</span><input type="search" placeholder="Cerca ufficiale gara"></div>' +
        '<div class="official-picker-list"></div>' +
      '</div>';

    const input = slot.querySelector('input');
    const list = slot.querySelector('.official-picker-list');

    const draw = () => {
      const query = input.value.trim().toLowerCase();
      const candidates = state.officials.filter(official =>
        !currentIds.includes(official.id) &&
        (!query || String(official.name || '').toLowerCase().includes(query))
      );
      list.innerHTML = '';
      if (!candidates.length) {
        list.innerHTML = '<div class="official-picker-empty">Nessun UG disponibile.</div>';
        return;
      }
      candidates.forEach(official => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'official-picker-item';
        button.innerHTML =
          '<span class="official-chip-avatar">' + esc(initials(official.name || 'UG')) + '</span>' +
          '<span><strong>' + esc(official.name || 'UG senza nome') + '</strong>' +
          (official.notes ? '<small>' + esc(official.notes) + '</small>' : '') +
          '</span><span class="material-symbols-rounded">add</span>';
        button.onclick = () => {
          setAssignmentIds(role,subId,[...new Set([...currentIds,official.id])]);
          markDirty();
          renderSelectedRoleList(category);
          renderRoleCategoryNav();
          setReadOnly();
        };
        list.append(button);
      });
    };

    input.oninput = draw;
    draw();
    input.focus();
  }

  function setAssignmentIds(role,subId,ids) {
    if (!subId) role.officialIds = ids;
    else {
      role.officialIdsBySubcategory = role.officialIdsBySubcategory || {};
      role.officialIdsBySubcategory[subId] = ids;
    }
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