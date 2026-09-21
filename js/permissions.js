(() => {
  const $ = id => document.getElementById(id);
  let globalAccess = { isAdmin: false, canCreate: false, canImport: false };
  let eventAccess = null;
  let currentEventId = '';
  let applying = false;

  const roleLabel = role => ({
    admin: 'Admin',
    responsabile: 'Responsabile',
    visualizzatore: 'Visualizzatore'
  }[role] || 'Nessun accesso');

  function setHidden(id, hidden) {
    const node = $(id);
    if (node) node.classList.toggle('hidden', !!hidden);
  }

  function applyGlobalAccess() {
    setHidden('newEventBtn', !globalAccess.canCreate);
    setHidden('importEventBtn', !globalAccess.canImport);
    document.querySelectorAll('#eventList .delete, #eventList .copy').forEach(button => {
      button.classList.toggle('hidden', !globalAccess.isAdmin);
    });
  }

  function setPermissionDisabled(node, disabled) {
    if (!node) return;
    if (disabled) {
      if (!node.disabled) {
        node.dataset.permissionDisabled = '1';
        node.disabled = true;
      }
    } else if (node.dataset.permissionDisabled === '1') {
      node.disabled = false;
      delete node.dataset.permissionDisabled;
    }
  }

  function applyEventAccess() {
    const access = eventAccess || {
      canEdit: !!globalAccess.isAdmin,
      canDelete: !!globalAccess.isAdmin,
      canManagePermissions: !!globalAccess.isAdmin,
      canExport: !!globalAccess.isAdmin,
      canPrint: true
    };

    setHidden('permissionsNavBtn', !access.canManagePermissions || !currentEventId);
    setHidden('saveEventBtn', !access.canEdit);
    setHidden('copyEventBtn', !globalAccess.isAdmin || !currentEventId);
    setHidden('exportEventBtn', !access.canExport || !currentEventId);
    setHidden('pdfBtn', !access.canPrint);
    setHidden('summaryPdfBtn', !access.canPrint);

    const editor = $('editorView');
    if (editor) {
      editor.querySelectorAll('input, textarea, select, button:not(.nav-btn)').forEach(node => {
        setPermissionDisabled(node, !access.canEdit);
      });
    }

    if (!access.canManagePermissions && $('view-permissions') && !$('view-permissions').classList.contains('hidden')) {
      document.querySelector('.nav-btn[data-view="evento"]')?.click();
    }
  }

  async function loadPermissions() {
    const box = $('permissionsList');
    if (!box || !currentEventId || !eventAccess?.canManagePermissions) return;
    box.innerHTML = '<div class="empty">Caricamento permessi…</div>';
    try {
      const rows = await OWDatabase.listEventPermissions(currentEventId);
      box.innerHTML = '';
      (rows || []).forEach(user => {
        const row = document.createElement('div');
        row.className = 'item permission-row';
        const isAdmin = user.role === 'admin';
        row.innerHTML = `
          <div class="item-main">
            <div class="item-title">${escapeHtml(user.display_name || user.email || 'Utente')}</div>
            <div class="item-meta">${escapeHtml(user.email || '')}</div>
          </div>
          <div class="item-actions">
            <select class="permission-role" ${isAdmin ? 'disabled' : ''}>
              <option value="" ${!user.role ? 'selected' : ''}>Nessun accesso</option>
              <option value="responsabile" ${user.role === 'responsabile' ? 'selected' : ''}>Responsabile</option>
              <option value="visualizzatore" ${user.role === 'visualizzatore' ? 'selected' : ''}>Visualizzatore</option>
              ${isAdmin ? '<option value="admin" selected>Admin</option>' : ''}
            </select>
          </div>
        `;
        const select = row.querySelector('select');
        if (!isAdmin) {
          select.onchange = async () => {
            const previous = user.role || '';
            select.disabled = true;
            try {
              await OWDatabase.setEventPermission(currentEventId, user.user_id, select.value || null);
              user.role = select.value || null;
              OWUI.setStatus(`Permesso aggiornato: ${roleLabel(user.role)}.`);
            } catch (error) {
              select.value = previous;
              OWUI.setStatus(error.message || 'Errore durante l’aggiornamento dei permessi.', true);
            } finally {
              select.disabled = false;
            }
          };
        }
        box.append(row);
      });
      if (!rows?.length) box.innerHTML = '<div class="empty">Nessun utente abilitato.</div>';
    } catch (error) {
      box.innerHTML = `<div class="empty error">${escapeHtml(error.message || 'Errore nel caricamento dei permessi.')}</div>`;
    }
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    }[char]));
  }

  async function refreshEventAccess() {
    const id = window.OWApp?.getCurrentEventId?.() || '';
    currentEventId = id;
    if (!id) {
      eventAccess = globalAccess.isAdmin ? {
        role: 'admin',
        canRead: true,
        canEdit: true,
        canDelete: true,
        canManagePermissions: true,
        canExport: true,
        canPrint: true
      } : null;
      applyEventAccess();
      return;
    }

    try {
      eventAccess = await OWDatabase.eventAccess(id);
    } catch (error) {
      eventAccess = null;
      OWUI.setStatus(error.message || 'Impossibile verificare i permessi evento.', true);
    }
    applyEventAccess();
  }

  async function initPermissions() {
    try {
      globalAccess = await OWDatabase.currentUserAccess();
    } catch (error) {
      OWUI.setStatus(error.message || 'Impossibile verificare i permessi utente.', true);
    }
    applyGlobalAccess();
    await refreshEventAccess();

    $('permissionsNavBtn')?.addEventListener('click', loadPermissions);

    const observer = new MutationObserver(async () => {
      if (applying) return;
      applying = true;
      try {
        applyGlobalAccess();

        const editorVisible = !$('editorView')?.classList.contains('hidden');
        const id = window.OWApp?.getCurrentEventId?.() || '';
        if (editorVisible && id !== currentEventId) {
          await refreshEventAccess();
        } else if (editorVisible) {
          applyEventAccess();
        }

        if ($('view-permissions') && !$('view-permissions').classList.contains('hidden')) {
          await loadPermissions();
        }
      } finally {
        applying = false;
      }
    });

    observer.observe(document.documentElement, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['class']
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPermissions, { once: true });
  } else {
    initPermissions();
  }
})();