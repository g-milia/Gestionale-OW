import { useEffect, useMemo, useState } from 'react';
import {
  Box, Button, Card, CardContent, Chip, Divider, IconButton, InputAdornment, List, ListItemButton,
  ListItemText, Stack, Switch, TextField, Typography
} from '@mui/material';
import AddRounded from '@mui/icons-material/AddRounded';
import DeleteRounded from '@mui/icons-material/DeleteRounded';
import ArrowUpwardRounded from '@mui/icons-material/ArrowUpwardRounded';
import ArrowDownwardRounded from '@mui/icons-material/ArrowDownwardRounded';
import SearchRounded from '@mui/icons-material/SearchRounded';
import CloseRounded from '@mui/icons-material/CloseRounded';
import PersonAddRounded from '@mui/icons-material/PersonAddRounded';
import { useEventEditor } from '../../contexts/EventEditorContext';
import { newId } from '../../utils/event';
import type { EventRole, RoleCategory } from '../../types';

export default function RolesPage() {
  const { event, setEvent, access, markDirty } = useEventEditor();
  const [categoryId, setCategoryId] = useState<string | null>(event.roleCategories[0]?.id || null);
  const [roleId, setRoleId] = useState<string | null>(event.roleCategories[0]?.roles[0]?.id || null);
  const [subcategoryId, setSubcategoryId] = useState<string | null>(null);
  const [officialSearch, setOfficialSearch] = useState('');

  const category = event.roleCategories.find(c => c.id === categoryId) || null;
  const role = category?.roles.find(r => r.id === roleId) || null;

  useEffect(() => {
    if (!event.roleCategories.some(c => c.id === categoryId)) {
      const first = event.roleCategories[0] || null;
      setCategoryId(first?.id || null);
      setRoleId(first?.roles[0]?.id || null);
    }
  }, [event.roleCategories, categoryId]);

  useEffect(() => {
    if (category && !category.roles.some(r => r.id === roleId)) {
      setRoleId(category.roles[0]?.id || null);
    }
  }, [category, roleId]);

  useEffect(() => {
    if (event.roleSubcategoriesEnabled && category?.subcategories.length) {
      if (!category.subcategories.some(s => s.id === subcategoryId)) setSubcategoryId(category.subcategories[0].id);
    } else {
      setSubcategoryId(null);
    }
  }, [event.roleSubcategoriesEnabled, category, subcategoryId]);

  function updateCategories(next: RoleCategory[]) {
    setEvent(prev => ({ ...prev, roleCategories: next }));
    markDirty();
  }

  function updateSelectedCategory(next: RoleCategory) {
    updateCategories(event.roleCategories.map(c => c.id === next.id ? next : c));
  }

  function updateSelectedRole(next: EventRole) {
    if (!category) return;
    updateSelectedCategory({ ...category, roles: category.roles.map(r => r.id === next.id ? next : r) });
  }

  function assignmentIds() {
    if (!role || !category) return [];
    if (event.roleSubcategoriesEnabled && category.subcategories.length && subcategoryId) {
      return role.officialIdsBySubcategory?.[subcategoryId] || [];
    }
    return role.officialIds || [];
  }

  function setAssignmentIds(ids: string[]) {
    if (!role || !category) return;
    if (event.roleSubcategoriesEnabled && category.subcategories.length && subcategoryId) {
      updateSelectedRole({
        ...role,
        officialIdsBySubcategory: {
          ...(role.officialIdsBySubcategory || {}),
          [subcategoryId]: ids,
        },
      });
    } else {
      updateSelectedRole({ ...role, officialIds: ids });
    }
  }

  const currentIds = assignmentIds();
  const candidates = useMemo(() => {
    const q = officialSearch.trim().toLowerCase();
    return event.officials.filter(o => !currentIds.includes(o.id) && (!q || o.name.toLowerCase().includes(q)));
  }, [event.officials, currentIds, officialSearch]);

  function moveCategory(direction: number) {
    if (!category) return;
    const index = event.roleCategories.findIndex(c => c.id === category.id);
    const next = index + direction;
    if (next < 0 || next >= event.roleCategories.length) return;
    const clone = [...event.roleCategories];
    [clone[index], clone[next]] = [clone[next], clone[index]];
    updateCategories(clone);
  }

  function moveRole(direction: number) {
    if (!category || !role) return;
    const index = category.roles.findIndex(r => r.id === role.id);
    const next = index + direction;
    if (next < 0 || next >= category.roles.length) return;
    const roles = [...category.roles];
    [roles[index], roles[next]] = [roles[next], roles[index]];
    updateSelectedCategory({ ...category, roles });
  }

  return (
    <Stack spacing={2}>
      <Typography variant="h4">Ruoli</Typography>

      <Box className="roles-three-panel">
        <Card className="roles-panel">
          <CardContent>
            <Stack direction="row" alignItems="center" justifyContent="space-between" mb={1}>
              <Box>
                <Typography variant="overline" color="text.secondary">1 · Categorie</Typography>
                <Typography variant="h6">Categorie</Typography>
              </Box>
              {access.canEdit && (
                <IconButton
                  onClick={() => {
                    const next: RoleCategory = { id: newId(), name: 'Nuova categoria', subcategories: [], roles: [] };
                    updateCategories([...event.roleCategories, next]);
                    setCategoryId(next.id);
                    setRoleId(null);
                  }}
                ><AddRounded /></IconButton>
              )}
            </Stack>
            <List disablePadding>
              {event.roleCategories.map((c, index) => {
                const unassigned = c.roles.filter(r => {
                  if (event.roleSubcategoriesEnabled && c.subcategories.length) {
                    return !c.subcategories.some(s => (r.officialIdsBySubcategory?.[s.id] || []).length);
                  }
                  return !(r.officialIds || []).length;
                }).length;
                return (
                  <ListItemButton
                    key={c.id}
                    selected={c.id === categoryId}
                    onClick={() => { setCategoryId(c.id); setRoleId(c.roles[0]?.id || null); setSubcategoryId(null); }}
                    sx={{ borderRadius: 2, mb: .75 }}
                  >
                    <Box className="role-index">{String(index + 1).padStart(2, '0')}</Box>
                    <ListItemText
                      primary={c.name || 'Categoria'}
                      secondary={c.roles.length + ' ruoli' + (unassigned ? ' · ' + unassigned + ' da assegnare' : '')}
                    />
                  </ListItemButton>
                );
              })}
            </List>
          </CardContent>
        </Card>

        <Card className="roles-panel">
          <CardContent>
            <Typography variant="overline" color="text.secondary">2 · Ruoli</Typography>
            {!category ? (
              <Typography color="text.secondary">Seleziona una categoria.</Typography>
            ) : (
              <Stack spacing={2}>
                <Stack direction="row" alignItems="center" gap={1}>
                  <TextField
                    fullWidth
                    value={category.name}
                    disabled={!access.canEdit}
                    onChange={e => updateSelectedCategory({ ...category, name: e.target.value })}
                    inputProps={{ style: { fontSize: 20, fontWeight: 800 } }}
                  />
                  {access.canEdit && <>
                    <IconButton onClick={() => moveCategory(-1)}><ArrowUpwardRounded /></IconButton>
                    <IconButton onClick={() => moveCategory(1)}><ArrowDownwardRounded /></IconButton>
                    <IconButton color="error" onClick={() => {
                      if (!confirm('Eliminare la categoria e tutti i suoi ruoli?')) return;
                      updateCategories(event.roleCategories.filter(c => c.id !== category.id));
                    }}><DeleteRounded /></IconButton>
                  </>}
                </Stack>

                <Stack direction="row" alignItems="center" justifyContent="space-between">
                  <Box>
                    <Typography fontWeight={800}>Sottocategorie</Typography>
                    <Typography variant="caption" color="text.secondary">Assegnazioni separate quando servono</Typography>
                  </Box>
                  <Switch
                    checked={event.roleSubcategoriesEnabled}
                    disabled={!access.canEdit}
                    onChange={e => { setEvent(prev => ({ ...prev, roleSubcategoriesEnabled: e.target.checked })); markDirty(); }}
                  />
                </Stack>

                {event.roleSubcategoriesEnabled && (
                  <Stack direction="row" gap={1} flexWrap="wrap">
                    {category.subcategories.map(sub => (
                      <TextField
                        key={sub.id}
                        value={sub.name}
                        disabled={!access.canEdit}
                        onChange={e => updateSelectedCategory({
                          ...category,
                          subcategories: category.subcategories.map(s => s.id === sub.id ? { ...s, name: e.target.value } : s),
                        })}
                        size="small"
                        sx={{ width: 145 }}
                        InputProps={{
                          endAdornment: access.canEdit ? (
                            <InputAdornment position="end">
                              <IconButton size="small" onClick={() => updateSelectedCategory({
                                ...category,
                                subcategories: category.subcategories.filter(s => s.id !== sub.id),
                                roles: category.roles.map(r => {
                                  const by = { ...(r.officialIdsBySubcategory || {}) };
                                  delete by[sub.id];
                                  return { ...r, officialIdsBySubcategory: by };
                                }),
                              })}><CloseRounded fontSize="small" /></IconButton>
                            </InputAdornment>
                          ) : undefined,
                        }}
                      />
                    ))}
                    {access.canEdit && <Button size="small" startIcon={<AddRounded />} onClick={() => updateSelectedCategory({
                      ...category,
                      subcategories: [...category.subcategories, { id: newId(), name: '' }],
                    })}>Sottocategoria</Button>}
                  </Stack>
                )}

                <Divider />
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography variant="h6">Ruoli</Typography>
                  {access.canEdit && <Button size="small" startIcon={<AddRounded />} onClick={() => {
                    const next = { id: newId(), name: 'Nuovo ruolo', officialIds: [], officialIdsBySubcategory: {} };
                    updateSelectedCategory({ ...category, roles: [...category.roles, next] });
                    setRoleId(next.id);
                  }}>Nuovo ruolo</Button>}
                </Stack>
                <List disablePadding>
                  {category.roles.map(r => {
                    const count = event.roleSubcategoriesEnabled && category.subcategories.length
                      ? new Set(category.subcategories.flatMap(s => r.officialIdsBySubcategory?.[s.id] || [])).size
                      : new Set(r.officialIds || []).size;
                    return (
                      <ListItemButton key={r.id} selected={r.id === roleId} onClick={() => setRoleId(r.id)} sx={{ borderRadius: 2, mb: .5 }}>
                        <ListItemText primary={r.name || 'Ruolo'} secondary={count ? count + ' UG assegnati' : 'Nessun UG assegnato'} />
                      </ListItemButton>
                    );
                  })}
                </List>
              </Stack>
            )}
          </CardContent>
        </Card>

        <Card className="roles-panel assignment-panel">
          <CardContent>
            <Typography variant="overline" color="text.secondary">3 · Assegnazioni</Typography>
            {!category || !role ? (
              <Stack alignItems="center" justifyContent="center" minHeight={360}>
                <PersonAddRounded sx={{ fontSize: 48, color: 'text.secondary' }} />
                <Typography variant="h6" mt={1}>Seleziona un ruolo</Typography>
                <Typography color="text.secondary">Qui compariranno le assegnazioni.</Typography>
              </Stack>
            ) : (
              <Stack spacing={2}>
                <Stack direction="row" gap={1} alignItems="center">
                  <TextField
                    fullWidth
                    value={role.name}
                    disabled={!access.canEdit}
                    onChange={e => updateSelectedRole({ ...role, name: e.target.value })}
                    inputProps={{ style: { fontSize: 22, fontWeight: 800 } }}
                  />
                  {access.canEdit && <>
                    <IconButton onClick={() => moveRole(-1)}><ArrowUpwardRounded /></IconButton>
                    <IconButton onClick={() => moveRole(1)}><ArrowDownwardRounded /></IconButton>
                    <IconButton color="error" onClick={() => {
                      updateSelectedCategory({ ...category, roles: category.roles.filter(r => r.id !== role.id) });
                      setRoleId(null);
                    }}><DeleteRounded /></IconButton>
                  </>}
                </Stack>

                {event.roleSubcategoriesEnabled && category.subcategories.length > 0 && (
                  <Stack direction="row" gap={1} flexWrap="wrap">
                    {category.subcategories.map(sub => (
                      <Chip
                        key={sub.id}
                        label={sub.name || 'Sottocategoria'}
                        color={sub.id === subcategoryId ? 'primary' : 'default'}
                        onClick={() => setSubcategoryId(sub.id)}
                      />
                    ))}
                  </Stack>
                )}

                <Divider />
                <Box>
                  <Typography fontWeight={800}>Assegnati</Typography>
                  <Typography variant="caption" color="text.secondary">{currentIds.length} ufficiali gara</Typography>
                </Box>
                <Stack spacing={1}>
                  {currentIds.map(id => {
                    const official = event.officials.find(o => o.id === id);
                    if (!official) return null;
                    return (
                      <Card variant="outlined" key={id}>
                        <CardContent sx={{ py: 1.25, '&:last-child': { pb: 1.25 }, display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Box className="official-avatar">{official.name.slice(0,2).toUpperCase()}</Box>
                          <Box sx={{ flexGrow: 1 }}>
                            <Typography fontWeight={800}>{official.name}</Typography>
                            <Typography variant="caption" color="text.secondary">{official.notes}</Typography>
                          </Box>
                          {access.canEdit && <IconButton size="small" onClick={() => setAssignmentIds(currentIds.filter(x => x !== id))}><CloseRounded /></IconButton>}
                        </CardContent>
                      </Card>
                    );
                  })}
                  {!currentIds.length && <Typography color="text.secondary">Nessun UG assegnato.</Typography>}
                </Stack>

                <Divider />
                <TextField
                  placeholder="Cerca ufficiale gara"
                  value={officialSearch}
                  onChange={e => setOfficialSearch(e.target.value)}
                  InputProps={{ startAdornment: <InputAdornment position="start"><SearchRounded /></InputAdornment> }}
                />
                <Stack spacing={.75} maxHeight={280} overflow="auto">
                  {candidates.map(o => (
                    <ListItemButton
                      key={o.id}
                      disabled={!access.canEdit}
                      onClick={() => setAssignmentIds([...new Set([...currentIds, o.id])])}
                      sx={{ borderRadius: 2, bgcolor: 'background.default' }}
                    >
                      <Box className="official-avatar">{o.name.slice(0,2).toUpperCase()}</Box>
                      <ListItemText primary={o.name || 'UG senza nome'} secondary={o.notes} sx={{ ml: 1 }} />
                      <AddRounded />
                    </ListItemButton>
                  ))}
                </Stack>
              </Stack>
            )}
          </CardContent>
        </Card>
      </Box>
    </Stack>
  );
}
