import { useState } from 'react';
import { Outlet, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  AppBar, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Drawer, IconButton,
  Stack, TextField, Toolbar, Typography, useMediaQuery, useTheme
} from '@mui/material';
import MenuRounded from '@mui/icons-material/MenuRounded';
import SaveRounded from '@mui/icons-material/SaveRounded';
import DownloadRounded from '@mui/icons-material/DownloadRounded';
import PrintRounded from '@mui/icons-material/PrintRounded';
import ContentCopyRounded from '@mui/icons-material/ContentCopyRounded';
import ArrowBackRounded from '@mui/icons-material/ArrowBackRounded';
import { api } from '../../services/api';
import { EventEditorProvider, useEventEditor } from '../../contexts/EventEditorContext';
import EventSidebar from '../../components/EventSidebar';
import { cloneEvent, downloadJson } from '../../utils/event';
import { buildSummaryPrintHtml, openPrintWindow } from '../../utils/print';

export default function EventLayout() {
  const { eventId = '' } = useParams();
  return (
    <EventEditorProvider eventId={eventId}>
      <EventLayoutInner />
    </EventEditorProvider>
  );
}

function EventLayoutInner() {
  const navigate = useNavigate();
  const theme = useTheme();
  const mobile = useMediaQuery(theme.breakpoints.down('md'));
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [copyOpen, setCopyOpen] = useState(false);
  const [copyName, setCopyName] = useState('');
  const { event, access, dirty, save, saving } = useEventEditor();
  const globalAccess = useQuery({ queryKey: ['global-access'], queryFn: api.currentUserAccess });

  async function copyCurrent() {
    const saved = await api.saveEvent(cloneEvent(event, copyName.trim() || event.event.name + ' - Copia'));
    setCopyOpen(false);
    navigate('/events/' + saved.id + '/general');
  }

  function printSummary(lang: 'it' | 'en' = 'it') {
    const cssUrl = new URL((import.meta.env.BASE_URL || '/') + 'print-summary.css', window.location.origin).href;
    openPrintWindow(buildSummaryPrintHtml(event, cssUrl, lang));
  }

  return (
    <Box className="event-shell">
      {mobile ? (
        <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} PaperProps={{ sx: { bgcolor: 'primary.main', width: 280 } }}>
          <EventSidebar eventId={event.id} eventName={event.event.name} access={access} />
        </Drawer>
      ) : (
        <EventSidebar eventId={event.id} eventName={event.event.name} access={access} />
      )}

      <Box className="event-main">
        <AppBar position="sticky" elevation={0} color="transparent" className="event-topbar">
          <Toolbar sx={{ gap: 1.25 }}>
            {mobile && <IconButton onClick={() => setDrawerOpen(true)}><MenuRounded /></IconButton>}
            <Box sx={{ flexGrow: 1, minWidth: 0 }}>
              <Typography variant="h6" noWrap>{event.event.name}</Typography>
              <Typography variant="caption" color="text.secondary">
                {[event.event.date, event.event.venue].filter(Boolean).join(' · ')}
              </Typography>
            </Box>

            {!mobile && (
              <Stack direction="row" spacing={1}>
                {globalAccess.data?.isAdmin && <Button startIcon={<ContentCopyRounded />} onClick={() => { setCopyName(event.event.name + ' - Copia'); setCopyOpen(true); }}>Copia</Button>}
                {access.canExport && <Button startIcon={<DownloadRounded />} onClick={() => downloadJson(event)}>Esporta</Button>}
                {access.canPrint && <Button startIcon={<PrintRounded />} onClick={() => printSummary('it')}>Stampa sintetica</Button>}
                {access.canEdit && <Button variant="contained" startIcon={<SaveRounded />} disabled={saving || !dirty} onClick={() => save()}>{saving ? 'Salvataggio…' : 'Salva'}</Button>}
              </Stack>
            )}
          </Toolbar>
        </AppBar>

        <Box className="event-content">
          <Outlet />
        </Box>

        {mobile && (
          <Box className="mobile-commandbar">
            <Button startIcon={<ArrowBackRounded />} onClick={() => navigate('/events')}>Eventi</Button>
            {access.canPrint && <Button startIcon={<PrintRounded />} onClick={() => printSummary('it')}>Stampa</Button>}
            {access.canEdit && <Button variant="contained" startIcon={<SaveRounded />} disabled={saving || !dirty} onClick={() => save()}>Salva</Button>}
          </Box>
        )}
      </Box>

      <Dialog open={copyOpen} onClose={() => setCopyOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Copia evento</DialogTitle>
        <DialogContent><TextField fullWidth margin="dense" label="Nome nuovo evento" value={copyName} onChange={e => setCopyName(e.target.value)} /></DialogContent>
        <DialogActions>
          <Button onClick={() => setCopyOpen(false)}>Annulla</Button>
          <Button variant="contained" onClick={copyCurrent}>Crea copia</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
