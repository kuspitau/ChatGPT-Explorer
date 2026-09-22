(() => {
  "use strict";

  function nodeById(state, id) {
    return state.nodes.find((node) => node.id === id) || null;
  }

  function childIds(state, parentId) {
    return state.nodes.filter((node) => node.parentId === parentId).map((node) => node.id);
  }

  function descendantIds(state, rootId) {
    const result = new Set([rootId]);
    const queue = [rootId];

    while (queue.length) {
      const current = queue.shift();
      for (const id of childIds(state, current)) {
        if (!result.has(id)) {
          result.add(id);
          queue.push(id);
        }
      }
    }
    return result;
  }

  function hasSelectedAncestor(state, id, selectedSet) {
    let current = nodeById(state, id);
    const guard = new Set();
    while (current?.parentId) {
      if (guard.has(current.parentId)) return false;
      guard.add(current.parentId);
      if (selectedSet.has(current.parentId)) return true;
      current = nodeById(state, current.parentId);
    }
    return false;
  }

  function topLevelSelection(state, orderedIds) {
    const selectedSet = new Set(orderedIds);
    return orderedIds.filter((id) => nodeById(state, id) && !hasSelectedAncestor(state, id, selectedSet));
  }

  function canMove(state, orderedIds, newParentId) {
    const ids = topLevelSelection(state, orderedIds);
    if (!ids.length) return false;

    if (newParentId !== null) {
      const target = nodeById(state, newParentId);
      if (!target || target.type !== "folder") return false;
    }

    const moving = new Set(ids);
    if (newParentId && moving.has(newParentId)) return false;

    if (newParentId) {
      for (const id of ids) {
        const node = nodeById(state, id);
        if (node?.type === "folder" && descendantIds(state, id).has(newParentId)) return false;
      }
    }

    return true;
  }

  function normalizeParent(state, parentId) {
    const siblings = state.nodes
      .filter((node) => node.parentId === parentId)
      .sort((a, b) => (a.sortIndex - b.sortIndex) || a.name.localeCompare(b.name));

    siblings.forEach((node, index) => {
      node.sortIndex = index;
    });
  }

  function moveNodes(state, orderedIds, newParentId, timestamp = new Date().toISOString()) {
    const ids = topLevelSelection(state, orderedIds);
    if (!canMove(state, ids, newParentId)) return { movedIds: [], reason: "invalid-target" };

    const oldParents = new Set();
    for (const id of ids) oldParents.add(nodeById(state, id).parentId);

    const existingTarget = state.nodes
      .filter((node) => node.parentId === newParentId && !ids.includes(node.id))
      .sort((a, b) => (a.sortIndex - b.sortIndex) || a.name.localeCompare(b.name));

    let nextIndex = existingTarget.length
      ? Math.max(...existingTarget.map((node) => Number(node.sortIndex) || 0)) + 1
      : 0;

    for (const id of ids) {
      const node = nodeById(state, id);
      node.parentId = newParentId;
      node.sortIndex = nextIndex++;
      node.updatedAt = timestamp;
    }

    for (const parentId of oldParents) normalizeParent(state, parentId);
    normalizeParent(state, newParentId);
    return { movedIds: ids, reason: null };
  }

  function idsToDelete(state, selectedIds) {
    const roots = topLevelSelection(state, selectedIds);
    const all = new Set();
    for (const id of roots) {
      for (const descendantId of descendantIds(state, id)) all.add(descendantId);
    }
    return { roots, all };
  }

  function deleteNodes(state, selectedIds) {
    const { roots, all } = idsToDelete(state, selectedIds);
    if (!roots.length) return { rootIds: [], deletedIds: [] };

    const oldParents = new Set(roots.map((id) => nodeById(state, id)?.parentId ?? null));
    state.nodes = state.nodes.filter((node) => !all.has(node.id));
    for (const parentId of oldParents) normalizeParent(state, parentId);
    return { rootIds: roots, deletedIds: [...all] };
  }

  window.ChatGPTExplorerTreeOps = {
    nodeById,
    descendantIds,
    topLevelSelection,
    canMove,
    normalizeParent,
    moveNodes,
    idsToDelete,
    deleteNodes
  };
})();
