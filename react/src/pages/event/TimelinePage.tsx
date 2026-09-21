import { Typography } from '@mui/material';
import CrudList from '../../components/CrudList';
import { useEventEditor } from '../../contexts/EventEditorContext';
import { newId } from '../../utils/event';

export default function TimelinePage() {
  const { event, setEvent, access, markDirty } = useEventEditor();
  return (
    <CrudList
      title="Timeline"
      items={event.timeline}
      canEdit={access.canEdit}
      fields={[
        { key: 'time', label: 'Orario', type: 'time' },
        { key: 'title', label: 'Titolo' },
        { key: 'place', label: 'Luogo' },
        { key: 'notes', label: 'Note', multiline: true },
      ]}
      newItem={() => ({ id: newId(), time: '', title: '', place: '', notes: '' })}
      render={item => <>
        <Typography fontWeight={800}>{item.time || '--:--'} · {item.title || 'Fase'}</Typography>
        <Typography variant="body2" color="text.secondary">{[item.place, item.notes].filter(Boolean).join(' · ')}</Typography>
      </>}
      onChange={next => { setEvent(prev => ({ ...prev, timeline: next })); markDirty(); }}
    />
  );
}
