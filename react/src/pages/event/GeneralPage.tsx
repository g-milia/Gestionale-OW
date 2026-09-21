import { Card, CardContent, Stack, TextField, Typography } from '@mui/material';
import { useEventEditor } from '../../contexts/EventEditorContext';

export default function GeneralPage() {
  const { event, setEvent, access, markDirty } = useEventEditor();

  function update(key: keyof typeof event.event, value: string) {
    setEvent(prev => ({ ...prev, event: { ...prev.event, [key]: value } }));
    markDirty();
  }

  return (
    <Stack spacing={2.5}>
      <Typography variant="h4">Generali</Typography>
      <Card>
        <CardContent>
          <Stack spacing={2}>
            <TextField fullWidth label="Nome evento" value={event.event.name} disabled={!access.canEdit} onChange={e => update('name', e.target.value)} />
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
              <TextField fullWidth label="Data" type="date" InputLabelProps={{ shrink: true }} value={event.event.date} disabled={!access.canEdit} onChange={e => update('date', e.target.value)} />
              <TextField fullWidth label="Luogo / impianto" value={event.event.venue} disabled={!access.canEdit} onChange={e => update('venue', e.target.value)} />
            </Stack>
            <TextField fullWidth multiline minRows={4} label="Note generali" value={event.event.notes} disabled={!access.canEdit} onChange={e => update('notes', e.target.value)} />
            <TextField fullWidth multiline minRows={4} label="Note percorso" value={event.event.pathNotes} disabled={!access.canEdit} onChange={e => update('pathNotes', e.target.value)} />
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  );
}
