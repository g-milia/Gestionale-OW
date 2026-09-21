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
    $('pageContent').innerHTML =
      '<section class="surface page-card"><div class="toggle-line"><div class="card-title"><span class="material-symbols-rounded">layers</span>' +
      '<div><h2 style="margin:0">Sottocategorie ruoli</h2><div class="row-muted">Abilita assegnazioni UG distinte per sottocategoria.</div></div></div>' +
      '<label class="switch"><input id="roleSubToggle" type="checkbox" ' + (state.roleSubcategoriesEnabled ? 'checked' : '') + '><span></span></label></div></section>' +
      '<div class="card-head" style="margin:4px 0 14px"><div class="card-title"><span class="material-symbols-rounded">shield_person</span><h2>Ruoli</h2></div>' +
      '<button id="addCategoryBtn" class="button primary" data-edit><span class="material-symbols-rounded">add</span>Aggiungi categoria</button></div>' +
      '<div id="roleCategories" class="roles-stack"></div>';
    $('roleSubToggle').onchange = e => {
      state.roleSubcategoriesEnabled = e.target.checked;
      markDirty();
      renderRoleCategories();
    };
    $('addCategoryBtn').onclick = () => {
      state.roleCategories.push({id:uid(),name:'Nuova categoria',subcategories:[],roles:[]});
      markDirty();
      renderRoleCategories();
    };
    renderRoleCategories();
  }

  function renderRoleCategories() {
    const box = $('roleCategories');
    box.innerHTML = '';
    if (!state.roleCategories.length) {
      box.innerHTML = '<div class="surface empty-state">Nessuna categoria ruoli.</div>';
      setReadOnly();
      return;
    }
    state.roleCategories.forEach((category, ci) => {
      category.subcategories = rows(category.subcategories);
      category.roles = rows(category.roles);
      const card = document.createElement('section');
      card.className = 'surface role-category';
      card.innerHTML =
        '<div class="role-category-head"><input class="category-name" value="' + esc(category.name || '') + '">' +
        '<button class="icon-button cat-up" data-edit ' + (ci===0?'disabled':'') + '><span class="material-symbols-rounded">arrow_upward</span></button>' +
        '<button class="icon-button cat-down" data-edit ' + (ci===state.roleCategories.length-1?'disabled':'') + '><span class="material-symbols-rounded">arrow_downward</span></button>' +
        '<button class="button tonal add-role" data-edit><span class="material-symbols-rounded">add</span>Ruolo</button>' +
        '<button class="icon-button delete-cat" data-edit><span class="material-symbols-rounded">delete</span></button></div>' +
        (state.roleSubcategoriesEnabled ? '<div class="subcategory-box"><div class="card-head" style="margin:0"><strong>Sottocategorie</strong><button class="button ghost add-sub" data-edit>+ Aggiungi</button></div><div class="subcategory-list"></div></div>' : '') +
        '<div class="role-list"></div>';

      card.querySelector('.category-name').oninput = e => { category.name = e.target.value; markDirty(); };
      card.querySelector('.cat-up').onclick = () => moveRoleItem(state.roleCategories,ci,-1);
      card.querySelector('.cat-down').onclick = () => moveRoleItem(state.roleCategories,ci,1);
      card.querySelector('.add-role').onclick = () => {
        category.roles.push({id:uid(),name:'Nuovo ruolo',officialIds:[],officialIdsBySubcategory:{}});
        markDirty();
        renderRoleCategories();
      };
      card.querySelector('.delete-cat').onclick = () => {
        state.roleCategories.splice(ci,1);
        markDirty();
        renderRoleCategories();
      };

      if (state.roleSubcategoriesEnabled) {
        const list = card.querySelector('.subcategory-list');
        card.querySelector('.add-sub').onclick = () => {
          category.subcategories.push({id:uid(),name:''});
          markDirty();
          renderRoleCategories();
        };
        if (!category.subcategories.length) list.innerHTML = '<div class="row-muted">Nessuna sottocategoria.</div>';
        category.subcategories.forEach(sub => {
          const row = document.createElement('div');
          row.className = 'subcategory-row';
          row.innerHTML = '<input value="' + esc(sub.name || '') + '" placeholder="Nome sottocategoria"><button class="icon-button" data-edit><span class="material-symbols-rounded">delete</span></button>';
          row.querySelector('input').oninput = e => { sub.name = e.target.value; markDirty(); };
          row.querySelector('button').onclick = () => {
            category.subcategories = category.subcategories.filter(x => x.id !== sub.id);
            category.roles.forEach(role => {
              if (role.officialIdsBySubcategory) delete role.officialIdsBySubcategory[sub.id];
            });
            markDirty();
            renderRoleCategories();
          };
          list.append(row);
        });
      }

      const roleList = card.querySelector('.role-list');
      category.roles.forEach((role, ri) => {
        role.officialIds = rows(role.officialIds);
        role.officialIdsBySubcategory = role.officialIdsBySubcategory || {};
        const item = document.createElement('div');
        item.className = 'role-item';
        item.innerHTML =
          '<div><input class="role-name" value="' + esc(role.name || '') + '"></div>' +
          '<div class="assignment-groups"></div>' +
          '<div class="row-actions" data-edit><button class="icon-button role-up" ' + (ri===0?'disabled':'') + '><span class="material-symbols-rounded">arrow_upward</span></button>' +
          '<button class="icon-button role-down" ' + (ri===category.roles.length-1?'disabled':'') + '><span class="material-symbols-rounded">arrow_downward</span></button>' +
          '<button class="icon-button role-remove"><span class="material-symbols-rounded">delete</span></button></div>';
        item.querySelector('.role-name').oninput = e => { role.name = e.target.value; markDirty(); };
        item.querySelector('.role-up').onclick = () => moveRoleItem(category.roles,ri,-1);
        item.querySelector('.role-down').onclick = () => moveRoleItem(category.roles,ri,1);
        item.querySelector('.role-remove').onclick = () => {
          category.roles.splice(ri,1);
          markDirty();
          renderRoleCategories();
        };

        const groups = state.roleSubcategoriesEnabled && category.subcategories.length
          ? category.subcategories.map(sub => ({id:sub.id,label:sub.name || 'Sottocategoria'}))
          : [{id:'',label:'UG assegnati'}];
        groups.forEach(group => item.querySelector('.assignment-groups').append(buildAssignment(role,group.id,group.label)));
        roleList.append(item);
      });
      box.append(card);
    });
    setReadOnly();
  }

  function buildAssignment(role, subId, label) {
    const ids = subId ? rows(role.officialIdsBySubcategory?.[subId]) : rows(role.officialIds);
    const box = document.createElement('div');
    box.className = 'assignment-box';
    box.innerHTML = '<div class="assignment-label">' + esc(label) + '</div><div class="assignment-chips"></div><select><option value="">Assegna UG…</option></select>';
    const chips = box.querySelector('.assignment-chips');
    if (!ids.length) chips.innerHTML = '<span class="row-muted">Nessun UG assegnato</span>';
    ids.forEach(id => {
      const official = state.officials.find(o => o.id === id);
      const chip = document.createElement('span');
      chip.className = 'chip';
      chip.innerHTML = esc(official?.name || 'UG senza nome') + '<button type="button">×</button>';
      chip.querySelector('button').onclick = () => {
        setAssignmentIds(role,subId,ids.filter(x=>x!==id));
        markDirty();
        renderRoleCategories();
      };
      chips.append(chip);
    });
    const select = box.querySelector('select');
    state.officials.filter(o => !ids.includes(o.id)).forEach(o => {
      const option = document.createElement('option');
      option.value = o.id;
      option.textContent = o.name || 'UG senza nome';
      select.append(option);
    });
    select.onchange = () => {
      if (!select.value) return;
      setAssignmentIds(role,subId,[...new Set([...ids,select.value])]);
      markDirty();
      renderRoleCategories();
    };
    return box;
  }

  function setAssignmentIds(role,subId,ids) {
    if (!subId) role.officialIds = ids;
    else {
      role.officialIdsBySubcategory = role.officialIdsBySubcategory || {};
      role.officialIdsBySubcategory[subId] = ids;
    }
  }

  function moveRoleItem(array,index,direction) {
    const next = index + direction;
    if (next < 0 || next >= array.length) return;
    [array[index],array[next]] = [array[next],array[index]];
    markDirty();
    renderRoleCategories();
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