import { useQuery } from '@tanstack/react-query';
import { Alert, Card, CardContent, MenuItem, Stack, TextField, Typography } from '@mui/material';
import { api } from '../../services/api';
import { useEventEditor } from '../../contexts/EventEditorContext';
import type { AccessRole } from '../../types';

export default function PermissionsPage() {
  const { eventId, access } = useEventEditor();
  const query = useQuery({ queryKey: ['permissions', eventId], queryFn: () => api.listEventPermissions(eventId), enabled: access.canManagePermissions });

  if (!access.canManagePermissions) return <Alert severity="warning">Questa sezione è disponibile solo agli Admin.</Alert>;

  return (
    <Stack spacing={2}>
      <Typography variant="h4">Permessi</Typography>
      <Card>
        <CardContent>
          <Stack spacing={1}>
            {(query.data || []).map(user => {
              const isAdmin = user.role === 'admin';
              return (
                <Stack key={user.user_id} direction={{ xs: 'column', md: 'row' }} alignItems={{ md: 'center' }} gap={2} sx={{ py: 1.25, borderBottom: '1px solid', borderColor: 'divider' }}>
                  <Stack sx={{ flexGrow: 1 }}>
                    <Typography fontWeight={800}>{user.display_name || user.email}</Typography>
                    <Typography variant="body2" color="text.secondary">{user.email}</Typography>
                  </Stack>
                  <TextField
                    select
                    value={user.role || ''}
                    disabled={isAdmin}
                    sx={{ minWidth: 220 }}
                    onChange={async e => {
                      await api.setEventPermission(eventId, user.user_id, (e.target.value || null) as AccessRole);
                      query.refetch();
                    }}
                  >
                    <MenuItem value="">Nessun accesso</MenuItem>
                    <MenuItem value="responsabile">Responsabile</MenuItem>
                    <MenuItem value="visualizzatore">Visualizzatore</MenuItem>
                    {isAdmin && <MenuItem value="admin">Admin</MenuItem>}
                  </TextField>
                </Stack>
              );
            })}
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  );
}
