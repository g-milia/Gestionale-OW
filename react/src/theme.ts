import { createTheme } from '@mui/material/styles';

export const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#0D3265',
      dark: '#08264F',
      light: '#E9F1FB',
      contrastText: '#FFFFFF',
    },
    background: {
      default: '#EEF2F6',
      paper: '#FFFFFF',
    },
    text: {
      primary: '#0C2243',
      secondary: '#6C7A90',
    },
    divider: '#D8E0EB',
    success: { main: '#1E8E55' },
    warning: { main: '#A86A00' },
    error: { main: '#C33B48' },
  },
  shape: {
    borderRadius: 18,
  },
  typography: {
    fontFamily: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    h4: { fontWeight: 800, letterSpacing: '-0.025em' },
    h5: { fontWeight: 800, letterSpacing: '-0.02em' },
    h6: { fontWeight: 800 },
    button: { fontWeight: 750, textTransform: 'none' },
  },
  components: {
    MuiCard: {
      styleOverrides: {
        root: {
          border: '1px solid #D8E0EB',
          boxShadow: '0 12px 35px rgba(16,44,84,.06)',
        },
      },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: { root: { borderRadius: 12, minHeight: 42 } },
    },
    MuiTextField: {
      defaultProps: { size: 'small' },
    },
    MuiDialog: {
      styleOverrides: {
        paper: { borderRadius: 22 },
      },
    },
  },
});
