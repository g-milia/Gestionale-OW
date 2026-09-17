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

  function buildSummaryPrintHtml(state, stylesheetUrl) {
    const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
    const rows = value => Array.isArray(value) ? value.filter(Boolean) : [];
    const text = value => `<span class="summary-note-text">${escape(value)}</span>`;
    const event = state?.event || {};
    const timeline = rows(state?.timeline);
    const departures = rows(event.athleteDepartures);
    const categories = rows(state?.roleCategories).filter(category => rows(category.roles).length);
    const briefingAthletes = String(state?.refereeNotes?.briefingAthletes || '').trim();
    const briefingJury = String(state?.refereeNotes?.briefingJury || '').trim();
    const officialNames = new Map(rows(state?.officials).map(official => [official.id, official.name || 'UG senza nome']));
    const names = ids => [...new Set(rows(ids))].map(id => officialNames.get(id) || 'UG non presente').join(' - ');

    const timelineHtml = timeline.map(phase => `<tr><td class="summary-time">${escape(phase.time)}</td><td>${text(phase.title)}</td><td>${text([phase.place, phase.notes].filter(Boolean).join('\n'))}</td></tr>`).join('');
    const departuresHtml = departures.map(departure => `<tr><td>${text(departure.name ?? departure.label)}${departure.time ? `<span class="summary-departure-time">${escape(departure.time)}</span>` : ''}</td><td>${escape(departure.athletes ?? departure.count ?? '')}</td><td>${text(departure.numbers)}</td><td>${text(departure.notes)}</td></tr>`).join('');

    const rolesHtml = categories.map((category, index) => {
      const roles = rows(category.roles);
      const subs = state?.roleSubcategoriesEnabled ? rows(category.subcategories) : [];
      const countSuffix = subs.length ? ` / ${subs.length} ${subs.length === 1 ? 'sottocategoria' : 'sottocategorie'}` : '';
      if (subs.length) {
        const headers = subs.map(sub => `<th scope="col">${escape(sub.name || 'Sottocategoria')}</th>`).join('');
        const body = roles.map(role => `<tr><td class="summary-role-name">${text(role.name || 'Ruolo senza nome')}</td>${subs.map(sub => `<td>${text(names((role.officialIdsBySubcategory || {})[sub.id] || []))}</td>`).join('')}</tr>${role.notes ? `<tr><td colspan="${subs.length + 1}" class="summary-role-note"><strong>Note:</strong> ${text(role.notes)}</td></tr>` : ''}`).join('');
        return `<section class="summary-category${roles.length > 18 ? ' long-category' : ''}"><table class="summary-category-table summary-subcategory-table"><thead><tr><th colspan="${subs.length + 1}" class="summary-category-title"><div class="summary-category-heading"><span>${index + 1}. ${escape(category.name || 'Categoria senza nome')}</span><span class="summary-category-count">${roles.length} ${roles.length === 1 ? 'ruolo' : 'ruoli'}${countSuffix}</span></div></th></tr><tr><th scope="col">Ruolo</th>${headers}</tr></thead><tbody>${body}</tbody></table></section>`;
      }
      const body = roles.map(role => `<tr><td class="summary-role-name">${text(role.name || 'Ruolo senza nome')}</td><td>${text(names(role.officialIds || []))}</td></tr>${role.notes ? `<tr><td colspan="2" class="summary-role-note"><strong>Note:</strong> ${text(role.notes)}</td></tr>` : ''}`).join('');
      return `<section class="summary-category${roles.length > 18 ? ' long-category' : ''}"><table class="summary-category-table"><colgroup><col class="summary-role-column"><col></colgroup><thead><tr><th colspan="2" class="summary-category-title"><div class="summary-category-heading"><span>${index + 1}. ${escape(category.name || 'Categoria senza nome')}</span><span class="summary-category-count">${roles.length} ${roles.length === 1 ? 'ruolo' : 'ruoli'}</span></div></th></tr><tr><th scope="col">Ruolo</th><th scope="col">Ufficiali gara assegnati</th></tr></thead><tbody>${body}</tbody></table></section>`;
    }).join('');

    const timelineSection = timeline.length ? `<section class="summary-panel summary-timeline"><h2>Timeline</h2><table><thead><tr><th scope="col">Ora</th><th scope="col">Titolo</th><th scope="col">Luogo / Note</th></tr></thead><tbody>${timelineHtml}</tbody></table></section>` : '';
    const athleteSection = (departures.length || String(event.athleteDescription || '').trim()) ? `<section class="summary-panel summary-athletes"><h2>Atleti</h2>${event.athleteDescription ? `<p class="summary-athlete-description summary-note-text">${escape(event.athleteDescription)}</p>` : ''}${departures.length ? `<table class="summary-departures"><thead><tr><th scope="col">Partenza</th><th scope="col">Atleti</th><th scope="col">Numeri</th><th scope="col">Note</th></tr></thead><tbody>${departuresHtml}</tbody></table>` : ''}</section>` : '';
    const briefingSection = (briefingAthletes || briefingJury) ? `<section class="summary-panel summary-briefing"><h2>Briefing</h2>${briefingAthletes ? `<h3>Atleti</h3><div class="summary-note-text">${escape(briefingAthletes)}</div>` : ''}${briefingJury ? `<h3>Giuria</h3><div class="summary-note-text">${escape(briefingJury)}</div>` : ''}</section>` : '';
    const pathSection = String(event.pathNotes || '').trim() ? `<section class="summary-panel summary-path-notes"><h2>Note percorso</h2><div class="summary-note-text">${escape(event.pathNotes)}</div></section>` : '';

    return `<!doctype html><html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(event.name || 'Evento')} - Stampa sintetica</title><link rel="stylesheet" href="${escape(stylesheetUrl)}"></head><body><main class="summary-sheet"><header class="summary-header"><div class="summary-title"><h1>${escape(event.name || 'Evento')}</h1><div class="summary-subtitle">${escape(['Foglio ufficiali gara', event.venue, event.date].filter(Boolean).join(' · '))}</div></div><div class="summary-totals"><span class="summary-total">Totale atleti: ${escape(event.athleteTotal ?? 0)}</span><span class="summary-total">Partenze: ${departures.length}</span></div></header>${event.notes ? `<p class="summary-event-notes summary-note-text">${escape(event.notes)}</p>` : ''}${timelineSection || athleteSection ? `<div class="summary-top ${timelineSection && athleteSection ? '' : 'summary-top-single'}">${timelineSection}${athleteSection}</div>` : ''}${rolesHtml ? `<section class="summary-panel summary-roles"><h2>Ruoli</h2>${rolesHtml}</section>` : ''}${briefingSection}${pathSection}</main></body></html>`;
  }
})();
