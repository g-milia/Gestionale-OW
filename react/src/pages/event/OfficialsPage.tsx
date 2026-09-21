import { Typography } from '@mui/material';
import CrudList from '../../components/CrudList';
import { useEventEditor } from '../../contexts/EventEditorContext';
import { newId } from '../../utils/event';

export default function OfficialsPage() {
  const { event, setEvent, access, markDirty } = useEventEditor();

  function update(next: typeof event.officials) {
    setEvent(prev => {
      const removed = new Set(prev.officials.filter(o => !next.some(n => n.id === o.id)).map(o => o.id));
      const roleCategories = prev.roleCategories.map(category => ({
        ...category,
        roles: category.roles.map(role => ({
          ...role,
          officialIds: role.officialIds.filter(id => !removed.has(id)),
          officialIdsBySubcategory: Object.fromEntries(
            Object.entries(role.officialIdsBySubcategory || {}).map(([key, ids]) => [key, ids.filter(id => !removed.has(id))]),
          ),
        })),
      }));
      return { ...prev, officials: next, roleCategories };
    });
    markDirty();
  }

  return (
    <CrudList
      title="Ufficiali gara"
      items={event.officials}
      canEdit={access.canEdit}
      fields={[
        { key: 'name', label: 'Nome e cognome' },
        { key: 'notes', label: 'Note', multiline: true },
      ]}
      newItem={() => ({ id: newId(), name: '', notes: '' })}
      render={item => <>
        <Typography fontWeight={800}>{item.name || 'UG senza nome'}</Typography>
        <Typography variant="body2" color="text.secondary">{item.notes}</Typography>
      </>}
      onChange={update}
    />
  );
}
