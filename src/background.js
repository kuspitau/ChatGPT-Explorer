importScripts("storage.js", "settings.js", "conversation-utils.js", "branch-ops.js");

const Storage = globalThis.ChatGPTExplorerStorage;
const Settings = globalThis.ChatGPTExplorerSettings;
const Conversation = globalThis.ChatGPTExplorerConversation;
const BranchOps = globalThis.ChatGPTExplorerBranchOps;

const CAPTURE_SCRIPT_ID = "chatgpt-explorer-capture";
const PENDING_BRANCH_KEY = "chatgptExplorerPendingBranches";
const PENDING_BRANCH_TTL_MS = 2 * 60 * 1000;
let stateWriteQueue = Promise.resolve();

chrome.runtime.onInstalled.addListener(() => {
  void configureSidePanel();
  void reconcileCaptureRegistration();
});

chrome.runtime.onStartup.addListener(() => {
  void configureSidePanel();
  void reconcileCaptureRegistration();
});

async function configureSidePanel() {
  try {
    await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  } catch (error) {
    console.error("ChatGPT Explorer: unable to configure side panel behavior", error);
  }
}

async function hostPermissionGranted() {
  return chrome.permissions.contains({ origins: Conversation.CHATGPT_MATCH_PATTERNS });
}

async function registeredCaptureScripts() {
  return chrome.scripting.getRegisteredContentScripts({ ids: [CAPTURE_SCRIPT_ID] });
}

async function registerCaptureScript() {
  const existing = await registeredCaptureScripts();
  if (existing.length) return;

  await chrome.scripting.registerContentScripts([{
    id: CAPTURE_SCRIPT_ID,
    matches: Conversation.CHATGPT_MATCH_PATTERNS,
    js: ["settings.js", "conversation-utils.js", "quick-add-content.js"],
    runAt: "document_start",
    persistAcrossSessions: true
  }]);
}

async function unregisterCaptureScript() {
  const existing = await registeredCaptureScripts();
  if (!existing.length) return;
  await chrome.scripting.unregisterContentScripts({ ids: [CAPTURE_SCRIPT_ID] });
}

async function injectCaptureIntoOpenTabs() {
  const tabs = await chrome.tabs.query({ url: Conversation.CHATGPT_MATCH_PATTERNS });
  await Promise.all(tabs.map(async (tab) => {
    if (!tab.id) return;
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["settings.js", "conversation-utils.js", "quick-add-content.js"]
      });
    } catch (error) {
      console.warn("ChatGPT Explorer: unable to inject capture helper into tab", tab.id, error);
    }
  }));
}

async function configureQuickAddMode(enabled, parentId) {
  const current = await Settings.load();
  if (enabled && !(await hostPermissionGranted())) {
    return { ok: false, reason: "permission-required", settings: current };
  }

  const settings = await Settings.save({
    ...current,
    quickAddEnabled: enabled,
    quickAddParentId: enabled && typeof parentId === "string" ? parentId : current.quickAddParentId
  });

  await reconcileCaptureRegistration();
  return { ok: true, settings };
}

async function configureBranchTrackingMode(enabled) {
  const current = await Settings.load();
  if (enabled && !(await hostPermissionGranted())) {
    return { ok: false, reason: "permission-required", settings: current };
  }

  const settings = await Settings.save({ ...current, branchTrackingEnabled: enabled });
  if (!enabled) {
    await chrome.storage.session.remove(PENDING_BRANCH_KEY);
  }
  await reconcileCaptureRegistration();
  return { ok: true, settings };
}

async function reconcileCaptureRegistration() {
  try {
    const granted = await hostPermissionGranted();
    const settings = await Settings.load();

    if (granted && (settings.quickAddEnabled || settings.branchTrackingEnabled)) {
      await registerCaptureScript();
      await injectCaptureIntoOpenTabs();
      return;
    }

    if (!granted && (settings.quickAddEnabled || settings.branchTrackingEnabled)) {
      await Settings.save({ ...settings, quickAddEnabled: false, branchTrackingEnabled: false });
    }
    await unregisterCaptureScript();
  } catch (error) {
    console.error("ChatGPT Explorer: unable to reconcile capture helper", error);
  }
}

