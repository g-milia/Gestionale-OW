(() => {
  const TOKEN_KEY = "owGithubToken";

  window.OWStorage = {
    loadGithubConfig() {
      return {
        owner: "g-milia",
        repo: "Gestionale-OW",
        branch: "main",
        token: sessionStorage.getItem(TOKEN_KEY) || ""
      };
    },
    saveGithubConfig(config) {
      sessionStorage.setItem(TOKEN_KEY, config.token || "");
    },
    clearToken() {
      sessionStorage.removeItem(TOKEN_KEY);
    }
  };
})();
