(() => {
  "use strict";

  class SelectionManager {
    constructor() {
      this.selectedIds = new Set();
      this.anchorId = null;
    }

    clear() {
      this.selectedIds.clear();
      this.anchorId = null;
    }

    selectOnly(id) {
      this.selectedIds = new Set(id ? [id] : []);
      this.anchorId = id || null;
    }

    set(ids, anchorId = null) {
      this.selectedIds = new Set(ids || []);
      this.anchorId = anchorId && this.selectedIds.has(anchorId)
        ? anchorId
        : (this.selectedIds.values().next().value || null);
    }

    has(id) {
      return this.selectedIds.has(id);
    }

    values() {
      return [...this.selectedIds];
    }

    size() {
      return this.selectedIds.size;
    }

    handleClick(id, event, visibleIds) {
      const additive = Boolean(event?.ctrlKey || event?.metaKey);
      const ranged = Boolean(event?.shiftKey);
      const visible = Array.isArray(visibleIds) ? visibleIds : [];

      if (ranged && this.anchorId && visible.includes(this.anchorId) && visible.includes(id)) {
        const from = visible.indexOf(this.anchorId);
        const to = visible.indexOf(id);
        const start = Math.min(from, to);
        const end = Math.max(from, to);
        const range = visible.slice(start, end + 1);

        if (additive) {
          for (const rangeId of range) this.selectedIds.add(rangeId);
        } else {
          this.selectedIds = new Set(range);
        }
        return;
      }

      if (additive) {
        if (this.selectedIds.has(id)) {
          this.selectedIds.delete(id);
          if (this.anchorId === id) this.anchorId = this.selectedIds.values().next().value || null;
        } else {
          this.selectedIds.add(id);
          this.anchorId = id;
        }
        return;
      }

      this.selectOnly(id);
    }
  }

  window.ChatGPTExplorerSelectionManager = SelectionManager;
})();
