import { Button, Card, CardContent, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, Stack, TextField, Typography } from '@mui/material';
import AddRounded from '@mui/icons-material/AddRounded';
import EditRounded from '@mui/icons-material/EditRounded';
import DeleteRounded from '@mui/icons-material/DeleteRounded';
import { useState } from 'react';

export interface CrudField {
  key: string;
  label: string;
  type?: string;
  multiline?: boolean;
}

export default function CrudList<T extends { id: string }>({
  title,
  items,
  fields,
  canEdit,
  render,
  newItem,
  onChange,
}: {
  title: string;
  items: T[];
  fields: CrudField[];
  canEdit: boolean;
  render(item: T): React.ReactNode;
  newItem(): T;
  onChange(next: T[]): void;
}) {
  const [editing, setEditing] = useState<T | null>(null);
  const [draft, setDraft] = useState<Record<string, unknown>>({});

  function open(item: T) {
    setEditing(item);
    setDraft(structuredClone(item) as Record<string, unknown>);
  }

  function save() {
    if (!editing) return;
    const index = items.findIndex(x => x.id === editing.id);
    const next = [...items];
    if (index >= 0) next[index] = { ...editing, ...draft } as T;
    else next.push({ ...editing, ...draft } as T);
    onChange(next);
    setEditing(null);
  }

  return (
    <>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h4">{title}</Typography>
        {canEdit && <Button variant="contained" startIcon={<AddRounded />} onClick={() => open(newItem())}>Aggiungi</Button>}
      </Stack>
      <Stack spacing={1.25}>
        {items.map(item => (
          <Card key={item.id}>
            <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Stack sx={{ flexGrow: 1 }}>{render(item)}</Stack>
              {canEdit && (
                <Stack direction="row">
                  <IconButton onClick={() => open(item)}><EditRounded /></IconButton>
                  <IconButton color="error" onClick={() => onChange(items.filter(x => x.id !== item.id))}><DeleteRounded /></IconButton>
                </Stack>
              )}
            </CardContent>
          </Card>
        ))}
        {!items.length && <Card><CardContent><Typography color="text.secondary">Nessun elemento inserito.</Typography></CardContent></Card>}
      </Stack>

      <Dialog open={!!editing} onClose={() => setEditing(null)} fullWidth maxWidth="sm">
        <DialogTitle>Modifica</DialogTitle>
        <DialogContent>
          <Stack spacing={2} mt={1}>
            {fields.map(field => (
              <TextField
                key={field.key}
                label={field.label}
                type={field.type || 'text'}
                multiline={field.multiline}
                minRows={field.multiline ? 3 : undefined}
                value={String(draft[field.key] ?? '')}
                onChange={e => setDraft(prev => ({ ...prev, [field.key]: field.type === 'number' ? Number(e.target.value || 0) : e.target.value }))}
                InputLabelProps={field.type === 'time' ? { shrink: true } : undefined}
              />
            ))}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditing(null)}>Annulla</Button>
          <Button variant="contained" onClick={save}>Salva</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
