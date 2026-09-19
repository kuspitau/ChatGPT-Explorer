(() => {
  "use strict";

  const STORAGE_KEY = "chatgptExplorerState";
  const SCHEMA_VERSION = 1;

  function emptyState() {
    return {
      schemaVersion: SCHEMA_VERSION,
      nodes: []
    };
  }

  function normalizeState(candidate) {
    if (!candidate || typeof candidate !== "object" || !Array.isArray(candidate.nodes)) {
      return emptyState();
    }

    const nodes = candidate.nodes
      .filter((node) => node && typeof node === "object")
      .filter((node) => node.type === "folder" || node.type === "chat")
      .map((node, index) => ({
        id: typeof node.id === "string" && node.id ? node.id : crypto.randomUUID(),
        type: node.type,
        name: typeof node.name === "string" && node.name.trim() ? node.name.trim() : "Untitled",
        parentId: typeof node.parentId === "string" ? node.parentId : null,
        url: node.type === "chat" && typeof node.url === "string" ? node.url : null,
        chatTitle: node.type === "chat" && typeof node.chatTitle === "string" ? node.chatTitle : null,
        sortIndex: Number.isFinite(node.sortIndex) ? node.sortIndex : index,
        createdAt: typeof node.createdAt === "string" ? node.createdAt : new Date().toISOString(),
        updatedAt: typeof node.updatedAt === "string" ? node.updatedAt : new Date().toISOString()
      }));

    const ids = new Set(nodes.map((node) => node.id));
    for (const node of nodes) {
      if (node.parentId && !ids.has(node.parentId)) {
        node.parentId = null;
      }
    }

    return {
      schemaVersion: SCHEMA_VERSION,
      nodes
    };
  }

  async function load() {
    const stored = await chrome.storage.local.get(STORAGE_KEY);
    return normalizeState(stored[STORAGE_KEY]);
  }

  async function save(state) {
    const normalized = normalizeState(state);
    await chrome.storage.local.set({ [STORAGE_KEY]: normalized });
    return normalized;
  }

  function exportPayload(state) {
    return {
      format: "chatgpt-explorer",
      exportedAt: new Date().toISOString(),
      state: normalizeState(state)
    };
  }

  function importPayload(payload) {
    if (!payload || payload.format !== "chatgpt-explorer" || !payload.state) {
      throw new Error("This file is not a ChatGPT Explorer export.");
    }
    return normalizeState(payload.state);
  }

  window.ChatGPTExplorerStorage = {
    load,
    save,
    exportPayload,
    importPayload,
    normalizeState,
    emptyState
  };
})();
