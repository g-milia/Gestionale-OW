(() => {
  window.OWGithub = {
    async request(config, path, options = {}) {
      const url = `https://api.github.com${path}`;
      const response = await fetch(url, {
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
        const details = [
          `GitHub HTTP ${response.status} ${response.statusText}`,
          data.message ? `Messaggio: ${data.message}` : null,
          data.documentation_url ? `Documentazione: ${data.documentation_url}` : null,
          data.status ? `Status API: ${data.status}` : null,
          `Richiesta: ${options.method || "GET"} ${path}`
        ].filter(Boolean).join(" | ");

        const error = new Error(details);
        error.status = response.status;
        error.github = data;
        error.requestPath = path;
        throw error;
      }

      return response.status === 204 ? null : response.json();
    }
  };
})();
