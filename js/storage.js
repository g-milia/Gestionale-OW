(() => {
  const KEYS = { owner: "owGithubOwner", repo: "owGithubRepo", branch: "owGithubBranch", token: "owGithubToken" };
  window.OWStorage = {
    loadGithubConfig() {
      return {
        owner: localStorage.getItem(KEYS.owner) || "g-milia",
        repo: localStorage.getItem(KEYS.repo) || "Gestionale-OW",
        branch: localStorage.getItem(KEYS.branch) || "main",
        token: sessionStorage.getItem(KEYS.token) || ""
      };
    },
    saveGithubConfig(config) {
      localStorage.setItem(KEYS.owner, config.owner || "");
      localStorage.setItem(KEYS.repo, config.repo || "");
      localStorage.setItem(KEYS.branch, config.branch || "main");
      sessionStorage.setItem(KEYS.token, config.token || "");
    },
    clearToken() { sessionStorage.removeItem(KEYS.token); }
  };
})();