function queueStateWrite(work) {
  const run = () => work();
  stateWriteQueue = stateWriteQueue.then(run, run);
  return stateWriteQueue;
}

function nextSortIndex(state, parentId) {
  const siblings = state.nodes.filter((node) => node.parentId === parentId);
  if (!siblings.length) return 0;
  return Math.max(...siblings.map((node) => Number(node.sortIndex) || 0)) + 1;
}

function chatNodeByConversationId(state, conversationId) {
  return state.nodes.find(
    (node) => node.type === "chat" && Conversation.conversationId(node.url) === conversationId
  ) || null;
}

function makeChatNode({ url, title, parentId = null, autoNamed = false }) {
  const timestamp = new Date().toISOString();
  const chatTitle = Conversation.normalizeCapturedTitle(title, url);
  return {
    id: crypto.randomUUID(),
    type: "chat",
    name: chatTitle,
    parentId,
    url,
    chatTitle,
    sortIndex: 0,
    createdAt: timestamp,
    updatedAt: timestamp,
    branchParentConversationId: null,
    branchRootConversationId: null,
    branchSourceMessageId: null,
    branchDetectedAt: null,
    branchDetectionSource: null,
    branchAutoNamed: autoNamed
  };
}

function ensureChatNode(state, { url, title, parentId = null, fallbackName = null }) {
  const conversationId = Conversation.conversationId(url);
  if (!conversationId) return null;

  let node = chatNodeByConversationId(state, conversationId);
  if (node) return node;

  const effectiveTitle = title || fallbackName || "ChatGPT conversation";
  node = makeChatNode({
    url,
    title: effectiveTitle,
    parentId,
    autoNamed: !title && Boolean(fallbackName)
  });
  node.sortIndex = nextSortIndex(state, parentId);
  state.nodes.push(node);
  return node;
}

async function handleQuickAddChatLink(message, sender) {
  const senderUrl = sender?.url || sender?.tab?.url || "";
  if (!Conversation.isChatGptHost(senderUrl) || !Conversation.isSupportedChatUrl(message?.url)) {
    return { status: "ignored", reason: "invalid-source" };
  }

  const settings = await Settings.load();
  if (!settings.quickAddEnabled) return { status: "ignored", reason: "disabled" };

  return queueStateWrite(async () => {
    const state = await Storage.load();
    const conversationId = Conversation.conversationId(message.url);
    const existing = chatNodeByConversationId(state, conversationId);
    if (existing) return { status: "existing", id: existing.id, name: existing.name };

    let parentId = settings.quickAddParentId;
    if (parentId) {
      const parent = state.nodes.find((node) => node.id === parentId && node.type === "folder");
      if (!parent) parentId = null;
    }

    const node = ensureChatNode(state, {
      url: message.url,
      title: Conversation.normalizeLinkTitle(message.title, message.url),
      parentId
    });
    await Storage.save(state);
    return { status: "added", id: node.id, name: node.name, parentId };
  });
}

async function loadPendingBranches() {
  const stored = await chrome.storage.session.get(PENDING_BRANCH_KEY);
  const value = Array.isArray(stored[PENDING_BRANCH_KEY]) ? stored[PENDING_BRANCH_KEY] : [];
  const cutoff = Date.now() - PENDING_BRANCH_TTL_MS;
  const fresh = value.filter((item) => Number(item.createdAtMs) >= cutoff);
  if (fresh.length !== value.length) await chrome.storage.session.set({ [PENDING_BRANCH_KEY]: fresh });
  return fresh;
}

async function savePendingBranches(items) {
  await chrome.storage.session.set({ [PENDING_BRANCH_KEY]: items });
}

