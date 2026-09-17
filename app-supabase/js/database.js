(() => {
  const rpc = async (name, args = {}) => {
    const { data, error } = await OWAuth.client.rpc(name, args);
    if (error) throw error;
    return data;
  };

  window.OWDatabase = {
    listEvents: () => rpc('list_events'),
    getEvent: code => rpc('get_event', { p_code: code }),
    saveEvent: event => rpc('save_event', { p_event: event }),
    deleteEvent: code => rpc('delete_event', { p_code: code })
  };
})();
