(() => {
  window.OWUI = {
    buildSummaryPrintHtml,
    setStatus(text, isError = false) {
      const node = document.getElementById("status");
      if (!node) return;
      node.textContent = text || "";
      node.style.color = isError ? "var(--danger)" : "var(--muted)";
      if (text) setTimeout(() => { if (node.textContent === text) node.textContent = ""; }, 4500);
    }
  };
  // A pure, read-only renderer. Only print fields are selected: no token or secret.
  // It consumes the current nested roleCategories[].roles[] model unchanged.
  function buildSummaryPrintHtml(state, stylesheetUrl) {
    const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[char]));
    const rows = value => Array.isArray(value) ? value.filter(Boolean) : [];
    const text = value => `<span class="summary-note-text">${escape(value)}</span>`;
    const emptyRow = (columns, message) => `<tr><td colspan="${columns}" class="summary-empty">${escape(message)}</td></tr>`;
    const event = state?.event || {};
    const timeline = rows(state?.timeline);
    const departures = rows(event.athleteDepartures);
    const categories = rows(state?.roleCategories);
    const officialNames = new Map(rows(state?.officials).map(official => [official.id, official.name || 'UG senza nome']));
    const names = ids => [...new Set(rows(ids))].map(id => officialNames.get(id) || 'UG non presente').join(' - ') || 'Nessun UG assegnato';

    const timelineHtml = timeline.map(phase => `<tr>
      <td class="summary-time">${escape(phase.time)}</td>
      <td>${text(phase.title)}</td>
      <td>${text([phase.place, phase.notes].filter(Boolean).join('\n'))}</td>
    </tr>`).join('') || emptyRow(3, 'Nessuna fase inserita.');
    const departuresHtml = departures.map(departure => `<tr>
      <td>${text(departure.name ?? departure.label)}${departure.time ? `<span class="summary-departure-time">${escape(departure.time)}</span>` : ''}</td>
      <td>${escape(departure.athletes ?? departure.count ?? '')}</td>
      <td>${text(departure.numbers)}</td><td>${text(departure.notes)}</td>
    </tr>`).join('') || emptyRow(4, 'Nessuna partenza inserita.');
    const rolesHtml = categories.map((category, index) => {
      const roles = rows(category.roles);
      const roleRows = roles.map(role => `<tr>
        <td class="summary-role-name">${text(role.name || 'Ruolo senza nome')}</td>
        <td>${text(names(role.officialIds))}</td>
      </tr>${role.notes ? `<tr><td colspan="2" class="summary-role-note"><strong>Note:</strong> ${text(role.notes)}</td></tr>` : ''}`).join('') || emptyRow(2, 'Nessun ruolo in questa categoria.');
      return `<section class="summary-category${roles.length > 18 ? ' long-category' : ''}">
        <table class="summary-category-table"><colgroup><col class="summary-role-column"><col></colgroup><thead>
          <tr><th colspan="2" class="summary-category-title"><div class="summary-category-heading">
            <span>${index + 1}. ${escape(category.name || 'Categoria senza nome')}</span>
            <span class="summary-category-count">${roles.length} ${roles.length === 1 ? 'ruolo' : 'ruoli'}</span>
          </div></th></tr>
          <tr><th scope="col">Ruolo</th><th scope="col">Ufficiali gara assegnati</th></tr>
        </thead><tbody>${roleRows}</tbody></table>
      </section>`;
    }).join('') || '<div class="summary-empty">Nessuna categoria ruoli.</div>';

    // Sections mirror the supplied operational sheet. Empty-section policy and
    // the optional subcategory editor are separate follow-up tasks.
    return `<!doctype html>
<html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escape(event.name || 'Evento')} - Stampa sintetica</title>
<link rel="stylesheet" href="${escape(stylesheetUrl)}"></head>
<body><main class="summary-sheet">
  <header class="summary-header">
    <div class="summary-title"><h1>${escape(event.name || 'Evento')}</h1>
      <div class="summary-subtitle">${escape(['Foglio ufficiali gara', event.venue, event.date].filter(Boolean).join(' \u00b7 '))}</div>
    </div>
    <div class="summary-totals"><span class="summary-total">Totale atleti: ${escape(event.athleteTotal ?? 0)}</span><span class="summary-total">Partenze: ${departures.length}</span></div>
  </header>
  ${event.notes ? `<p class="summary-event-notes summary-note-text">${escape(event.notes)}</p>` : ''}
  <div class="summary-top">
    <section class="summary-panel summary-timeline"><h2>Timeline</h2>
      <table><thead><tr><th scope="col">Ora</th><th scope="col">Titolo</th><th scope="col">Luogo / Note</th></tr></thead><tbody>${timelineHtml}</tbody></table>
    </section>
    <section class="summary-panel summary-athletes"><h2>Atleti</h2>
      <p class="summary-athlete-description summary-note-text">${escape(event.athleteDescription)}</p>
      <table class="summary-departures"><thead><tr><th scope="col">Partenza</th><th scope="col">Atleti</th><th scope="col">Numeri</th><th scope="col">Note</th></tr></thead><tbody>${departuresHtml}</tbody></table>
    </section>
  </div>
  <section class="summary-panel summary-roles"><h2>Ruoli</h2>${rolesHtml}</section>
  <section class="summary-panel summary-path-notes"><h2>Note percorso</h2><div class="summary-note-text">${escape(event.pathNotes || '-')}</div></section>
</main></body></html>`;
  }
})();
