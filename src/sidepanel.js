(() => {
  "use strict";

  const Storage = window.ChatGPTExplorerStorage;
  const Settings = window.ChatGPTExplorerSettings;
  const Conversation = window.ChatGPTExplorerConversation;
  const SelectionManager = window.ChatGPTExplorerSelectionManager;
  const TreeOps = window.ChatGPTExplorerTreeOps;
  const BranchOps = window.ChatGPTExplorerBranchOps;
  const DragManager = window.ChatGPTExplorerDragManager;

  const treeElement = document.getElementById("tree");
  const emptyStateElement = document.getElementById("empty-state");
  const emptyTitleElement = document.getElementById("empty-title");
  const emptyDetailElement = document.getElementById("empty-detail");
  const statusElement = document.getElementById("status");
  const selectionHintElement = document.getElementById("selection-hint");
  const sortModeElement = document.getElementById("sort-mode");
  const viewModeElement = document.getElementById("view-mode");
  const importFileElement = document.getElementById("import-file");
  const rootDropZone = document.getElementById("root-drop-zone");
  const quickAddModeElement = document.getElementById("quick-add-mode");
  const branchTrackingModeElement = document.getElementById("branch-tracking-mode");
  const collapseAllElement = document.getElementById("collapse-all");
  const expandAllElement = document.getElementById("expand-all");

  let state = Storage.emptyState();
  let settings = Settings.emptySettings();
  let sortMode = "manual";
  let visibleIds = [];
  let expandedFolders = new Set();
  let viewMode = "explorer";
  const selection = new SelectionManager();
  const drag = new DragManager();

  function now() { return new Date().toISOString(); }

  function setStatus(message = "", kind = "info") {
    statusElement.textContent = message;
    statusElement.dataset.kind = kind;
  }

  function nodeById(id) { return TreeOps.nodeById(state, id); }

  function destinationId() {
    const anchor = nodeById(selection.anchorId);
    if (!anchor) return null;
    return anchor.type === "folder" ? anchor.id : anchor.parentId;
  }

  function destinationLabel() {
    const id = destinationId();
    return id ? (nodeById(id)?.name || "root") : "root";
  }

  function quickAddTargetLabel() {
    const target = nodeById(settings.quickAddParentId);
    return target?.type === "folder" ? target.name : "root";
  }

  async function saveSettingsPatch(patch) {
    settings = await Settings.save({ ...settings, ...patch });
    expandedFolders = new Set(settings.expandedFolderIds);
    viewMode = settings.viewMode;
    return settings;
  }

  function validExpandedFolderIds() {
    const folders = new Set(state.nodes.filter((node) => node.type === "folder").map((node) => node.id));
    return [...expandedFolders].filter((id) => folders.has(id));
  }

  async function persistExpandedFolders() {
    await saveSettingsPatch({ expandedFolderIds: validExpandedFolderIds() });
  }

  function updateControls() {
    quickAddModeElement.checked = settings.quickAddEnabled;
    branchTrackingModeElement.checked = settings.branchTrackingEnabled;
    quickAddModeElement.title = settings.quickAddEnabled
      ? `Quick add is ON. Captured chats go to ${quickAddTargetLabel()}.`
      : "Capture normal ChatGPT conversation-link clicks instead of opening them.";
    branchTrackingModeElement.title = settings.branchTrackingEnabled
      ? "Branch tracking is ON."
      : "Observe explicit ChatGPT branch actions and visible branch-parent markers.";
    viewModeElement.value = viewMode;
    const explorer = viewMode === "explorer";
    collapseAllElement.disabled = !explorer;
    expandAllElement.disabled = !explorer;
    sortModeElement.disabled = !explorer;
  }

  function updateSelectionHint() {
    const count = selection.size();
    const quickAdd = settings.quickAddEnabled ? ` · Quick add: ON → ${quickAddTargetLabel()}` : "";
    const branchTracking = settings.branchTrackingEnabled ? " · Branch tracking: ON" : "";
    const view = viewMode === "families" ? " · Families view" : ` · Add destination: ${destinationLabel()}`;
    selectionHintElement.textContent = `Selected: ${count}${view}${quickAdd}${branchTracking}`;
  }

  async function syncQuickAddTargetFromSelection() {
    if (!settings.quickAddEnabled || viewMode !== "explorer") return;
    const parentId = destinationId();
    if (parentId === settings.quickAddParentId) return;
    await saveSettingsPatch({ quickAddParentId: parentId });
    updateControls();
    updateSelectionHint();
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

  function hasFolderChildren(nodeId) {
    return state.nodes.some((node) => node.parentId === nodeId);
  }

  function branchGlyph(node) {
    if (node.type !== "chat") return "";
    if (node.branchParentConversationId) return "↳";
    const id = Conversation.conversationId(node.url);
    if (id && state.nodes.some((candidate) => candidate.type === "chat" && candidate.branchParentConversationId === id)) return "⑂";
    return "•";
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
    void syncQuickAddTargetFromSelection();
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

  function attachCommonRowBehavior(row, node, allowDrag) {
    row.addEventListener("click", (event) => {
      event.stopPropagation();
      if (row.dataset.suppressClick === "true") {
        row.dataset.suppressClick = "false";
        return;
      }
      selectFromClick(node.id, event);
    });

    if (allowDrag) {
      row.addEventListener("pointerdown", (event) => {
        if (event.button !== 0 || event.target.closest("button")) return;
        drag.arm(event.pointerId, event.clientX, event.clientY);
      });
    }
  }

  function appendLabelAndActions(row, node) {
    const label = document.createElement("div");
    label.className = `tree-label ${node.type}`;
    label.textContent = node.name;
    label.title = node.type === "chat" && node.chatTitle ? `${node.name}\nChatGPT: ${node.chatTitle}` : node.name;
    if (node.type === "chat") {
      label.addEventListener("dblclick", (event) => {
        event.stopPropagation();
        openChat(node);
      });
    }
    row.appendChild(label);

    const actions = document.createElement("div");
    actions.className = "tree-actions";
    if (node.type === "chat") actions.appendChild(createActionButton("↗", "Open chat", () => openChat(node)));
    actions.appendChild(createActionButton("✎", "Rename", () => renameNode(node.id)));
    actions.appendChild(createActionButton("×", "Delete from Explorer", () => deleteSelectionOrNode(node.id)));
    row.appendChild(actions);
  }

  function renderExplorerNode(node, depth) {
    visibleIds.push(node.id);
    const wrapper = document.createElement("div");
    const row = document.createElement("div");
    row.className = `tree-row explorer-row${selection.has(node.id) ? " selected" : ""}`;
    row.style.paddingLeft = `${depth * 14}px`;
    row.dataset.nodeId = node.id;
    row.dataset.nodeType = node.type;
    row.setAttribute("role", "treeitem");
    row.setAttribute("aria-selected", selection.has(node.id) ? "true" : "false");
    attachCommonRowBehavior(row, node, true);

    if (node.type === "folder") {
      const toggle = document.createElement("button");
      toggle.type = "button";
      toggle.className = "tree-toggle";
      const expandable = hasFolderChildren(node.id);
      const expanded = expandedFolders.has(node.id);
      toggle.textContent = expandable ? (expanded ? "▾" : "▸") : "";
      toggle.title = expandable ? "Expand/collapse" : "Empty folder";
      toggle.addEventListener("click", (event) => {
        event.stopPropagation();
        if (!expandable) return;
        if (expanded) expandedFolders.delete(node.id); else expandedFolders.add(node.id);
        render();
        void persistExpandedFolders();
      });
      row.appendChild(toggle);
    } else {
      const spacer = document.createElement("span");
      spacer.className = "tree-spacer";
      spacer.textContent = branchGlyph(node);
      row.appendChild(spacer);
    }

    appendLabelAndActions(row, node);
    wrapper.appendChild(row);

    if (node.type === "folder" && expandedFolders.has(node.id)) {
      for (const child of sortedChildren(node.id)) wrapper.appendChild(renderExplorerNode(child, depth + 1));
    }
    return wrapper;
  }

  function renderFamilyNode(node, depth, seen = new Set()) {
    const conversationId = Conversation.conversationId(node.url);
    if (!conversationId || seen.has(conversationId)) return document.createDocumentFragment();
    const nextSeen = new Set(seen);
    nextSeen.add(conversationId);
    visibleIds.push(node.id);

    const wrapper = document.createElement("div");
    const row = document.createElement("div");
    row.className = `tree-row family-row ${depth === 0 ? "family-root" : "family-child"}${selection.has(node.id) ? " selected" : ""}`;
    row.style.paddingLeft = `${depth * 16}px`;
    row.dataset.nodeId = node.id;
    row.dataset.nodeType = "chat";
    row.setAttribute("role", "treeitem");
    row.setAttribute("aria-selected", selection.has(node.id) ? "true" : "false");
    attachCommonRowBehavior(row, node, false);

    const spacer = document.createElement("span");
    spacer.className = "tree-spacer";
    spacer.textContent = depth === 0 ? "⑂" : "↳";
    row.appendChild(spacer);
    appendLabelAndActions(row, node);
    wrapper.appendChild(row);

    for (const child of BranchOps.familyChildren(state, conversationId, Conversation)) {
      wrapper.appendChild(renderFamilyNode(child, depth + 1, nextSeen));
    }
    return wrapper;
  }

  function render() {
    visibleIds = [];
    treeElement.replaceChildren();
    updateControls();

    if (viewMode === "explorer") {
      for (const node of sortedChildren(null)) treeElement.appendChild(renderExplorerNode(node, 0));
      emptyTitleElement.textContent = "No items yet.";
      emptyDetailElement.textContent = "Create a folder or add the currently open ChatGPT conversation.";
      emptyStateElement.hidden = state.nodes.length !== 0;
    } else {
      const roots = BranchOps.familyRoots(state, Conversation);
      for (const root of roots) treeElement.appendChild(renderFamilyNode(root, 0));
      emptyTitleElement.textContent = "No branch families detected yet.";
      emptyDetailElement.textContent = "Create/visit branches in ChatGPT; Explorer will record relationships when it has explicit evidence.";
      emptyStateElement.hidden = roots.length !== 0;
    }

    updateSelectionHint();
  }

  async function persist(message) {
    state = await Storage.save(state);
    const cleanedExpanded = validExpandedFolderIds();
    if (cleanedExpanded.length !== settings.expandedFolderIds.length) {
      await saveSettingsPatch({ expandedFolderIds: cleanedExpanded });
    }
    render();
    await syncQuickAddTargetFromSelection();
    if (message) setStatus(message);
  }

  async function addFolder() {
    if (viewMode !== "explorer") {
      setStatus("Switch to Explorer view to create folders.", "error");
      return;
    }
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

  async function addCurrentChat() {
    setStatus("");
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !Conversation.isSupportedChatUrl(tab.url || "")) {
      setStatus("Open a ChatGPT conversation first (chatgpt.com/c/…).", "error");
      return;
    }

    const existing = state.nodes.find(
      (node) => node.type === "chat" && Conversation.sameConversationUrl(node.url, tab.url)
    );
    if (existing) {
      selection.selectOnly(existing.id);
      render();
      void syncQuickAddTargetFromSelection();
      setStatus(`Already saved as “${existing.name}”.`);
      return;
    }

    const parentId = viewMode === "explorer" ? destinationId() : null;
    const chatTitle = Conversation.normalizeCapturedTitle(tab.title, tab.url);
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
      updatedAt: timestamp,
      branchParentConversationId: null,
      branchRootConversationId: null,
      branchSourceMessageId: null,
      branchDetectedAt: null,
      branchDetectionSource: null,
      branchAutoNamed: false
    };
    state.nodes.push(node);
    selection.selectOnly(node.id);
    await persist(`Added “${node.name}”.`);
  }

  async function openChat(node) {
    if (!node?.url) return;
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id) await chrome.tabs.update(tab.id, { url: node.url });
      else await chrome.tabs.create({ url: node.url });
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
    node.branchAutoNamed = false;
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
    if (!window.confirm(`Delete ${description}${nested} from Explorer?`)) return;

    TreeOps.deleteNodes(state, orderedIds);
    selection.clear();
    await persist(`Deleted ${all.size} item(s) from Explorer.`);
  }

  async function moveDraggedTo(newParentId) {
    const movingIds = [...drag.draggedIds];
    const result = TreeOps.moveNodes(state, movingIds, newParentId, now());
    drag.end();
    if (!result.movedIds.length) {
      setStatus("Unable to move the selected item(s) there.", "error");
      return;
    }
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
      expandedFolders.clear();
      await saveSettingsPatch({ expandedFolderIds: [] });
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
      void syncQuickAddTargetFromSelection();
    }
  });

  function dragSourceRowAt(x, y) {
    if (viewMode !== "explorer") return null;
    const target = document.elementFromPoint(x, y);
    const row = target?.closest?.(".tree-row.explorer-row[data-node-id]");
    return row && treeElement.contains(row) ? row : null;
  }

  function dropTargetAt(x, y) {
    if (viewMode !== "explorer") return { element: null, parentId: undefined, valid: false };
    const element = document.elementFromPoint(x, y);
    if (!element) return { element: null, parentId: undefined, valid: false };

    if (element.closest?.("#root-drop-zone")) {
      return { element: rootDropZone, parentId: null, valid: TreeOps.canMove(state, drag.draggedIds, null) };
    }

    const row = element.closest?.('.tree-row.explorer-row[data-node-type="folder"]');
    if (row && treeElement.contains(row)) {
      const parentId = row.dataset.nodeId;
      return { element: row, parentId, valid: TreeOps.canMove(state, drag.draggedIds, parentId) };
    }
    return { element: null, parentId: undefined, valid: false };
  }

  function beginPointerDrag(row, event) {
    const nodeId = row.dataset.nodeId;
    if (!selection.has(nodeId)) {
      selection.selectOnly(nodeId);
      render();
      void syncQuickAddTargetFromSelection();
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
      const sourceRow = dragSourceRowAt(drag.startX, drag.startY);
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
      void syncQuickAddTargetFromSelection();
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

  viewModeElement.addEventListener("change", async () => {
    selection.clear();
    await saveSettingsPatch({ viewMode: viewModeElement.value });
    render();
  });

  collapseAllElement.addEventListener("click", async () => {
    expandedFolders.clear();
    await saveSettingsPatch({ expandedFolderIds: [] });
    render();
    setStatus("All folders collapsed.");
  });

  expandAllElement.addEventListener("click", async () => {
    expandedFolders = new Set(state.nodes.filter((node) => node.type === "folder").map((node) => node.id));
    await saveSettingsPatch({ expandedFolderIds: [...expandedFolders] });
    render();
    setStatus("All folders expanded.");
  });

  quickAddModeElement.addEventListener("change", async () => {
    const enabled = quickAddModeElement.checked;
    try {
      if (enabled) {
        const granted = await chrome.permissions.request({ origins: Conversation.CHATGPT_MATCH_PATTERNS });
        if (!granted) {
          quickAddModeElement.checked = false;
          setStatus("Quick add needs permission to observe conversation-link clicks on ChatGPT.", "error");
          return;
        }
      }

      const response = await chrome.runtime.sendMessage({
        type: "configure-quick-add",
        enabled,
        parentId: enabled && viewMode === "explorer" ? destinationId() : settings.quickAddParentId
      });
      if (!response?.ok) throw new Error(response?.reason || "Unable to configure Quick Add.");
      settings = Settings.normalizeSettings(response.settings);
      expandedFolders = new Set(settings.expandedFolderIds);
      viewMode = settings.viewMode;
      render();
      setStatus(enabled ? `Quick add enabled. Captured chats go to ${quickAddTargetLabel()}.` : "Quick add disabled.");
    } catch (error) {
      console.error(error);
      settings = await Settings.load();
      expandedFolders = new Set(settings.expandedFolderIds);
      viewMode = settings.viewMode;
      render();
      setStatus("Unable to change Quick Add mode.", "error");
    }
  });


  branchTrackingModeElement.addEventListener("change", async () => {
    const enabled = branchTrackingModeElement.checked;
    try {
      if (enabled) {
        const granted = await chrome.permissions.request({ origins: Conversation.CHATGPT_MATCH_PATTERNS });
        if (!granted) {
          branchTrackingModeElement.checked = false;
          setStatus("Branch tracking needs permission to observe branch actions on ChatGPT.", "error");
          return;
        }
      }

      const response = await chrome.runtime.sendMessage({
        type: "configure-branch-tracking",
        enabled
      });
      if (!response?.ok) throw new Error(response?.reason || "Unable to configure branch tracking.");
      settings = Settings.normalizeSettings(response.settings);
      expandedFolders = new Set(settings.expandedFolderIds);
      viewMode = settings.viewMode;
      render();
      setStatus(enabled ? "Branch tracking enabled." : "Branch tracking disabled.");
    } catch (error) {
      console.error(error);
      settings = await Settings.load();
      expandedFolders = new Set(settings.expandedFolderIds);
      viewMode = settings.viewMode;
      render();
      setStatus("Unable to change branch tracking mode.", "error");
    }
  });

  chrome.runtime.onMessage.addListener((message) => {
    if (message?.type !== "quick-add-complete" && message?.type !== "branch-relation-detected") return;
    void (async () => {
      state = await Storage.load();
      render();
      if (message.type === "quick-add-complete") {
        if (message.status === "added") setStatus(`Quick-added “${message.name}”.`);
        else if (message.status === "existing") setStatus(`Already saved as “${message.name}”.`);
      } else if (message.status === "recorded") {
        setStatus(`Branch detected: “${message.parentName}” → “${message.childName}”.`);
      }
    })();
  });

  (async () => {
    try {
      [state, settings] = await Promise.all([Storage.load(), Settings.load()]);
      expandedFolders = new Set(settings.expandedFolderIds);
      viewMode = settings.viewMode;
      const cleaned = validExpandedFolderIds();
      if (cleaned.length !== settings.expandedFolderIds.length) {
        await saveSettingsPatch({ expandedFolderIds: cleaned });
      }
      render();
    } catch (error) {
      console.error(error);
      setStatus("Unable to load local Explorer data.", "error");
    }
  })();
})();
