(() => {
  const frame = document.getElementById('pdfFrame');
  const detailedButton = document.getElementById('pdfBtn');
  const summaryButton = document.getElementById('summaryPdfBtn');
  if (!frame || !detailedButton || !summaryButton) return;

  let mode = 'detailed';
  detailedButton.addEventListener('click', () => { mode = 'detailed'; });
  summaryButton.addEventListener('click', () => { mode = 'summary'; });

  frame.addEventListener('load', () => {
    const doc = frame.contentDocument;
    if (!doc?.body) return;
    if (mode === 'summary') pruneSummary(doc);
    else pruneDetailed(doc);
  });

  function clean(value) {
    return String(value || '').replace(/\u00a0/g, ' ').trim();
  }

  function hasMeaningfulText(node) {
    const text = clean(node?.textContent);
    return Boolean(text && text !== '-' && text !== '—' && text !== 'Nessun UG assegnato');
  }

  function nextHeading(node, selector) {
    let current = node?.nextElementSibling;
    while (current && !current.matches(selector)) current = current.nextElementSibling;
    return current;
  }

  function elementsUntil(start, stopSelector) {
    const elements = [];
    let current = start?.nextElementSibling;
    while (current && !current.matches(stopSelector)) {
      elements.push(current);
      current = current.nextElementSibling;
    }
    return elements;
  }

  function removeHeadingBlock(heading, stopSelector) {
    if (!heading) return;
    const elements = elementsUntil(heading, stopSelector);
    elements.forEach(node => node.remove());
    heading.remove();
  }

  function headingByText(doc, tag, label) {
    return [...doc.querySelectorAll(tag)].find(node => clean(node.textContent).toLowerCase() === label.toLowerCase());
  }

  function pruneDetailed(doc) {
    // Paragraphs used only for optional free text should not consume print space.
    doc.querySelectorAll('p.muted').forEach(p => {
      if (!clean(p.textContent)) p.remove();
    });

    const timelineHeading = headingByText(doc, 'h2', 'Timeline');
    if (timelineHeading) {
      const table = timelineHeading.nextElementSibling;
      const rows = table?.querySelectorAll('tbody tr, tr') || [];
      if (!rows.length) removeHeadingBlock(timelineHeading, 'h2');
    }

    const officialsHeading = headingByText(doc, 'h2', 'Ufficiali Gara');
    if (officialsHeading) {
      const content = elementsUntil(officialsHeading, 'h2');
      if (!content.some(hasMeaningfulText)) removeHeadingBlock(officialsHeading, 'h2');
    }

    const rolesHeading = headingByText(doc, 'h2', 'Ruoli');
    if (rolesHeading) {
      const block = elementsUntil(rolesHeading, 'h2');
      // Remove category headings that have no role rows beneath them.
      block.filter(node => node.matches('h3')).forEach(categoryHeading => {
        const content = elementsUntil(categoryHeading, 'h2,h3');
        if (!content.some(hasMeaningfulText)) {
          content.forEach(node => node.remove());
          categoryHeading.remove();
        }
      });
      if (!elementsUntil(rolesHeading, 'h2').some(hasMeaningfulText)) {
        removeHeadingBlock(rolesHeading, 'h2');
      }
    }

    const briefingHeading = headingByText(doc, 'h2', 'Briefing');
    if (briefingHeading) {
      const nextH2 = nextHeading(briefingHeading, 'h2');
      let current = briefingHeading.nextElementSibling;
      while (current && current !== nextH2) {
        if (current.matches('h3')) {
          const subheading = current;
          const content = elementsUntil(subheading, 'h2,h3');
          current = content.length ? content[content.length - 1].nextElementSibling : subheading.nextElementSibling;
          if (!content.some(hasMeaningfulText)) {
            content.forEach(node => node.remove());
            subheading.remove();
          }
        } else {
          current = current.nextElementSibling;
        }
      }
      if (!elementsUntil(briefingHeading, 'h2').some(hasMeaningfulText)) {
        removeHeadingBlock(briefingHeading, 'h2');
      }
    }
  }

  function pruneSummary(doc) {
    const eventNotes = doc.querySelector('.summary-event-notes');
    if (eventNotes && !hasMeaningfulText(eventNotes)) eventNotes.remove();

    const athleteDescription = doc.querySelector('.summary-athlete-description');
    if (athleteDescription && !hasMeaningfulText(athleteDescription)) athleteDescription.remove();

    const timeline = doc.querySelector('.summary-timeline');
    if (timeline && timeline.querySelector('tbody .summary-empty') && !timeline.querySelector('tbody tr:not(:has(.summary-empty))')) {
      timeline.remove();
    }

    const athletes = doc.querySelector('.summary-athletes');
    if (athletes) {
      const realDepartureRows = [...athletes.querySelectorAll('tbody tr')].filter(row => !row.querySelector('.summary-empty'));
      const description = athletes.querySelector('.summary-athlete-description');
      if (!realDepartureRows.length && !hasMeaningfulText(description)) athletes.remove();
    }

    doc.querySelectorAll('.summary-category').forEach(category => {
      const realRows = [...category.querySelectorAll('tbody tr')].filter(row => !row.querySelector('.summary-empty'));
      if (!realRows.length) category.remove();
    });

    const roles = doc.querySelector('.summary-roles');
    if (roles && !roles.querySelector('.summary-category')) roles.remove();

    const pathNotes = doc.querySelector('.summary-path-notes');
    if (pathNotes) {
      const value = pathNotes.querySelector('.summary-note-text');
      if (!hasMeaningfulText(value)) pathNotes.remove();
    }

    const top = doc.querySelector('.summary-top');
    if (top) {
      const panels = [...top.children].filter(node => node.matches('section'));
      if (!panels.length) top.remove();
      else if (panels.length === 1) top.style.gridTemplateColumns = '1fr';
    }
  }
})();