async function rememberBranchIntent(message, sender) {
  const settings = await Settings.load();
  if (!settings.branchTrackingEnabled) return { ok: false, reason: "disabled" };

  const parentUrl = message.parentUrl || sender?.tab?.url || sender?.url || "";
  const parentConversationId = Conversation.conversationId(parentUrl);
  if (!parentConversationId || !sender?.tab?.id) return { ok: false, reason: "invalid-parent" };

  await queueStateWrite(async () => {
    const state = await Storage.load();
    ensureChatNode(state, {
      url: parentUrl,
      title: sender.tab.title || "ChatGPT conversation",
      parentId: null
    });
    await Storage.save(state);
  });

  const pending = await loadPendingBranches();
  const next = pending.filter((item) => item.originTabId !== sender.tab.id);
  next.push({
    originTabId: sender.tab.id,
    childTabId: null,
    parentConversationId,
    parentUrl,
    sourceMessageId: typeof message.sourceMessageId === "string" ? message.sourceMessageId : null,
    createdAtMs: Date.now()
  });
  await savePendingBranches(next);
  return { ok: true };
}

async function bindPendingToChildTab(tab) {
  if (!tab?.id || !tab.openerTabId) return null;
  const pending = await loadPendingBranches();
  let matched = null;
  for (const item of pending) {
    if (item.originTabId === tab.openerTabId && !item.childTabId) {
      item.childTabId = tab.id;
      matched = item;
      break;
    }
  }
  if (matched) await savePendingBranches(pending);
  return matched;
}

async function consumePendingForTab(tabId, url) {
  const childConversationId = Conversation.conversationId(url);
  if (!childConversationId) return null;

  const pending = await loadPendingBranches();
  const index = pending.findIndex((item) =>
    (item.originTabId === tabId || item.childTabId === tabId)
    && item.parentConversationId !== childConversationId
  );
  if (index < 0) return null;

  const [intent] = pending.splice(index, 1);
  await savePendingBranches(pending);
  return intent;
}

async function recordBranchRelation({
  parentUrl,
  parentTitle,
  childUrl,
  childTitle,
  sourceMessageId = null,
  detectionSource
}) {
  const parentConversationId = Conversation.conversationId(parentUrl);
  const childConversationId = Conversation.conversationId(childUrl);
  if (!parentConversationId || !childConversationId || parentConversationId === childConversationId) {
    return { status: "ignored" };
  }

  return queueStateWrite(async () => {
    const state = await Storage.load();
    const parentNode = ensureChatNode(state, {
      url: parentUrl,
      title: parentTitle || "ChatGPT conversation",
      parentId: null
    });

    const childExisting = chatNodeByConversationId(state, childConversationId);
    const childNode = childExisting || ensureChatNode(state, {
      url: childUrl,
      title: childTitle || null,
      fallbackName: `Branch of ${parentNode.name}`,
      parentId: parentNode.parentId
    });

    if (!childExisting && childNode.parentId !== parentNode.parentId) {
      childNode.parentId = parentNode.parentId;
      childNode.sortIndex = nextSortIndex(state, parentNode.parentId);
    }

    const rootConversationId = parentNode.branchRootConversationId
      || BranchOps.rootConversationIdFor(state, parentConversationId, Conversation)
      || parentConversationId;

    childNode.branchParentConversationId = parentConversationId;
    childNode.branchRootConversationId = rootConversationId;
    childNode.branchSourceMessageId = sourceMessageId || childNode.branchSourceMessageId || null;
    childNode.branchDetectedAt = new Date().toISOString();
    childNode.branchDetectionSource = detectionSource;
    childNode.updatedAt = childNode.branchDetectedAt;

    await Storage.save(state);
    return { status: "recorded", parentName: parentNode.name, childName: childNode.name };
  });
}

async function maybeRefreshAutoCapturedTitle(tab) {
  if (!tab?.url || !tab?.title) return;
  const conversationId = Conversation.conversationId(tab.url);
  if (!conversationId) return;

  await queueStateWrite(async () => {
    const state = await Storage.load();
    const node = chatNodeByConversationId(state, conversationId);
    if (!node?.branchAutoNamed) return;

    const normalized = Conversation.normalizeCapturedTitle(tab.title, tab.url);
    if (!normalized || normalized === "ChatGPT conversation" || normalized === node.name) return;
    node.name = normalized;
    node.chatTitle = normalized;
    node.branchAutoNamed = false;
    node.updatedAt = new Date().toISOString();
    await Storage.save(state);
    chrome.runtime.sendMessage({ type: "branch-relation-detected", status: "title-updated" }).catch(() => {});
  });
}

