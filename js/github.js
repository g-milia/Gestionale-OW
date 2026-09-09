(() => {
  window.OWGithub = {
    async request(config, path, options = {}) {
      const response = await fetch(`https://api.github.com${path}`, {
        ...options,
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${config.token}`,
          "X-GitHub-Api-Version": "2022-11-28",
          ...(options.headers || {})
        }
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        const error = new Error(data.message || `Errore GitHub ${response.status}`);
        error.status = response.status;
        throw error;
      }
      return response.status === 204 ? null : response.json();
    }
  };
})();
