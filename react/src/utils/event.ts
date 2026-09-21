import type { EventRecord } from '../types';

export const newId = () => crypto.randomUUID();

export function emptyEvent(name = 'Nuova gara di nuoto'): EventRecord {
  return {
    id: '',
    version: 4,
    createdAt: null,
    savedAt: null,
    roleSubcategoriesEnabled: false,
    event: {
      name,
      date: '',
      venue: '',
      notes: '',
      pathNotes: '',
      athleteTotal: 0,
      athleteDescription: '',
      athleteDepartures: [],
    },
    timeline: [],
    officials: [],
    roleCategories: [],
    refereeNotes: {
      briefingAthletes: '',
      briefingJury: '',
      checklist: [],
    },
  };
}

export function normalizeEvent(input: EventRecord): EventRecord {
  const base = emptyEvent();
  const data = structuredClone(input || base);
  return {
    ...base,
    ...data,
    event: {
      ...base.event,
      ...(data.event || {}),
      athleteDepartures: Array.isArray(data.event?.athleteDepartures) ? data.event.athleteDepartures : [],
    },
    timeline: Array.isArray(data.timeline) ? data.timeline : [],
    officials: Array.isArray(data.officials) ? data.officials : [],
    roleCategories: Array.isArray(data.roleCategories)
      ? data.roleCategories.map(category => ({
          ...category,
          subcategories: Array.isArray(category.subcategories) ? category.subcategories : [],
          roles: Array.isArray(category.roles)
            ? category.roles.map(role => ({
                ...role,
                officialIds: Array.isArray(role.officialIds) ? role.officialIds : [],
                officialIdsBySubcategory: role.officialIdsBySubcategory || {},
              }))
            : [],
        }))
      : [],
    refereeNotes: {
      ...base.refereeNotes,
      ...(data.refereeNotes || {}),
      checklist: Array.isArray(data.refereeNotes?.checklist) ? data.refereeNotes.checklist : [],
    },
  };
}

export function cloneEvent(source: EventRecord, name: string): EventRecord {
  const copy = normalizeEvent(structuredClone(source));
  const now = new Date().toISOString();
  copy.id = '';
  copy.createdAt = now;
  copy.savedAt = now;
  copy.event.name = name;

  copy.event.athleteDepartures = copy.event.athleteDepartures.map(item => ({ ...item, id: newId() }));
  copy.timeline = copy.timeline.map(item => ({ ...item, id: newId() }));
  copy.refereeNotes.checklist = copy.refereeNotes.checklist.map(item => ({ ...item, id: newId() }));

  const officialMap = new Map<string, string>();
  copy.officials = copy.officials.map(item => {
    const id = newId();
    officialMap.set(item.id, id);
    return { ...item, id };
  });

  copy.roleCategories = copy.roleCategories.map(category => {
    const subMap = new Map<string, string>();
    const subcategories = category.subcategories.map(sub => {
      const id = newId();
      subMap.set(sub.id, id);
      return { ...sub, id };
    });

    const roles = category.roles.map(role => {
      const bySubcategory: Record<string, string[]> = {};
      Object.entries(role.officialIdsBySubcategory || {}).forEach(([oldSubId, ids]) => {
        const newSubId = subMap.get(oldSubId);
        if (!newSubId) return;
        bySubcategory[newSubId] = ids.map(id => officialMap.get(id)).filter(Boolean) as string[];
      });
      return {
        ...role,
        id: newId(),
        officialIds: role.officialIds.map(id => officialMap.get(id)).filter(Boolean) as string[],
        officialIdsBySubcategory: bySubcategory,
      };
    });
    return { ...category, id: newId(), subcategories, roles };
  });

  return copy;
}

export function formatDate(value?: string | null) {
  if (!value) return '';
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : value;
}

export function downloadJson(event: EventRecord) {
  const blob = new Blob([JSON.stringify(event, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = (event.event.name || 'evento').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '.json';
  link.click();
  URL.revokeObjectURL(url);
}
