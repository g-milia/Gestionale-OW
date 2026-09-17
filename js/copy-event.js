(() => {
  const $ = id => document.getElementById(id);
  const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

  let sourceEventId = '';

  function remapEventIds(source, targetName) {
    const copy = structuredClone(source);
    const now = new Date().toISOString();

    copy.id = '';
    copy.createdAt = now;
    copy.savedAt = now;
    copy.event = copy.event || {};
    copy.event.name = targetName || `${copy.event.name || 'Nuova gara di nuoto'} - Copia`;

    copy.event.athleteDepartures = (copy.event.athleteDepartures || []).map(item => ({ ...item, id: uid() }));
    copy.timeline = (copy.timeline || []).map(item => ({ ...item, id: uid() }));
    copy.refereeNotes = copy.refereeNotes || { briefingAthletes: '', briefingJury: '', checklist: [] };
    copy.refereeNotes.checklist = (copy.refereeNotes.checklist || []).map(item => ({ ...item, id: uid() }));

    const officialMap = new Map();
    copy.officials = (copy.officials || []).map(item => {
      const newId = uid();
      officialMap.set(item.id, newId);
      return { ...item, id: newId };
    });

    copy.roleCategories = (copy.roleCategories || []).map(category => {
      const subMap = new Map();
      const subcategories = (category.subcategories || []).map(sub => {
        const newId = uid();
        subMap.set(sub.id, newId);
        return { ...sub, id: newId };
      });

      const roles = (category.roles || []).map(role => {
        const mappedBySubcategory = {};
        Object.entries(role.officialIdsBySubcategory || {}).forEach(([oldSubId, ids]) => {
          const newSubId = subMap.get(oldSubId);
          if (!newSubId) return;
          mappedBySubcategory[newSubId] = (ids || []).map(id => officialMap.get(id)).filter(Boolean);
        });

        return {
          ...role,
          id: uid(),
          officialIds: (role.officialIds || []).map(id => officialMap.get(id)).filter(Boolean),
          officialIdsBySubcategory: mappedBySubcategory
        };
      });

      return { ...category, id: uid(), subcategories, roles };
    });

    return copy;
  }

  async function openDialog(eventId) {
    sourceEventId = eventId;
    $('copyEventError').textContent = '';
    $('copyEventName').value = '';
    try {
      const source = await OWDatabase.getEvent(eventId);
      $('copySourceName').value = source?.event?.name || 'Evento';
      $('copyEventName').value = `${source?.event?.name || 'Evento'} - Copia`;
      $('copyEventDialog').showModal();
    } catch (error) {
      const statusNode = $('status');
      if (statusNode) statusNode.textContent = error.message || 'Impossibile aprire la copia evento.';
    }
  }

  async function createCopy(event) {
    event.preventDefault();
    const targetName = $('copyEventName').value.trim();
    const errorBox = $('copyEventError');
    const button = $('confirmCopyEventBtn');

    errorBox.textContent = '';
    if (!sourceEventId) return errorBox.textContent = 'Evento origine non valido.';
    if (!targetName) return errorBox.textContent = 'Inserisci il nome del nuovo evento.';

    button.disabled = true;
    button.textContent = 'Copia in corso…';
    try {
      const source = await OWDatabase.getEvent(sourceEventId);
      if (!source) return errorBox.textContent = 'Evento origine non trovato.';

      const saved = await OWDatabase.saveEvent(remapEventIds(source, targetName));
      $('copyEventDialog').close();
      await OWApp.openEvent(saved.id);
    } catch (error) {
      errorBox.textContent = error.message || 'Errore durante la copia dell’evento.';
    } finally {
      button.disabled = false;
      button.textContent = 'Crea copia';
    }
  }

  function addCopyButtonsToCards() {
    document.querySelectorAll('#eventList .event-card').forEach(card => {
      const actions = card.querySelector('.event-actions');
      const eventId = card.dataset.eventId;
      if (!actions || !eventId || actions.querySelector('.copy')) return;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'copy';
      button.textContent = 'Copia';
      button.onclick = () => openDialog(eventId);
      const deleteButton = actions.querySelector('.delete');
      actions.insertBefore(button, deleteButton || null);
    });
  }

  const observer = new MutationObserver(addCopyButtonsToCards);
  observer.observe(document.documentElement, { childList: true, subtree: true });

  $('copyEventBtn').onclick = () => {
    const eventId = OWApp.getCurrentEventId();
    if (eventId) openDialog(eventId);
  };
  $('confirmCopyEventBtn').onclick = createCopy;

  addCopyButtonsToCards();
})();
