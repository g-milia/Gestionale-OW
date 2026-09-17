(() => {
  const $ = id => document.getElementById(id);
  const newId = () => crypto.randomUUID();

  function slug(value) {
    return String(value || 'evento')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'evento';
  }

  function cloneWithFreshIds(source) {
    const copy = structuredClone(source);
    copy.id = newId();
    copy.createdAt = new Date().toISOString();
    copy.savedAt = copy.createdAt;
    copy.event = copy.event || {};
    copy.event.name = `${copy.event.name || 'Evento'} - Copia`;

    copy.event.athleteDepartures = (copy.event.athleteDepartures || []).map(item => ({ ...item, id: newId() }));
    copy.timeline = (copy.timeline || []).map(item => ({ ...item, id: newId() }));
    copy.refereeNotes = copy.refereeNotes || { briefingAthletes: '', briefingJury: '', checklist: [] };
    copy.refereeNotes.checklist = (copy.refereeNotes.checklist || []).map(item => ({ ...item, id: newId() }));

    const officialMap = new Map();
    copy.officials = (copy.officials || []).map(item => {
      const id = newId();
      officialMap.set(item.id, id);
      return { ...item, id };
    });

    copy.roleCategories = (copy.roleCategories || []).map(category => {
      const categoryId = newId();
      const subMap = new Map();
      const subcategories = (category.subcategories || []).map(sub => {
        const id = newId();
        subMap.set(sub.id, id);
        return { ...sub, id };
      });

      const roles = (category.roles || []).map(role => {
        const bySubcategory = {};
        Object.entries(role.officialIdsBySubcategory || {}).forEach(([oldSubId, ids]) => {
          const mappedSubId = subMap.get(oldSubId);
          if (!mappedSubId) return;
          bySubcategory[mappedSubId] = (ids || []).map(id => officialMap.get(id)).filter(Boolean);
        });

        return {
          ...role,
          id: newId(),
          officialIds: (role.officialIds || []).map(id => officialMap.get(id)).filter(Boolean),
          officialIdsBySubcategory: bySubcategory
        };
      });

      return { ...category, id: categoryId, subcategories, roles };
    });

    return copy;
  }

  function validateImportedEvent(data) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('File JSON non valido.');
    if (!data.id || typeof data.id !== 'string') throw new Error('Il file non contiene un eventId valido.');
    if (!data.event || typeof data.event !== 'object') throw new Error('Il file non contiene i dati evento.');
    return data;
  }

  async function exportCurrent() {
    try {
      const eventId = $('eventIdBridge')?.value || document.querySelector('#editorView')?.dataset.eventId || null;
      let event = null;

      if (eventId) event = await OWDatabase.getEvent(eventId);
      if (!event) {
        const title = $('pageTitle')?.textContent || '';
        const rows = await OWDatabase.listEvents();
        const match = (rows || []).find(row => row.name === title);
        if (match) event = await OWDatabase.getEvent(match.code);
      }

      if (!event) throw new Error('Nessun evento aperto da esportare.');

      const blob = new Blob([JSON.stringify(event, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${slug(event.event?.name)}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      alert(error.message || 'Errore durante l’esportazione.');
    }
  }

  async function importFile(file) {
    const text = await file.text();
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new Error('Il file selezionato non contiene JSON valido.');
    }

    let event = validateImportedEvent(parsed);
    const existing = await OWDatabase.getEvent(event.id).catch(() => null);

    if (existing) {
      const clone = confirm(`L’evento "${existing.event?.name || 'Evento'}" esiste già. Vuoi importare il file come copia indipendente?`);
      if (!clone) return null;
      event = cloneWithFreshIds(event);
    }

    return OWDatabase.importEvent(event);
  }

  function syncButtons() {
    const editorVisible = !$('editorView')?.classList.contains('hidden');
    $('exportEventBtn')?.classList.toggle('hidden', !editorVisible);
  }

  $('exportEventBtn').onclick = exportCurrent;
  $('importEventBtn').onclick = () => $('importEventInput').click();
  $('importEventInput').onchange = async event => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    try {
      const imported = await importFile(file);
      if (!imported) return;
      alert(`Evento "${imported.event?.name || 'Evento'}" importato con successo.`);
      $('refreshBtn')?.click();
    } catch (error) {
      alert(error.message || 'Errore durante l’importazione.');
    }
  };

  const observer = new MutationObserver(syncButtons);
  observer.observe(document.documentElement, { subtree: true, attributes: true, attributeFilter: ['class'] });
  syncButtons();
})();
