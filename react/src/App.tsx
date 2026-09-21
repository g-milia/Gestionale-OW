import { Navigate, Route, Routes } from 'react-router-dom';
import { CircularProgress, Box } from '@mui/material';
import { useAuth } from './contexts/AuthContext';
import LoginPage from './pages/LoginPage';
import EventsPage from './pages/EventsPage';
import EventLayout from './pages/event/EventLayout';
import GeneralPage from './pages/event/GeneralPage';
import DeparturesPage from './pages/event/DeparturesPage';
import TimelinePage from './pages/event/TimelinePage';
import OfficialsPage from './pages/event/OfficialsPage';
import RolesPage from './pages/event/RolesPage';
import NotesPage from './pages/event/NotesPage';
import PermissionsPage from './pages/event/PermissionsPage';

export default function App() {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!session) return <LoginPage />;

  return (
    <Routes>
      <Route path="/" element={<Navigate to="/events" replace />} />
      <Route path="/events" element={<EventsPage />} />
      <Route path="/events/:eventId" element={<EventLayout />}>
        <Route index element={<Navigate to="general" replace />} />
        <Route path="general" element={<GeneralPage />} />
        <Route path="departures" element={<DeparturesPage />} />
        <Route path="timeline" element={<TimelinePage />} />
        <Route path="officials" element={<OfficialsPage />} />
        <Route path="roles" element={<RolesPage />} />
        <Route path="notes" element={<NotesPage />} />
        <Route path="permissions" element={<PermissionsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/events" replace />} />
    </Routes>
  );
}
