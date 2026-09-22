(() => {
  "use strict";

  const SETTINGS_KEY = "chatgptExplorerSettings";
  const SETTINGS_SCHEMA_VERSION = 1;

  function uniqueStrings(value) {
    if (!Array.isArray(value)) return [];
    return [...new Set(value.filter((item) => typeof item === "string" && item))];
  }

  function emptySettings() {
    return {
      schemaVersion: SETTINGS_SCHEMA_VERSION,
      quickAddEnabled: false,
      branchTrackingEnabled: false,
      quickAddParentId: null,
      expandedFolderIds: [],
      viewMode: "explorer"
    };
  }

  function normalizeSettings(candidate) {
    const normalized = emptySettings();
    if (!candidate || typeof candidate !== "object") return normalized;

    normalized.quickAddEnabled = candidate.quickAddEnabled === true;
    normalized.branchTrackingEnabled = candidate.branchTrackingEnabled === true;
    normalized.quickAddParentId = typeof candidate.quickAddParentId === "string" && candidate.quickAddParentId
      ? candidate.quickAddParentId
      : null;
    normalized.expandedFolderIds = uniqueStrings(candidate.expandedFolderIds);
    normalized.viewMode = candidate.viewMode === "families" ? "families" : "explorer";
    return normalized;
  }

  async function load() {
    const stored = await chrome.storage.local.get(SETTINGS_KEY);
    return normalizeSettings(stored[SETTINGS_KEY]);
  }

  async function save(settings) {
    const normalized = normalizeSettings(settings);
    await chrome.storage.local.set({ [SETTINGS_KEY]: normalized });
    return normalized;
  }

  globalThis.ChatGPTExplorerSettings = {
    SETTINGS_KEY,
    emptySettings,
    normalizeSettings,
    load,
    save
  };
})();
