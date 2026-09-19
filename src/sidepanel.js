(() => {
  "use strict";

  const Storage = window.ChatGPTExplorerStorage;
  const SelectionManager = window.ChatGPTExplorerSelectionManager;
  const TreeOps = window.ChatGPTExplorerTreeOps;
  const DragManager = window.ChatGPTExplorerDragManager;

  const treeElement = document.getElementById("tree");
  const emptyStateElement = document.getElementById("empty-state");
  const statusElement = document.getElementById("status");
  const selectionHintElement = document.getElementById("selection-hint");
  const sortModeElement = document.getElementById("sort-mode");
  const importFileElement = document.getElementById("import-file");
  const rootDropZone = document.getElementById("root-drop-zone");

  let state = Storage.emptyState();
  let sortMode = "manual";
  let visibleIds = [];
  const collapsed = new Set();
  const selection = new SelectionManager();
  const drag = new DragManager();

  function now() {
    return new Date().toISOString();
  }

  function setStatus(message = "", kind = "info") {
    statusElement.textContent = message;
    statusElement.dataset.kind = kind;
  }

  function nodeById(id) {
    return TreeOps.nodeById(state, id);
  }

  function destinationId() {
    const anchor = nodeById(selection.anchorId);
    if (!anchor) return null;
    return anchor.type === "folder" ? anchor.id : anchor.parentId;
  }

  function destinationLabel() {
    const id = destinationId();
    return id ? (nodeById(id)?.name || "root") : "root";
  }

  function updateSelectionHint() {
    const count = selection.size();
    selectionHintElement.textContent = `Selected: ${count} · Add destination: ${destinationLabel()}`;
  }

  function nextSortIndex(parentId) {
    const siblings = state.nodes.filter((node) => node.parentId === parentId);
    if (!siblings.length) return 0;
    return Math.max(...siblings.map((node) => Number(node.sortIndex) || 0)) + 1;
  }

  function sortedChildren(parentId) {
    const children = state.nodes.filter((node) => node.parentId === parentId);
    if (sortMode === "az" || sortMode === "za") {
      const direction = sortMode === "az" ? 1 : -1;
      return children.sort((a, b) => direction * a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
    }
    return children.sort((a, b) => (a.sortIndex - b.sortIndex) || a.name.localeCompare(b.name));
  }

  function hasChildren(nodeId) {
    return state.nodes.some((node) => node.parentId === nodeId);
  }

  function orderedSelectedIds() {
    const selectedSet = new Set(selection.values());
    const visibleSelected = visibleIds.filter((id) => selectedSet.has(id));
    const hiddenSelected = selection.values().filter((id) => !visibleIds.includes(id));
    return [...visibleSelected, ...hiddenSelected];
  }

  function selectFromClick(id, event) {
    selection.handleClick(id, event, visibleIds);
    render();
  }

  function refreshSelectionClasses() {
    for (const row of treeElement.querySelectorAll(".tree-row[data-node-id]")) {
      const selected = selection.has(row.dataset.nodeId);
      row.classList.toggle("selected", selected);
      row.setAttribute("aria-selected", selected ? "true" : "false");
    }
    updateSelectionHint();
  }

  function createActionButton(label, title, handler) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "icon-button";
    button.textContent = label;
    button.title = title;
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      handler();
    });
    return button;
  }


  function renderNode(node, depth) {
    visibleIds.push(node.id);

    const wrapper = document.createElement("div");
    const row = document.createElement("div");
    row.className = "tree-row" + (selection.has(node.id) ? " selected" : "");
    row.style.paddingLeft = `${depth * 14}px`;
    row.dataset.nodeId = node.id;
    row.dataset.nodeType = node.type;
    row.setAttribute("role", "treeitem");
    row.setAttribute("aria-selected", selection.has(node.id) ? "true" : "false");

    row.addEventListener("click", (event) => {
      event.stopPropagation();
      if (row.dataset.suppressClick === "true") {
        row.dataset.suppressClick = "false";
        return;
      }
      selectFromClick(node.id, event);
    });

    row.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;
      if (event.target.closest("button")) return;
      drag.arm(event.pointerId, event.clientX, event.clientY);
    });

    if (node.type === "folder") {
      const toggle = document.createElement("button");
      toggle.type = "button";
      toggle.className = "tree-toggle";
      const expandable = hasChildren(node.id);
      toggle.textContent = expandable ? (collapsed.has(node.id) ? "▸" : "▾") : "";
      toggle.title = expandable ? "Expand/collapse" : "Empty folder";
      toggle.addEventListener("click", (event) => {
        event.stopPropagation();
        if (!expandable) return;
        collapsed.has(node.id) ? collapsed.delete(node.id) : collapsed.add(node.id);
        render();
      });
      row.appendChild(toggle);
    } else {
      const spacer = document.createElement("span");
      spacer.className = "tree-spacer";
      spacer.textContent = "•";
      row.appendChild(spacer);
    }

    const label = document.createElement("div");
    label.className = `tree-label ${node.type}`;
    label.textContent = node.name;
    label.title = node.type === "chat" && node.chatTitle
      ? `${node.name}\nChatGPT: ${node.chatTitle}`
      : node.name;

    if (node.type === "chat") {
      label.addEventListener("dblclick", (event) => {
        event.stopPropagation();
        openChat(node);
      });
    }
    row.appendChild(label);

    const actions = document.createElement("div");
    actions.className = "tree-actions";
    if (node.type === "chat") {
      actions.appendChild(createActionButton("↗", "Open chat", () => openChat(node)));
    }
    actions.appendChild(createActionButton("✎", "Rename", () => renameNode(node.id)));
    actions.appendChild(createActionButton("×", "Delete", () => deleteSelectionOrNode(node.id)));
    row.appendChild(actions);

    wrapper.appendChild(row);

    if (node.type === "folder" && !collapsed.has(node.id)) {
      for (const child of sortedChildren(node.id)) {
        wrapper.appendChild(renderNode(child, depth + 1));
      }
    }

    return wrapper;
  }

  function render() {
    visibleIds = [];
    treeElement.replaceChildren();
    for (const node of sortedChildren(null)) {
      treeElement.appendChild(renderNode(node, 0));
    }
    emptyStateElement.hidden = state.nodes.length !== 0;
    updateSelectionHint();
  }

  async function persist(message) {
    state = await Storage.save(state);
    render();
    if (message) setStatus(message);
  }

  async function addFolder() {
    const parentId = destinationId();
    const name = window.prompt("Folder name:", "New folder");
    if (!name || !name.trim()) return;

    const timestamp = now();
    const node = {
      id: crypto.randomUUID(),
      type: "folder",
      name: name.trim(),
      parentId,
      url: null,
      chatTitle: null,
      sortIndex: nextSortIndex(parentId),
      createdAt: timestamp,
      updatedAt: timestamp
    };
    state.nodes.push(node);
    selection.selectOnly(node.id);
    await persist(`Created folder “${node.name}”.`);
  }

  function normalizeChatTitle(title) {
    const cleaned = (title || "").replace(/\s*[|–—-]\s*ChatGPT\s*$/i, "").trim();
    return cleaned || "ChatGPT conversation";
  }

  function isSupportedChatUrl(rawUrl) {
    try {
      const url = new URL(rawUrl);
      const supportedHost = url.hostname === "chatgpt.com" || url.hostname === "chat.openai.com";
      return supportedHost && /\/c\/[^/]+/.test(url.pathname);
    } catch {
      return false;
    }
  }

  async function addCurrentChat() {
    setStatus("");
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !isSupportedChatUrl(tab.url || "")) {
      setStatus("Open a ChatGPT conversation first (chatgpt.com/c/…).", "error");
      return;
    }

    const existing = state.nodes.find((node) => node.type === "chat" && node.url === tab.url);
    if (existing) {
      selection.selectOnly(existing.id);
      render();
      setStatus(`Already saved as “${existing.name}”.`);
      return;
    }

    const parentId = destinationId();
    const chatTitle = normalizeChatTitle(tab.title);
    const timestamp = now();
    const node = {
      id: crypto.randomUUID(),
      type: "chat",
      name: chatTitle,
      parentId,
      url: tab.url,
      chatTitle,
      sortIndex: nextSortIndex(parentId),
      createdAt: timestamp,
      updatedAt: timestamp
    };
    state.nodes.push(node);
    selection.selectOnly(node.id);
    await persist(`Added “${node.name}”.`);
  }

  async function openChat(node) {
    if (!node?.url) return;
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id) {
        await chrome.tabs.update(tab.id, { url: node.url });
      } else {
        await chrome.tabs.create({ url: node.url });
      }
      setStatus(`Opening “${node.name}”…`);
    } catch (error) {
      console.error(error);
      setStatus("Unable to open this conversation.", "error");
    }
  }

  async function renameNode(id) {
    const node = nodeById(id);
    if (!node) return;
    const name = window.prompt("New name:", node.name);
    if (!name || !name.trim() || name.trim() === node.name) return;
    node.name = name.trim();
    node.updatedAt = now();
    await persist(`Renamed to “${node.name}”.`);
  }

  async function deleteSelectionOrNode(clickedId = null) {
    if (clickedId && !selection.has(clickedId)) selection.selectOnly(clickedId);
    const orderedIds = orderedSelectedIds();
    if (!orderedIds.length) return;

    const { roots, all } = TreeOps.idsToDelete(state, orderedIds);
    if (!roots.length) return;

    const rootCount = roots.length;
    const nestedCount = all.size - rootCount;
    const description = rootCount === 1 ? "1 selected item" : `${rootCount} selected items`;
    const nested = nestedCount > 0 ? ` plus ${nestedCount} nested item(s)` : "";
    if (!window.confirm(`Delete ${description}${nested}?`)) return;

    TreeOps.deleteNodes(state, orderedIds);
    selection.clear();
    await persist(`Deleted ${all.size} item(s).`);
  }

  async function moveDraggedTo(newParentId) {
    const movingIds = [...drag.draggedIds];
    const result = TreeOps.moveNodes(state, movingIds, newParentId, now());
    drag.end();

    if (!result.movedIds.length) {
      setStatus("Unable to move the selected item(s) there.", "error");
      return;
    }

    selection.set(selection.values(), selection.anchorId);
    const targetName = newParentId ? nodeById(newParentId)?.name || "folder" : "root";
    await persist(`Moved ${result.movedIds.length} item(s) to ${targetName}.`);
  }

  function exportData() {
    const payload = Storage.exportPayload(state);
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `chatgpt-explorer-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    setStatus("Export created.");
  }

  async function importData(file) {
    try {
      const text = await file.text();
      const payload = JSON.parse(text);
      const imported = Storage.importPayload(payload);
      const count = imported.nodes.length;
      if (!window.confirm(`Replace current Explorer data with ${count} imported item(s)?`)) return;
      state = await Storage.save(imported);
      selection.clear();
      collapsed.clear();
      render();
      setStatus(`Imported ${count} item(s).`);
    } catch (error) {
      console.error(error);
      setStatus(error.message || "Import failed.", "error");
    } finally {
      importFileElement.value = "";
    }
  }

  treeElement.addEventListener("click", (event) => {
    if (event.target === treeElement) {
      selection.clear();
      render();
    }
  });

  function dragSourceRowFromPointer(event) {
    const row = event.target.closest?.(".tree-row[data-node-id]");
    if (!row || !treeElement.contains(row)) return null;
    if (event.target.closest?.("button")) return null;
    return row;
  }

  function dropTargetAt(x, y) {
    const element = document.elementFromPoint(x, y);
    if (!element) return { element: null, parentId: undefined, valid: false };

    if (element.closest?.("#root-drop-zone")) {
      return { element: rootDropZone, parentId: null, valid: TreeOps.canMove(state, drag.draggedIds, null) };
    }

    const row = element.closest?.('.tree-row[data-node-type="folder"]');
    if (row && treeElement.contains(row)) {
      const parentId = row.dataset.nodeId;
      return {
        element: row,
        parentId,
        valid: TreeOps.canMove(state, drag.draggedIds, parentId)
      };
    }

    return { element: null, parentId: undefined, valid: false };
  }

  function beginPointerDrag(row, event) {
    const nodeId = row.dataset.nodeId;
    if (!selection.has(nodeId)) {
      selection.selectOnly(nodeId);
      refreshSelectionClasses();
    }

    const roots = TreeOps.topLevelSelection(state, orderedSelectedIds());
    if (!roots.length) return false;

    drag.begin(roots, event.clientX, event.clientY);
    row.dataset.suppressClick = "true";
    setStatus(roots.length === 1 ? "Moving 1 item…" : `Moving ${roots.length} items…`);
    return true;
  }

  document.addEventListener("pointermove", (event) => {
    if (drag.pointerId === null || event.pointerId !== drag.pointerId) return;

    if (!drag.dragging) {
      if (!drag.movedPastThreshold(event.clientX, event.clientY)) return;
      const sourceRow = dragSourceRowFromPointer({ target: document.elementFromPoint(drag.startX, drag.startY) });
      if (!sourceRow || !beginPointerDrag(sourceRow, event)) {
        drag.end();
        return;
      }
    }

    event.preventDefault();
    drag.moveGhost(event.clientX, event.clientY);
    const target = dropTargetAt(event.clientX, event.clientY);
    drag.setTarget(target.element, target.valid, target.parentId);
  }, { passive: false });

  document.addEventListener("pointerup", async (event) => {
    if (drag.pointerId === null || event.pointerId !== drag.pointerId) return;

    if (!drag.dragging) {
      drag.end();
      return;
    }

    event.preventDefault();
    const target = dropTargetAt(event.clientX, event.clientY);
    if (target.element && target.valid && target.parentId !== undefined) {
      await moveDraggedTo(target.parentId);
      return;
    }

    drag.end();
    setStatus("Move cancelled.");
  });

  document.addEventListener("pointercancel", (event) => {
    if (drag.pointerId === null || event.pointerId !== drag.pointerId) return;
    drag.end();
    setStatus("Move cancelled.");
  });

  document.addEventListener("keydown", (event) => {
    const target = event.target;
    const editing = target instanceof HTMLInputElement
      || target instanceof HTMLTextAreaElement
      || target instanceof HTMLSelectElement
      || target?.isContentEditable;
    if (editing) return;

    if (event.key === "Escape") {
      selection.clear();
      render();
      setStatus("");
      return;
    }

    if (event.key === "F2" && selection.size() > 0) {
      event.preventDefault();
      const renameId = selection.anchorId || selection.values()[0];
      if (renameId) renameNode(renameId);
      return;
    }

    if (event.key === "Delete" && selection.size() > 0) {
      event.preventDefault();
      deleteSelectionOrNode();
    }
  });

  document.getElementById("add-folder").addEventListener("click", addFolder);
  document.getElementById("add-chat").addEventListener("click", addCurrentChat);
  document.getElementById("export-data").addEventListener("click", exportData);
  document.getElementById("import-data").addEventListener("click", () => importFileElement.click());
  importFileElement.addEventListener("change", () => {
    const [file] = importFileElement.files;
    if (file) importData(file);
  });
  sortModeElement.addEventListener("change", () => {
    sortMode = sortModeElement.value;
    render();
  });

  (async () => {
    try {
      state = await Storage.load();
      render();
    } catch (error) {
      console.error(error);
      setStatus("Unable to load local Explorer data.", "error");
    }
  })();
})();
