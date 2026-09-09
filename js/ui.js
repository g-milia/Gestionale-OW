(() => {
  window.OWUI = {
    setStatus(text, isError = false) {
      const node = document.getElementById("status");
      if (!node) return;
      node.textContent = text || "";
      node.style.color = isError ? "var(--danger)" : "var(--muted)";
      if (text) setTimeout(() => { if (node.textContent === text) node.textContent = ""; }, 4500);
    }
  };
})();
