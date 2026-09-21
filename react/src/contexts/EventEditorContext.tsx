import { createContext, useContext, useEffect, useMemo, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import { normalizeEvent } from '../utils/event';
import type { EventAccess, EventRecord } from '../types';

interface EditorValue {
  eventId: string;
  event: EventRecord;
  setEvent: Dispatch<SetStateAction<EventRecord>>;
  access: EventAccess;
  dirty: boolean;
  markDirty(): void;
  save(): Promise<EventRecord>;
  saving: boolean;
}

const EventEditorContext = createContext<EditorValue | null>(null);

export function EventEditorProvider({ eventId, children }: { eventId: string; children: ReactNode }) {
  const queryClient = useQueryClient();
  const eventQuery = useQuery({
    queryKey: ['event', eventId],
    queryFn: () => api.getEvent(eventId),
  });
  const accessQuery = useQuery({
    queryKey: ['event-access', eventId],
    queryFn: () => api.eventAccess(eventId),
  });

  if (eventQuery.isLoading || accessQuery.isLoading) return <div>Caricamento evento…</div>;
  if (eventQuery.error) throw eventQuery.error;
  if (accessQuery.error) throw accessQuery.error;
  if (!eventQuery.data || !accessQuery.data) throw new Error('Evento non disponibile');

  return (
    <LoadedEditor
      eventId={eventId}
      source={normalizeEvent(eventQuery.data)}
      access={accessQuery.data}
      onSaved={(saved) => {
        queryClient.setQueryData(['event', eventId], saved);
        queryClient.invalidateQueries({ queryKey: ['events'] });
      }}
    >
      {children}
    </LoadedEditor>
  );
}

function LoadedEditor({
  eventId,
  source,
  access,
  onSaved,
  children,
}: {
  eventId: string;
  source: EventRecord;
  access: EventAccess;
  onSaved(saved: EventRecord): void;
  children: ReactNode;
}) {
  const [event, setEvent] = useState(source);
  const [dirty, setDirty] = useState(false);

  useEffect(() => setEvent(source), [source]);

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (!dirty) return;
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = structuredClone(event);
      const now = new Date().toISOString();
      payload.version = 4;
      payload.createdAt = payload.createdAt || now;
      payload.savedAt = now;
      return api.saveEvent(payload);
    },
    onSuccess(saved) {
      const normalized = normalizeEvent(saved);
      setEvent(normalized);
      setDirty(false);
      onSaved(normalized);
    },
  });

  const value = useMemo<EditorValue>(() => ({
    eventId,
    event,
    setEvent,
    access,
    dirty,
    markDirty: () => setDirty(true),
    save: () => saveMutation.mutateAsync(),
    saving: saveMutation.isPending,
  }), [eventId, event, access, dirty, saveMutation.isPending]);

  return <EventEditorContext.Provider value={value}>{children}</EventEditorContext.Provider>;
}

export function useEventEditor() {
  const value = useContext(EventEditorContext);
  if (!value) throw new Error('EventEditorProvider mancante');
  return value;
}
