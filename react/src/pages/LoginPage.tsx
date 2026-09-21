import { useState } from 'react';
import { Alert, Box, Button, Card, CardContent, Stack, TextField, Typography } from '@mui/material';
import LoginRounded from '@mui/icons-material/LoginRounded';
import WavesRounded from '@mui/icons-material/WavesRounded';
import { useAuth } from '../contexts/AuthContext';

export default function LoginPage() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await signIn(email.trim(), password);
    } catch (err: any) {
      setError(err?.message || 'Accesso non riuscito');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Box className="login-page">
      <Card className="login-card">
        <CardContent sx={{ p: 4 }}>
          <Stack direction="row" spacing={2} alignItems="center" mb={3}>
            <Box className="brand-mark"><WavesRounded /></Box>
            <Box>
              <Typography variant="h5">Gestione OW</Typography>
              <Typography color="text.secondary">Accedi al gestionale</Typography>
            </Box>
          </Stack>

          <Stack component="form" spacing={2} onSubmit={submit}>
            {error && <Alert severity="error">{error}</Alert>}
            <TextField label="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="username" />
            <TextField label="Password" type="password" value={password} onChange={e => setPassword(e.target.value)} required autoComplete="current-password" />
            <Button type="submit" variant="contained" size="large" startIcon={<LoginRounded />} disabled={busy}>
              {busy ? 'Accesso…' : 'Accedi'}
            </Button>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}
