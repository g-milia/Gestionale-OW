(() => {
  const rpc = async (name, args = {}) => {
    const { data, error } = await OWAuth.client.rpc(name, args);
    if (error) throw error;
    return data;
  };

  const fromApi = event => {
    if (!event) return event;
    const copy = structuredClone(event);
    copy.id = copy.eventId || copy.id || '';
    delete copy.eventId;
    return copy;
  };

  const toApi = event => {
    const copy = structuredClone(event || {});
    copy.eventId = copy.id || null;
    delete copy.id;
    return copy;
  };

  window.OWDatabase = {
    async listEvents() {
      const rows = await rpc('list_events_v2');
      return (rows || []).map(row => ({
        ...row,
        code: row.event_id
      }));
    },
    async getEvent(eventId) {
      return fromApi(await rpc('get_event_v2', { p_event_id: eventId }));
    },
    async saveEvent(event) {
      return fromApi(await rpc('save_event_v2', { p_event: toApi(event) }));
    },
    async importEvent(event) {
      return fromApi(await rpc('import_event_v2', { p_event: toApi(event) }));
    },
    deleteEvent: eventId => rpc('delete_event_v2', { p_event_id: eventId })
  };
})();
