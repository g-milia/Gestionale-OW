import { Button, Card, CardContent, Checkbox, IconButton, Stack, TextField, Typography } from '@mui/material';
import AddRounded from '@mui/icons-material/AddRounded';
import DeleteRounded from '@mui/icons-material/DeleteRounded';
import { useState } from 'react';
import { useEventEditor } from '../../contexts/EventEditorContext';
import { newId } from '../../utils/event';

export default function NotesPage() {
  const { event, setEvent, access, markDirty } = useEventEditor();
  const [newItem, setNewItem] = useState('');

  function updateNotes(key: 'briefingAthletes' | 'briefingJury', value: string) {
    setEvent(prev => ({ ...prev, refereeNotes: { ...prev.refereeNotes, [key]: value } }));
    markDirty();
  }

  return (
    <Stack spacing={2}>
      <Typography variant="h4">Note e checklist</Typography>
      <Card><CardContent><TextField fullWidth multiline minRows={4} label="Briefing Atleti" value={event.refereeNotes.briefingAthletes} disabled={!access.canEdit} onChange={e => updateNotes('briefingAthletes', e.target.value)} /></CardContent></Card>
      <Card><CardContent><TextField fullWidth multiline minRows={4} label="Briefing Giuria" value={event.refereeNotes.briefingJury} disabled={!access.canEdit} onChange={e => updateNotes('briefingJury', e.target.value)} /></CardContent></Card>
      <Card>
        <CardContent>
          <Typography variant="h6" mb={2}>Checklist operativa</Typography>
          {access.canEdit && (
            <Stack direction="row" spacing={1} mb={2}>
              <TextField fullWidth placeholder="Nuova voce checklist" value={newItem} onChange={e => setNewItem(e.target.value)} />
              <Button
                variant="contained"
                startIcon={<AddRounded />}
                onClick={() => {
                  if (!newItem.trim()) return;
                  setEvent(prev => ({ ...prev, refereeNotes: { ...prev.refereeNotes, checklist: [...prev.refereeNotes.checklist, { id: newId(), label: newItem.trim(), checked: false }] } }));
                  setNewItem('');
                  markDirty();
                }}
              >
                Aggiungi
              </Button>
            </Stack>
          )}
          <Stack spacing={1}>
            {event.refereeNotes.checklist.map(item => (
              <Stack key={item.id} direction="row" alignItems="center" spacing={1}>
                <Checkbox
                  checked={item.checked}
                  disabled={!access.canEdit}
                  onChange={e => {
                    setEvent(prev => ({ ...prev, refereeNotes: { ...prev.refereeNotes, checklist: prev.refereeNotes.checklist.map(x => x.id === item.id ? { ...x, checked: e.target.checked } : x) } }));
                    markDirty();
                  }}
                />
                <TextField
                  fullWidth
                  value={item.label}
                  disabled={!access.canEdit}
                  onChange={e => {
                    setEvent(prev => ({ ...prev, refereeNotes: { ...prev.refereeNotes, checklist: prev.refereeNotes.checklist.map(x => x.id === item.id ? { ...x, label: e.target.value } : x) } }));
                    markDirty();
                  }}
                />
                {access.canEdit && <IconButton color="error" onClick={() => { setEvent(prev => ({ ...prev, refereeNotes: { ...prev.refereeNotes, checklist: prev.refereeNotes.checklist.filter(x => x.id !== item.id) } })); markDirty(); }}><DeleteRounded /></IconButton>}
              </Stack>
            ))}
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  );
}
