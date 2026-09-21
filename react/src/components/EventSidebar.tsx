import { Box, List, ListItemButton, ListItemIcon, ListItemText, Typography } from '@mui/material';
import ArrowBackRounded from '@mui/icons-material/ArrowBackRounded';
import DescriptionRounded from '@mui/icons-material/DescriptionRounded';
import WavesRounded from '@mui/icons-material/WavesRounded';
import ScheduleRounded from '@mui/icons-material/ScheduleRounded';
import GroupsRounded from '@mui/icons-material/GroupsRounded';
import ShieldRounded from '@mui/icons-material/ShieldRounded';
import FactCheckRounded from '@mui/icons-material/FactCheckRounded';
import LockRounded from '@mui/icons-material/LockRounded';
import { useLocation, useNavigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import type { EventAccess } from '../types';

export default function EventSidebar({ eventId, eventName, access }: { eventId: string; eventName: string; access: EventAccess }) {
  const location = useLocation();
  const navigate = useNavigate();
  const items: Array<[string, string, ReactNode]> = [
    ['general', 'Generali', <DescriptionRounded />],
    ['departures', 'Ondate', <WavesRounded />],
    ['timeline', 'Timeline', <ScheduleRounded />],
    ['officials', 'Ufficiali gara', <GroupsRounded />],
    ['roles', 'Ruoli', <ShieldRounded />],
    ['notes', 'Note e checklist', <FactCheckRounded />],
  ];
  if (access.canManagePermissions) items.push(['permissions', 'Permessi', <LockRounded />]);

  return (
    <Box className="event-sidebar">
      <Box className="sidebar-brand">Gestione OW</Box>
      <List sx={{ px: 1 }}>
        <ListItemButton sx={{ color: 'white', borderRadius: 2, mb: 1 }} onClick={() => navigate('/events')}>
          <ListItemIcon sx={{ minWidth: 38, color: 'inherit' }}><ArrowBackRounded /></ListItemIcon>
          <ListItemText primary="Torna agli eventi" />
        </ListItemButton>
      </List>
      <Box sx={{ px: 2, py: 1.5 }}>
        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,.65)' }}>EVENTO</Typography>
        <Typography fontWeight={800} sx={{ color: 'white', mt: .5 }}>{eventName}</Typography>
      </Box>
      <List sx={{ px: 1 }}>
        {items.map(([key, label, icon]) => {
          const active = location.pathname.endsWith('/' + key);
          return (
            <ListItemButton
              key={key}
              selected={active}
              onClick={() => navigate('/events/' + eventId + '/' + key)}
              sx={{
                color: 'white',
                borderRadius: 2,
                mb: .5,
                '&.Mui-selected': { bgcolor: 'rgba(255,255,255,.16)' },
                '&.Mui-selected:hover': { bgcolor: 'rgba(255,255,255,.2)' },
              }}
            >
              <ListItemIcon sx={{ minWidth: 38, color: 'inherit' }}>{icon}</ListItemIcon>
              <ListItemText primary={label} />
            </ListItemButton>
          );
        })}
      </List>
    </Box>
  );
}
