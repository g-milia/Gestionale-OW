(() => {
  const $ = id => document.getElementById(id);
  const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);
  const sanitizeCode = value => String(value || '').trim().replace(/[^A-Za-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '');

  let sourceCode = '';

  function remapEventIds(source, targetCode, targetName) {
    const copy = structuredClone(source);
    const now = new Date().toISOString();

    copy.id = targetCode;
    copy.createdAt = now;
    copy.savedAt = now;
    copy.event = copy.event || {};
    copy.event.name = targetName || copy.event.name || 'Nuova gara di nuoto';

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

      return {
        ...category,
        id: uid(),
        subcategories,
        roles
      };
    });

    return copy;
  }

  function openDialog(code) {
    sourceCode = code;
    $('copySourceCode').value = code;
    $('copyEventCode').value = `${code}-COPIA`;
    $('copyEventName').value = '';
    $('copyEventError').textContent = '';
    $('copyEventDialog').showModal();
  }

  async function createCopy(event) {
    event.preventDefault();
    const targetCode = sanitizeCode($('copyEventCode').value);
    const targetName = $('copyEventName').value.trim();
    const errorBox = $('copyEventError');
    const button = $('confirmCopyEventBtn');

    errorBox.textContent = '';
    if (!sourceCode) {
      errorBox.textContent = 'Evento origine non valido.';
      return;
    }
    if (!targetCode) {
      errorBox.textContent = 'Inserisci un nuovo codice evento.';
      return;
    }
    if (targetCode.toLowerCase() === sourceCode.toLowerCase()) {
      errorBox.textContent = 'Il nuovo codice deve essere diverso dall’evento origine.';
      return;
    }

    button.disabled = true;
    button.textContent = 'Copia in corso…';
    try {
      const existing = await OWDatabase.getEvent(targetCode);
      if (existing) {
        errorBox.textContent = 'Esiste già un evento con questo codice.';
        return;
      }

      const source = await OWDatabase.getEvent(sourceCode);
      if (!source) {
        errorBox.textContent = 'Evento origine non trovato.';
        return;
      }

      const payload = remapEventIds(source, targetCode, targetName || `${source.event?.name || sourceCode} - Copia`);
      await OWDatabase.saveEvent(payload);
      $('copyEventDialog').close();

      const homeButton = $('homeBtn');
      if (homeButton && !homeButton.classList.contains('hidden')) homeButton.click();
      else $('refreshBtn')?.click();

      setTimeout(() => {
        const statusNode = $('status');
        if (statusNode) statusNode.textContent = `Evento ${targetCode} copiato con successo.`;
      }, 50);
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
      const meta = card.querySelector('.event-meta');
      if (!actions || !meta || actions.querySelector('.copy')) return;
      const code = meta.textContent.trim();
      if (!code) return;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'copy';
      button.textContent = 'Copia';
      button.onclick = () => openDialog(code);
      const deleteButton = actions.querySelector('.delete');
      actions.insertBefore(button, deleteButton || null);
    });
  }

  const observer = new MutationObserver(addCopyButtonsToCards);
  observer.observe(document.documentElement, { childList: true, subtree: true });

  $('copyEventBtn').onclick = () => {
    const currentCode = $('eventCode').value.trim();
    if (currentCode) openDialog(currentCode);
  };
  $('confirmCopyEventBtn').onclick = createCopy;

  addCopyButtonsToCards();
})();
