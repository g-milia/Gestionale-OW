import type { EventRecord } from '../types';
import { formatDate } from './event';

const entities: Record<string, string> = {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'};
const esc = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, c => entities[c] || c);
const rows = <T,>(value: T[] | undefined | null) => Array.isArray(value) ? value.filter(Boolean) : [];

const I18N = {
  it: {
    event:'Evento', athletes:'Atleti', totalAthletes:'Totale atleti', starts:'Partenze', start:'Partenza', timeline:'Timeline',
    time:'Ora', title:'Titolo', placeNotes:'Luogo / Note', officials:'Ufficiali Gara', roles:'Ruoli', role:'Ruolo',
    assignedOfficials:'Ufficiali gara assegnati', briefing:'Briefing', athleteBriefing:'Atleti', juryBriefing:'Giuria',
    courseNotes:'Note percorso', numbers:'Numeri', notes:'Note', subcategory:'Sottocategoria', subcategoriesSingular:'sottocategoria',
    subcategoriesPlural:'sottocategorie', roleSingular:'ruolo', rolePlural:'ruoli', unnamedOfficial:'UG senza nome',
    missingOfficial:'UG non presente', unnamedRole:'Ruolo senza nome', unnamedCategory:'Categoria senza nome',
    officialsSheet:'Foglio ufficiali gara', summaryTitle:'Stampa sintetica'
  },
  en: {
    event:'Event', athletes:'Athletes', totalAthletes:'Total athletes', starts:'Starts', start:'Start', timeline:'Timeline',
    time:'Time', title:'Title', placeNotes:'Location / Notes', officials:'Officials', roles:'Roles', role:'Role',
    assignedOfficials:'Assigned officials', briefing:'Briefing', athleteBriefing:'Athletes', juryBriefing:'Officials',
    courseNotes:'Course notes', numbers:'Numbers', notes:'Notes', subcategory:'Subcategory', subcategoriesSingular:'subcategory',
    subcategoriesPlural:'subcategories', roleSingular:'role', rolePlural:'roles', unnamedOfficial:'Unnamed official',
    missingOfficial:'Official not found', unnamedRole:'Unnamed role', unnamedCategory:'Unnamed category',
    officialsSheet:'Officials sheet', summaryTitle:'Summary print'
  }
} as const;

function officialNames(state: EventRecord, ids: string[], t: typeof I18N.it) {
  const map = new Map(rows(state.officials).map(o => [o.id, o.name || t.unnamedOfficial]));
  return [...new Set(rows(ids))].map(id => map.get(id) || t.missingOfficial).join(' - ');
}

