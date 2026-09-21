import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  AppBar, Avatar, Box, Button, Card, CardActions, CardContent, Chip, Container, Dialog,
  DialogActions, DialogContent, DialogTitle, IconButton, InputAdornment, Stack, TextField,
  Toolbar, Typography
} from '@mui/material';
import AddRounded from '@mui/icons-material/AddRounded';
import SearchRounded from '@mui/icons-material/SearchRounded';
import UploadFileRounded from '@mui/icons-material/UploadFileRounded';
import RefreshRounded from '@mui/icons-material/RefreshRounded';
import LogoutRounded from '@mui/icons-material/LogoutRounded';
import CalendarMonthRounded from '@mui/icons-material/CalendarMonthRounded';
import PlaceRounded from '@mui/icons-material/PlaceRounded';
import GroupsRounded from '@mui/icons-material/GroupsRounded';
import ArrowForwardRounded from '@mui/icons-material/ArrowForwardRounded';
import DeleteRounded from '@mui/icons-material/DeleteRounded';
import WavesRounded from '@mui/icons-material/WavesRounded';
import { api } from '../services/api';
import { emptyEvent, formatDate } from '../utils/event';
import { useAuth } from '../contexts/AuthContext';

const roleLabel: Record<string, string> = {
  admin: 'Admin',
  responsabile: 'Responsabile',
  visualizzatore: 'Visualizzatore',
};

export default function EventsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { session, signOut } = useAuth();
  const [search, setSearch] = useState('');
  const [newOpen, setNewOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const accessQuery = useQuery({ queryKey: ['global-access'], queryFn: api.currentUserAccess });
  const eventsQuery = useQuery({ queryKey: ['events'], queryFn: api.listEvents });

  const createMutation = useMutation({
    mutationFn: async () => {
      const event = emptyEvent(newName.trim() || 'Nuovo evento');
      const now = new Date().toISOString();
      event.createdAt = now;
      event.savedAt = now;
      return api.saveEvent(event);
    },
    onSuccess: saved => {
      setNewOpen(false);
      setNewName('');
      queryClient.invalidateQueries({ queryKey: ['events'] });
      navigate('/events/' + saved.id + '/general');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: api.deleteEvent,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['events'] }),
  });

  const rows = (eventsQuery.data || []).filter(item => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return [item.name, item.venue, item.event_date].some(v => String(v || '').toLowerCase().includes(q));
  });

  async function importFile(file?: File) {
    if (!file) return;
    const raw = JSON.parse(await file.text());
    const existing = raw?.id || raw?.eventId ? await api.getEvent(raw.id || raw.eventId).catch(() => null) : null;
    let payload = raw;
    if (existing) {
      if (!confirm('Esiste già un evento con lo stesso ID. Importarlo come copia indipendente?')) return;
      payload = { ...raw, id: '', eventId: null };
    }
    const saved = await api.importEvent(payload);
    queryClient.invalidateQueries({ queryKey: ['events'] });
    navigate('/events/' + saved.id + '/general');
  }

  return (
    <Box minHeight="100vh">
      <AppBar position="sticky" elevation={0} color="transparent" sx={{ borderBottom: '1px solid', borderColor: 'divider', bgcolor: 'rgba(238,242,246,.92)', backdropFilter: 'blur(14px)' }}>
        <Toolbar sx={{ gap: 2 }}>
          <Stack direction="row" alignItems="center" spacing={1.5} sx={{ flexGrow: 1 }}>
            <Box className="brand-mark small"><WavesRounded /></Box>
            <Typography variant="h6">Gestione OW</Typography>
          </Stack>
          <Avatar sx={{ bgcolor: 'primary.main', width: 38, height: 38 }}>{(session?.user.email || 'U')[0].toUpperCase()}</Avatar>
          <IconButton onClick={() => signOut()}><LogoutRounded /></IconButton>
        </Toolbar>
      </AppBar>

      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" gap={2} mb={3}>
          <Box>
            <Typography variant="h4">Eventi</Typography>
            <Typography color="text.secondary">Gli eventi che puoi visualizzare o gestire.</Typography>
          </Box>
          <Stack direction="row" spacing={1}>
            {accessQuery.data?.canImport && (
              <>
                <input ref={inputRef} hidden type="file" accept="application/json,.json" onChange={e => importFile(e.target.files?.[0])} />
                <Button variant="outlined" startIcon={<UploadFileRounded />} onClick={() => inputRef.current?.click()}>Importa</Button>
              </>
            )}
            {accessQuery.data?.canCreate && <Button variant="contained" startIcon={<AddRounded />} onClick={() => setNewOpen(true)}>Nuovo evento</Button>}
          </Stack>
        </Stack>

        <Stack direction="row" gap={1} mb={3}>
          <TextField
            fullWidth
            placeholder="Cerca per nome, data o luogo"
            value={search}
            onChange={e => setSearch(e.target.value)}
            InputProps={{ startAdornment: <InputAdornment position="start"><SearchRounded /></InputAdornment> }}
          />
          <IconButton onClick={() => eventsQuery.refetch()}><RefreshRounded /></IconButton>
        </Stack>

        <Box className="event-grid-react">
          {rows.map(item => (
            <Card key={item.event_id}>
              <CardContent>
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={2}>
                  <Box>
                    <Typography variant="h6">{item.name}</Typography>
                    <Stack direction="row" gap={1.5} flexWrap="wrap" mt={1.5} color="text.secondary">
                      {item.event_date && <Stack direction="row" gap={0.5} alignItems="center"><CalendarMonthRounded fontSize="small" />{formatDate(item.event_date)}</Stack>}
                      {item.venue && <Stack direction="row" gap={0.5} alignItems="center"><PlaceRounded fontSize="small" />{item.venue}</Stack>}
                      {item.athlete_total !== null && <Stack direction="row" gap={0.5} alignItems="center"><GroupsRounded fontSize="small" />{item.athlete_total} atleti</Stack>}
                    </Stack>
                  </Box>
                  {item.access_role && <Chip size="small" label={roleLabel[item.access_role] || item.access_role} />}
                </Stack>
              </CardContent>
              <CardActions sx={{ px: 2, pb: 2, justifyContent: 'space-between' }}>
                <Typography variant="caption" color="text.secondary">
                  {item.updated_at ? 'Aggiornato ' + new Date(item.updated_at).toLocaleString('it-IT') : ''}
                </Typography>
                <Stack direction="row" gap={1}>
                  {accessQuery.data?.isAdmin && (
                    <IconButton
                      size="small"
                      color="error"
                      onClick={() => {
                        if (confirm('Eliminare definitivamente questo evento?')) deleteMutation.mutate(item.event_id);
                      }}
                    >
                      <DeleteRounded fontSize="small" />
                    </IconButton>
                  )}
                  <Button endIcon={<ArrowForwardRounded />} onClick={() => navigate('/events/' + item.event_id + '/general')}>Apri</Button>
                </Stack>
              </CardActions>
            </Card>
          ))}
        </Box>
      </Container>

      <Dialog open={newOpen} onClose={() => setNewOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Nuovo evento</DialogTitle>
        <DialogContent>
          <TextField autoFocus fullWidth margin="dense" label="Nome evento" value={newName} onChange={e => setNewName(e.target.value)} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setNewOpen(false)}>Annulla</Button>
          <Button variant="contained" onClick={() => createMutation.mutate()} disabled={!newName.trim() || createMutation.isPending}>Crea</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
