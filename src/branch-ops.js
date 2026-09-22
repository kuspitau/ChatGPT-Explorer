(() => {
  "use strict";

  function chatConversationId(node, Conversation) {
    return node?.type === "chat" ? Conversation.conversationId(node.url) : null;
  }

  function conversationMap(state, Conversation) {
    const map = new Map();
    for (const node of state.nodes) {
      const id = chatConversationId(node, Conversation);
      if (id && !map.has(id)) map.set(id, node);
    }
    return map;
  }

  function childrenMap(state, Conversation) {
    const map = new Map();
    for (const node of state.nodes) {
      if (node.type !== "chat" || !node.branchParentConversationId) continue;
      const list = map.get(node.branchParentConversationId) || [];
      list.push(node);
      map.set(node.branchParentConversationId, list);
    }
    return map;
  }

  function rootConversationIdFor(state, conversationId, Conversation) {
    const byConversation = conversationMap(state, Conversation);
    let currentId = conversationId;
    const seen = new Set();

    while (currentId && !seen.has(currentId)) {
      seen.add(currentId);
      const node = byConversation.get(currentId);
      if (!node?.branchParentConversationId) return currentId;
      if (!byConversation.has(node.branchParentConversationId)) return node.branchParentConversationId;
      currentId = node.branchParentConversationId;
    }

    return conversationId;
  }

  function familyRoots(state, Conversation) {
    const byConversation = conversationMap(state, Conversation);
    const children = childrenMap(state, Conversation);
    const roots = [];

    for (const [conversationId, node] of byConversation.entries()) {
      if (!children.has(conversationId)) continue;
      const parentId = node.branchParentConversationId;
      if (!parentId || !byConversation.has(parentId)) roots.push(node);
    }

    return roots.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
  }

  function familyChildren(state, parentConversationId, Conversation) {
    const map = childrenMap(state, Conversation);
    return (map.get(parentConversationId) || [])
      .slice()
      .sort((a, b) => {
        const aTime = a.branchDetectedAt || a.createdAt || "";
        const bTime = b.branchDetectedAt || b.createdAt || "";
        return aTime.localeCompare(bTime) || a.name.localeCompare(b.name);
      });
  }

  function hasFamilyRelation(state, node, Conversation) {
    const id = chatConversationId(node, Conversation);
    if (!id) return false;
    if (node.branchParentConversationId) return true;
    return state.nodes.some((candidate) => candidate.type === "chat" && candidate.branchParentConversationId === id);
  }

  globalThis.ChatGPTExplorerBranchOps = {
    chatConversationId,
    conversationMap,
    childrenMap,
    rootConversationIdFor,
    familyRoots,
    familyChildren,
    hasFamilyRelation
  };
})();
