(() => {
  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const rows = value => Array.isArray(value) ? value.filter(Boolean) : [];

  const I18N = {
    it: {
      previewPdf: 'Anteprima PDF',
      summaryPrint: 'Stampa sintetica',
      printPdf: 'Stampa / PDF',
      hint: 'Formato consigliato: A4 verticale, scala 100%, intestazioni e piè di pagina del browser disattivati. I contenuti lunghi proseguono su più pagine.',
      event: 'Evento',
      athletes: 'Atleti',
      athlete: 'Atleta',
      totalAthletes: 'Totale atleti',
      starts: 'Partenze',
      start: 'Partenza',
      timeline: 'Timeline',
      time: 'Ora',
      title: 'Titolo',
      placeNotes: 'Luogo / Note',
      officials: 'Ufficiali Gara',
      roles: 'Ruoli',
      role: 'Ruolo',
      assignedOfficials: 'Ufficiali gara assegnati',
      briefing: 'Briefing',
      athleteBriefing: 'Atleti',
      juryBriefing: 'Giuria',
      courseNotes: 'Note percorso',
      numbers: 'Numeri',
      notes: 'Note',
      subcategory: 'Sottocategoria',
      subcategoriesSingular: 'sottocategoria',
      subcategoriesPlural: 'sottocategorie',
      roleSingular: 'ruolo',
      rolePlural: 'ruoli',
      unnamedOfficial: 'UG senza nome',
      missingOfficial: 'UG non presente',
      unnamedRole: 'Ruolo senza nome',
      unnamedCategory: 'Categoria senza nome',
      officialsSheet: 'Foglio ufficiali gara',
      summaryTitle: 'Stampa sintetica'
    },
    en: {
      previewPdf: 'PDF preview',
      summaryPrint: 'Summary print',
      printPdf: 'Print / PDF',
      hint: 'Recommended format: A4 portrait, 100% scale, browser headers and footers disabled. Long content continues on additional pages.',
      event: 'Event',
      athletes: 'Athletes',
      athlete: 'Athlete',
      totalAthletes: 'Total athletes',
      starts: 'Starts',
      start: 'Start',
      timeline: 'Timeline',
      time: 'Time',
      title: 'Title',
      placeNotes: 'Location / Notes',
      officials: 'Officials',
      roles: 'Roles',
      role: 'Role',
      assignedOfficials: 'Assigned officials',
      briefing: 'Briefing',
      athleteBriefing: 'Athletes',
      juryBriefing: 'Jury',
      courseNotes: 'Course notes',
      numbers: 'Numbers',
      notes: 'Notes',
      subcategory: 'Subcategory',
      subcategoriesSingular: 'subcategory',
      subcategoriesPlural: 'subcategories',
      roleSingular: 'role',
      rolePlural: 'roles',
      unnamedOfficial: 'Unnamed official',
      missingOfficial: 'Official not found',
      unnamedRole: 'Unnamed role',
      unnamedCategory: 'Unnamed category',
      officialsSheet: 'Officials sheet',
      summaryTitle: 'Summary print'
    }
  };

  const dict = lang => I18N[lang] || I18N.it;

  function formatDate(value, lang) {
    if (!value) return '';
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value));
    if (!match) return String(value);
    const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
    return new Intl.DateTimeFormat(lang === 'en' ? 'en-GB' : 'it-IT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }).format(date);
  }

  function officialNames(state, ids, t) {
    const map = new Map(rows(state?.officials).map(official => [official.id, official.name || t.unnamedOfficial]));
    return [...new Set(rows(ids))].map(id => map.get(id) || t.missingOfficial).join(' - ');
  }

  function buildFullPrintHtml(state, lang) {
    const t = dict(lang);
    const event = state?.event || {};
    const timeline = rows(state?.timeline);
    const categories = rows(state?.roleCategories);
    const officials = rows(state?.officials);
    const ba = String(state?.refereeNotes?.briefingAthletes || '').trim();
    const bg = String(state?.refereeNotes?.briefingJury || '').trim();

    const timelineHtml = timeline.length
      ? `<h2>${t.timeline}</h2><table>${timeline.map(x => `<tr><td>${esc(x.time)}</td><td><b>${esc(x.title)}</b><br>${esc(x.place)}</td><td>${esc(x.notes)}</td></tr>`).join('')}</table>`
      : '';

    const officialsHtml = officials.length
      ? `<h2>${t.officials}</h2>${officials.map(o => `<p><b>${esc(o.name)}</b>${o.notes ? ` ${esc(o.notes)}` : ''}</p>`).join('')}`
      : '';

    const rolesHtml = categories.map((category, index) => {
      const roleRows = rows(category.roles);
      const subs = state?.roleSubcategoriesEnabled ? rows(category.subcategories) : [];
      if (!roleRows.length) return '';
      if (subs.length) {
        return `<h3>${index + 1}. ${esc(category.name || t.unnamedCategory)}</h3><table><thead><tr><th>${t.role}</th>${subs.map(s => `<th>${esc(s.name || t.subcategory)}</th>`).join('')}</tr></thead><tbody>${roleRows.map(role => `<tr><td><b>${esc(role.name || t.unnamedRole)}</b></td>${subs.map(s => `<td>${esc(officialNames(state, (role.officialIdsBySubcategory || {})[s.id] || [], t))}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
      }
      return `<h3>${index + 1}. ${esc(category.name || t.unnamedCategory)}</h3><table><thead><tr><th>${t.role}</th><th>${t.assignedOfficials}</th></tr></thead><tbody>${roleRows.map(role => `<tr><td><b>${esc(role.name || t.unnamedRole)}</b></td><td>${esc(officialNames(state, role.officialIds || [], t))}</td></tr>`).join('')}</tbody></table>`;
    }).join('');

    const briefingHtml = (ba || bg)
      ? `<h2>${t.briefing}</h2>${ba ? `<h3>${t.athleteBriefing}</h3><p class="muted">${esc(ba)}</p>` : ''}${bg ? `<h3>${t.juryBriefing}</h3><p class="muted">${esc(bg)}</p>` : ''}`
      : '';

    const displayDate = formatDate(event.date, lang);
    return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><title>${esc(event.name || t.event)}</title><style>
      body{font-family:Arial,sans-serif;padding:32px;color:#18232d}
      h1{margin-bottom:4px}h2{border-bottom:1px solid #ccc;padding-bottom:5px;margin-top:28px}
      h3{margin:18px 0 6px}table{width:100%;border-collapse:collapse;margin-bottom:12px}
      td,th{padding:7px;border:1px solid #ddd;text-align:left;vertical-align:top}
      .muted{color:#666;white-space:pre-wrap}
    </style></head><body>
      <h1>${esc(event.name || t.event)}</h1>
      <div>${esc([displayDate, event.venue].filter(Boolean).join(' · '))}</div>
      ${event.notes ? `<h2>${t.event}</h2><p class="muted">${esc(event.notes)}</p>` : ''}
      ${event.athleteTotal || event.athleteDescription ? `<p><b>${t.athletes}:</b> ${esc(event.athleteTotal || 0)}</p>${event.athleteDescription ? `<p class="muted">${esc(event.athleteDescription)}</p>` : ''}` : ''}
      ${timelineHtml}
      ${officialsHtml}
      ${rolesHtml ? `<h2>${t.roles}</h2>${rolesHtml}` : ''}
      ${briefingHtml}
      ${event.pathNotes ? `<h2>${t.courseNotes}</h2><p class="muted">${esc(event.pathNotes)}</p>` : ''}
    </body></html>`;
  }

  function buildSummaryPrintHtml(state, stylesheetUrl, lang) {
    const t = dict(lang);
    const text = value => `<span class="summary-note-text">${esc(value)}</span>`;
    const event = state?.event || {};
    const timeline = rows(state?.timeline);
    const departures = rows(event.athleteDepartures);
    const categories = rows(state?.roleCategories).filter(category => rows(category.roles).length);
    const briefingAthletes = String(state?.refereeNotes?.briefingAthletes || '').trim();
    const briefingJury = String(state?.refereeNotes?.briefingJury || '').trim();
    const names = ids => officialNames(state, ids, t);

    const timelineHtml = timeline.map(phase => `<tr><td class="summary-time">${esc(phase.time)}</td><td>${text(phase.title)}</td><td>${text([phase.place, phase.notes].filter(Boolean).join('\n'))}</td></tr>`).join('');
    const departuresHtml = departures.map(departure => `<tr><td>${text(departure.name ?? departure.label)}${departure.time ? `<span class="summary-departure-time">${esc(departure.time)}</span>` : ''}</td><td>${esc(departure.athletes ?? departure.count ?? '')}</td><td>${text(departure.numbers)}</td><td>${text(departure.notes)}</td></tr>`).join('');

    const rolesHtml = categories.map((category, index) => {
      const roleRows = rows(category.roles);
      const subs = state?.roleSubcategoriesEnabled ? rows(category.subcategories) : [];
      const countSuffix = subs.length ? ` / ${subs.length} ${subs.length === 1 ? t.subcategoriesSingular : t.subcategoriesPlural}` : '';
      if (subs.length) {
        const headers = subs.map(sub => `<th scope="col">${esc(sub.name || t.subcategory)}</th>`).join('');
        const body = roleRows.map(role => `<tr><td class="summary-role-name">${text(role.name || t.unnamedRole)}</td>${subs.map(sub => `<td>${text(names((role.officialIdsBySubcategory || {})[sub.id] || []))}</td>`).join('')}</tr>${role.notes ? `<tr><td colspan="${subs.length + 1}" class="summary-role-note"><strong>${t.notes}:</strong> ${text(role.notes)}</td></tr>` : ''}`).join('');
        return `<section class="summary-category${roleRows.length > 18 ? ' long-category' : ''}"><table class="summary-category-table summary-subcategory-table"><thead><tr><th colspan="${subs.length + 1}" class="summary-category-title"><div class="summary-category-heading"><span>${index + 1}. ${esc(category.name || t.unnamedCategory)}</span><span class="summary-category-count">${roleRows.length} ${roleRows.length === 1 ? t.roleSingular : t.rolePlural}${countSuffix}</span></div></th></tr><tr><th scope="col">${t.role}</th>${headers}</tr></thead><tbody>${body}</tbody></table></section>`;
      }
      const body = roleRows.map(role => `<tr><td class="summary-role-name">${text(role.name || t.unnamedRole)}</td><td>${text(names(role.officialIds || []))}</td></tr>${role.notes ? `<tr><td colspan="2" class="summary-role-note"><strong>${t.notes}:</strong> ${text(role.notes)}</td></tr>` : ''}`).join('');
      return `<section class="summary-category${roleRows.length > 18 ? ' long-category' : ''}"><table class="summary-category-table"><colgroup><col class="summary-role-column"><col></colgroup><thead><tr><th colspan="2" class="summary-category-title"><div class="summary-category-heading"><span>${index + 1}. ${esc(category.name || t.unnamedCategory)}</span><span class="summary-category-count">${roleRows.length} ${roleRows.length === 1 ? t.roleSingular : t.rolePlural}</span></div></th></tr><tr><th scope="col">${t.role}</th><th scope="col">${t.assignedOfficials}</th></tr></thead><tbody>${body}</tbody></table></section>`;
    }).join('');

    const timelineSection = timeline.length ? `<section class="summary-panel summary-timeline"><h2>${t.timeline}</h2><table><thead><tr><th scope="col">${t.time}</th><th scope="col">${t.title}</th><th scope="col">${t.placeNotes}</th></tr></thead><tbody>${timelineHtml}</tbody></table></section>` : '';
    const athleteSection = (departures.length || String(event.athleteDescription || '').trim()) ? `<section class="summary-panel summary-athletes"><h2>${t.athletes}</h2>${event.athleteDescription ? `<p class="summary-athlete-description summary-note-text">${esc(event.athleteDescription)}</p>` : ''}${departures.length ? `<table class="summary-departures"><thead><tr><th scope="col">${t.start}</th><th scope="col">${t.athletes}</th><th scope="col">${t.numbers}</th><th scope="col">${t.notes}</th></tr></thead><tbody>${departuresHtml}</tbody></table>` : ''}</section>` : '';
    const briefingSection = (briefingAthletes || briefingJury) ? `<section class="summary-panel summary-briefing"><h2>${t.briefing}</h2>${briefingAthletes ? `<h3>${t.athleteBriefing}</h3><div class="summary-note-text">${esc(briefingAthletes)}</div>` : ''}${briefingJury ? `<h3>${t.juryBriefing}</h3><div class="summary-note-text">${esc(briefingJury)}</div>` : ''}</section>` : '';
    const pathSection = String(event.pathNotes || '').trim() ? `<section class="summary-panel summary-path-notes"><h2>${t.courseNotes}</h2><div class="summary-note-text">${esc(event.pathNotes)}</div></section>` : '';
    const displayDate = formatDate(event.date, lang);

    return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(event.name || t.event)} - ${t.summaryTitle}</title><link rel="stylesheet" href="${esc(stylesheetUrl)}"></head><body><main class="summary-sheet"><header class="summary-header"><div class="summary-title"><h1>${esc(event.name || t.event)}</h1><div class="summary-subtitle">${esc([t.officialsSheet, event.venue, displayDate].filter(Boolean).join(' · '))}</div></div><div class="summary-totals"><span class="summary-total">${t.totalAthletes}: ${esc(event.athleteTotal ?? 0)}</span><span class="summary-total">${t.starts}: ${departures.length}</span></div></header>${event.notes ? `<p class="summary-event-notes summary-note-text">${esc(event.notes)}</p>` : ''}${timelineSection || athleteSection ? `<div class="summary-top ${timelineSection && athleteSection ? '' : 'summary-top-single'}">${timelineSection}${athleteSection}</div>` : ''}${rolesHtml ? `<section class="summary-panel summary-roles"><h2>${t.roles}</h2>${rolesHtml}</section>` : ''}${briefingSection}${pathSection}</main></body></html>`;
  }

  let currentMode = null;

  function renderPreview(mode) {
    const state = window.OWApp?.getCurrentEvent?.();
    if (!state) return;
    const languageSelect = $('printLanguage');
    const lang = languageSelect?.value || 'it';
    const t = dict(lang);
    const dialog = $('pdfDialog');
    const frame = $('pdfFrame');
    const printButton = $('printPdfBtn');
    const hint = $('summaryPrintHint');

    currentMode = mode;
    dialog.querySelector('h2').textContent = mode === 'summary' ? t.summaryPrint : t.previewPdf;
    hint.hidden = mode !== 'summary';
    hint.textContent = t.hint;
    printButton.textContent = t.printPdf;
    printButton.disabled = true;
    frame.onload = () => { printButton.disabled = false; };

    if (mode === 'summary') {
      frame.srcdoc = buildSummaryPrintHtml(
        state,
        new URL('css/print-summary.css?v=20260918-i18n-1', document.baseURI).href,
        lang
      );
    } else {
      frame.srcdoc = buildFullPrintHtml(state, lang);
    }

    if (!dialog.open) dialog.showModal();
  }

  function install() {
    const pdfButton = $('pdfBtn');
    const summaryButton = $('summaryPdfBtn');
    const languageSelect = $('printLanguage');
    if (!pdfButton || !summaryButton || !languageSelect) return;

    pdfButton.onclick = () => renderPreview('full');
    summaryButton.onclick = () => renderPreview('summary');
    languageSelect.onchange = () => {
      if ($('pdfDialog')?.open && currentMode) renderPreview(currentMode);
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', install, { once: true });
  } else {
    install();
  }

  window.OWPrintI18n = { buildFullPrintHtml, buildSummaryPrintHtml, renderPreview };
})();