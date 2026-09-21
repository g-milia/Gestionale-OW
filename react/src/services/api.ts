import { supabase } from '../lib/supabase';
import type { AccessRole, EventAccess, EventRecord, EventSummary, GlobalAccess, PermissionRow } from '../types';

async function rpc<T>(name: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.rpc(name, args);
  if (error) throw error;
  return data as T;
}

function fromApi(event: any): EventRecord {
  if (!event) return event;
  const copy = structuredClone(event);
  copy.id = copy.eventId || copy.id || '';
  delete copy.eventId;
  return copy as EventRecord;
}

function toApi(event: EventRecord) {
  const copy: any = structuredClone(event);
  copy.eventId = copy.id || null;
  delete copy.id;
  return copy;
}

export const api = {
  async listEvents(): Promise<EventSummary[]> {
    return (await rpc<EventSummary[]>('list_events_v2')) || [];
  },
  async getEvent(eventId: string): Promise<EventRecord> {
    return fromApi(await rpc('get_event_v2', { p_event_id: eventId }));
  },
  async saveEvent(event: EventRecord): Promise<EventRecord> {
    return fromApi(await rpc('save_event_v2', { p_event: toApi(event) }));
  },
  async importEvent(event: EventRecord): Promise<EventRecord> {
    return fromApi(await rpc('import_event_v2', { p_event: toApi(event) }));
  },
  deleteEvent(eventId: string) {
    return rpc<boolean>('delete_event_v2', { p_event_id: eventId });
  },
  currentUserAccess() {
    return rpc<GlobalAccess>('get_current_user_access');
  },
  eventAccess(eventId: string) {
    return rpc<EventAccess>('get_my_event_access', { p_event_id: eventId });
  },
  listEventPermissions(eventId: string) {
    return rpc<PermissionRow[]>('list_event_permissions', { p_event_id: eventId });
  },
  setEventPermission(eventId: string, userId: string, role: AccessRole) {
    return rpc<boolean>('set_event_permission', {
      p_event_id: eventId,
      p_user_id: userId,
      p_role: role || null,
    });
  },
};