chrome.tabs.onCreated.addListener((tab) => {
  void (async () => {
    const matched = await bindPendingToChildTab(tab);
    if (!matched) return;

    const childUrl = tab.pendingUrl || tab.url || "";
    if (!Conversation.isSupportedChatUrl(childUrl)) return;

    const intent = await consumePendingForTab(tab.id, childUrl);
    if (!intent) return;

    const result = await recordBranchRelation({
      parentUrl: intent.parentUrl,
      parentTitle: null,
      childUrl,
      childTitle: tab.title || null,
      sourceMessageId: intent.sourceMessageId,
      detectionSource: "observed-branch-action"
    });
    if (result.status === "recorded") {
      chrome.runtime.sendMessage({ type: "branch-relation-detected", ...result }).catch(() => {});
    }
  })();
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.url && Conversation.isSupportedChatUrl(changeInfo.url)) {
    void (async () => {
      const intent = await consumePendingForTab(tabId, changeInfo.url);
      if (!intent) return;
      const result = await recordBranchRelation({
        parentUrl: intent.parentUrl,
        parentTitle: null,
        childUrl: changeInfo.url,
        childTitle: null,
        sourceMessageId: intent.sourceMessageId,
        detectionSource: "observed-branch-action"
      });
      if (result.status === "recorded") {
        chrome.runtime.sendMessage({ type: "branch-relation-detected", ...result }).catch(() => {});
      }
    })();
  }

  if (changeInfo.title || changeInfo.status === "complete") {
    void maybeRefreshAutoCapturedTitle(tab);
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "configure-quick-add") {
    configureQuickAddMode(Boolean(message.enabled), message.parentId)
      .then(sendResponse)
      .catch((error) => {
        console.error("ChatGPT Explorer: Quick Add configuration failed", error);
        sendResponse({ ok: false, reason: "configuration-failed" });
      });
    return true;
  }


  if (message?.type === "configure-branch-tracking") {
    configureBranchTrackingMode(Boolean(message.enabled))
      .then(sendResponse)
      .catch((error) => {
        console.error("ChatGPT Explorer: branch tracking configuration failed", error);
        sendResponse({ ok: false, reason: "configuration-failed" });
      });
    return true;
  }

  if (message?.type === "quick-add-chat-link") {
    handleQuickAddChatLink(message, sender)
      .then((result) => {
        sendResponse({ ok: true, ...result });
        if (result.status === "added" || result.status === "existing") {
          chrome.runtime.sendMessage({ type: "quick-add-complete", ...result }).catch(() => {});
        }
      })
      .catch((error) => {
        console.error("ChatGPT Explorer: Quick Add failed", error);
        sendResponse({ ok: false, reason: "capture-failed" });
      });
    return true;
  }

  if (message?.type === "branch-intent") {
    rememberBranchIntent(message, sender)
      .then(sendResponse)
      .catch((error) => {
        console.error("ChatGPT Explorer: branch intent failed", error);
        sendResponse({ ok: false, reason: "branch-intent-failed" });
      });
    return true;
  }

  if (message?.type === "branch-relation-found") {
    (async () => {
      const settings = await Settings.load();
      if (!settings.branchTrackingEnabled) {
        sendResponse({ ok: true, status: "ignored", reason: "disabled" });
        return;
      }

      const result = await recordBranchRelation({
        parentUrl: message.parentUrl,
        parentTitle: message.parentTitle,
        childUrl: message.childUrl,
        childTitle: message.childTitle,
        sourceMessageId: null,
        detectionSource: "page-parent-marker"
      });
      sendResponse({ ok: true, ...result });
      if (result.status === "recorded") {
        chrome.runtime.sendMessage({ type: "branch-relation-detected", ...result }).catch(() => {});
      }
    })().catch((error) => {
      console.error("ChatGPT Explorer: branch marker detection failed", error);
      sendResponse({ ok: false, reason: "branch-record-failed" });
    });
    return true;
  }

  return false;
});
