import { Card, CardContent, Stack, TextField, Typography } from '@mui/material';
import { useEventEditor } from '../../contexts/EventEditorContext';
import CrudList from '../../components/CrudList';
import { newId } from '../../utils/event';

export default function DeparturesPage() {
  const { event, setEvent, access, markDirty } = useEventEditor();

  return (
    <Stack spacing={2.5}>
      <Card>
        <CardContent>
          <Typography variant="h4" mb={2}>Ondate</Typography>
          <Stack spacing={2}>
            <TextField
              label="Totale atleti"
              type="number"
              value={event.event.athleteTotal}
              disabled={!access.canEdit}
              onChange={e => { setEvent(prev => ({ ...prev, event: { ...prev.event, athleteTotal: Number(e.target.value || 0) } })); markDirty(); }}
            />
            <TextField
              label="Note atleti"
              multiline
              minRows={3}
              value={event.event.athleteDescription}
              disabled={!access.canEdit}
              onChange={e => { setEvent(prev => ({ ...prev, event: { ...prev.event, athleteDescription: e.target.value } })); markDirty(); }}
            />
          </Stack>
        </CardContent>
      </Card>
      <CrudList
        title="Partenze"
        items={event.event.athleteDepartures}
        canEdit={access.canEdit}
        fields={[
          { key: 'name', label: 'Nome' },
          { key: 'time', label: 'Orario', type: 'time' },
          { key: 'athletes', label: 'Numero atleti', type: 'number' },
          { key: 'numbers', label: 'Numeri' },
          { key: 'notes', label: 'Note', multiline: true },
        ]}
        newItem={() => ({ id: newId(), name: 'Partenza', time: '', athletes: 0, numbers: '', notes: '' })}
        render={item => <>
          <Typography fontWeight={800}>{item.name}</Typography>
          <Typography variant="body2" color="text.secondary">{[item.time, item.athletes + ' atleti', item.numbers].filter(Boolean).join(' · ')}</Typography>
        </>}
        onChange={next => { setEvent(prev => ({ ...prev, event: { ...prev.event, athleteDepartures: next } })); markDirty(); }}
      />
    </Stack>
  );
}