export function buildSummaryPrintHtml(state: EventRecord, stylesheetUrl: string, lang: 'it' | 'en') {
  const t = I18N[lang];
  const text = (value: unknown) => '<span class="summary-note-text">' + esc(value) + '</span>';
  const event = state.event;
  const timeline = rows(state.timeline);
  const departures = rows(event.athleteDepartures);
  const categories = rows(state.roleCategories).filter(category => rows(category.roles).length);
  const briefingAthletes = String(state.refereeNotes?.briefingAthletes || '').trim();
  const briefingJury = String(state.refereeNotes?.briefingJury || '').trim();
  const names = (ids: string[]) => officialNames(state, ids, t as typeof I18N.it);

  const timelineHtml = timeline.map(phase =>
    '<tr><td class="summary-time">' + esc(phase.time) + '</td><td>' + text(phase.title) + '</td><td>' + text([phase.place, phase.notes].filter(Boolean).join('\n')) + '</td></tr>'
  ).join('');

  const departuresHtml = departures.map(departure =>
    '<tr><td>' + text(departure.name) + (departure.time ? '<span class="summary-departure-time">' + esc(departure.time) + '</span>' : '') +
    '</td><td>' + esc(departure.athletes) + '</td><td>' + text(departure.numbers) + '</td><td>' + text(departure.notes) + '</td></tr>'
  ).join('');

  const rolesHtml = categories.map((category, index) => {
    const roleRows = rows(category.roles);
    const subs = state.roleSubcategoriesEnabled ? rows(category.subcategories) : [];
    const countSuffix = subs.length ? ' / ' + subs.length + ' ' + (subs.length === 1 ? t.subcategoriesSingular : t.subcategoriesPlural) : '';
    if (subs.length) {
      const headers = subs.map(sub => '<th scope="col">' + esc(sub.name || t.subcategory) + '</th>').join('');
      const body = roleRows.map(role =>
        '<tr><td class="summary-role-name">' + text(role.name || t.unnamedRole) + '</td>' +
        subs.map(sub => '<td>' + text(names((role.officialIdsBySubcategory || {})[sub.id] || [])) + '</td>').join('') + '</tr>'
      ).join('');
      return '<section class="summary-category"><table class="summary-category-table summary-subcategory-table"><thead>' +
        '<tr><th colspan="' + (subs.length + 1) + '" class="summary-category-title"><div class="summary-category-heading"><span>' +
        (index + 1) + '. ' + esc(category.name || t.unnamedCategory) + '</span><span class="summary-category-count">' +
        roleRows.length + ' ' + (roleRows.length === 1 ? t.roleSingular : t.rolePlural) + countSuffix +
        '</span></div></th></tr><tr><th scope="col">' + t.role + '</th>' + headers +
        '</tr></thead><tbody>' + body + '</tbody></table></section>';
    }

    const body = roleRows.map(role =>
      '<tr><td class="summary-role-name">' + text(role.name || t.unnamedRole) + '</td><td>' + text(names(role.officialIds || [])) + '</td></tr>'
    ).join('');
    return '<section class="summary-category"><table class="summary-category-table"><colgroup><col class="summary-role-column"><col></colgroup><thead>' +
      '<tr><th colspan="2" class="summary-category-title"><div class="summary-category-heading"><span>' +
      (index + 1) + '. ' + esc(category.name || t.unnamedCategory) + '</span><span class="summary-category-count">' +
      roleRows.length + ' ' + (roleRows.length === 1 ? t.roleSingular : t.rolePlural) +
      '</span></div></th></tr><tr><th scope="col">' + t.role + '</th><th scope="col">' + t.assignedOfficials +
      '</th></tr></thead><tbody>' + body + '</tbody></table></section>';
  }).join('');

  const timelineSection = timeline.length
    ? '<section class="summary-panel summary-timeline"><h2>' + t.timeline + '</h2><table><thead><tr><th>' + t.time + '</th><th>' + t.title + '</th><th>' + t.placeNotes + '</th></tr></thead><tbody>' + timelineHtml + '</tbody></table></section>'
    : '';

  const athleteSection = (departures.length || String(event.athleteDescription || '').trim())
    ? '<section class="summary-panel summary-athletes"><h2>' + t.athletes + '</h2>' +
      (event.athleteDescription ? '<p class="summary-athlete-description summary-note-text">' + esc(event.athleteDescription) + '</p>' : '') +
      (departures.length ? '<table class="summary-departures"><thead><tr><th>' + t.start + '</th><th>' + t.athletes + '</th><th>' + t.numbers + '</th><th>' + t.notes + '</th></tr></thead><tbody>' + departuresHtml + '</tbody></table>' : '') +
      '</section>'
    : '';

  const briefingSection = (briefingAthletes || briefingJury)
    ? '<section class="summary-panel summary-briefing"><h2>' + t.briefing + '</h2>' +
      (briefingAthletes ? '<h3>' + t.athleteBriefing + '</h3><div class="summary-note-text">' + esc(briefingAthletes) + '</div>' : '') +
      (briefingJury ? '<h3>' + t.juryBriefing + '</h3><div class="summary-note-text">' + esc(briefingJury) + '</div>' : '') +
      '</section>'
    : '';

  const pathSection = String(event.pathNotes || '').trim()
    ? '<section class="summary-panel summary-path-notes"><h2>' + t.courseNotes + '</h2><div class="summary-note-text">' + esc(event.pathNotes) + '</div></section>'
    : '';

  return '<!doctype html><html lang="' + lang + '"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>' + esc(event.name || t.event) + ' - ' + t.summaryTitle + '</title><link rel="stylesheet" href="' + esc(stylesheetUrl) + '"></head><body>' +
    '<main class="summary-sheet"><header class="summary-header"><div class="summary-title"><h1>' + esc(event.name || t.event) + '</h1>' +
    '<div class="summary-subtitle">' + esc([t.officialsSheet, event.venue, formatDate(event.date)].filter(Boolean).join(' · ')) + '</div></div>' +
    '<div class="summary-totals"><span class="summary-total">' + t.totalAthletes + ': ' + esc(event.athleteTotal ?? 0) + '</span>' +
    '<span class="summary-total">' + t.starts + ': ' + departures.length + '</span></div></header>' +
    (event.notes ? '<p class="summary-event-notes summary-note-text">' + esc(event.notes) + '</p>' : '') +
    ((timelineSection || athleteSection) ? '<div class="summary-top ' + (timelineSection && athleteSection ? '' : 'summary-top-single') + '">' + timelineSection + athleteSection + '</div>' : '') +
    (rolesHtml ? '<section class="summary-panel summary-roles"><h2>' + t.roles + '</h2>' + rolesHtml + '</section>' : '') +
    briefingSection + pathSection + '</main></body></html>';
}

export function openPrintWindow(html: string) {
  const win = window.open('', '_blank');
  if (!win) throw new Error('Il browser ha bloccato la finestra di stampa.');
  win.document.open();
  win.document.write(html);
  win.document.close();
  win.focus();
}
