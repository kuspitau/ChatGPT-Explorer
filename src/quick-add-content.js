(() => {
  "use strict";

  if (globalThis.__CHATGPT_EXPLORER_CAPTURE_HELPER__) return;
  globalThis.__CHATGPT_EXPLORER_CAPTURE_HELPER__ = true;

  const Settings = globalThis.ChatGPTExplorerSettings;
  const Conversation = globalThis.ChatGPTExplorerConversation;
  let quickAddEnabled = false;
  let branchTrackingEnabled = false;
  let lastMessageId = null;
  let lastUrl = location.href;

  Settings.load()
    .then((settings) => {
      quickAddEnabled = settings.quickAddEnabled;
      branchTrackingEnabled = settings.branchTrackingEnabled;
    })
    .catch((error) => console.error("ChatGPT Explorer: settings load failed", error));

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local" || !changes[Settings.SETTINGS_KEY]) return;
    const next = Settings.normalizeSettings(changes[Settings.SETTINGS_KEY].newValue);
    const branchWasEnabled = branchTrackingEnabled;
    quickAddEnabled = next.quickAddEnabled;
    branchTrackingEnabled = next.branchTrackingEnabled;
    if (!branchWasEnabled && branchTrackingEnabled) scheduleBranchMarkerScan();
  });

  function eventPath(event) {
    return typeof event.composedPath === "function" ? event.composedPath() : [];
  }

  function anchorFromEvent(event) {
    for (const item of eventPath(event)) {
      if (item instanceof HTMLAnchorElement && item.href) return item;
    }
    return event.target?.closest?.("a[href]") || null;
  }

  function interactiveTextFromEvent(event) {
    for (const item of eventPath(event)) {
      if (!(item instanceof HTMLElement)) continue;
      const text = [
        item.getAttribute("aria-label"),
        item.getAttribute("title"),
        item.textContent
      ].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
      if (text) return text;
    }
    return "";
  }

  function rememberPossibleMessageSource(event) {
    for (const item of eventPath(event)) {
      if (!(item instanceof HTMLElement)) continue;
      const descriptor = `${item.getAttribute("aria-label") || ""} ${item.getAttribute("title") || ""}`.trim();
      if (!/(more actions|plus d['’]actions|autres actions)/i.test(descriptor)) continue;
      const message = item.closest("[data-message-id]");
      const id = message?.getAttribute("data-message-id");
      if (id) lastMessageId = id;
      return;
    }
  }

  function maybeSendBranchIntent(event) {
    if (!branchTrackingEnabled) return false;
    const text = interactiveTextFromEvent(event);
    if (!Conversation.looksLikeBranchAction(text)) return false;

    const parentConversationId = Conversation.conversationId(location.href);
    if (!parentConversationId) return false;

    chrome.runtime.sendMessage({
      type: "branch-intent",
      parentUrl: location.href,
      parentConversationId,
      sourceMessageId: lastMessageId
    }).catch((error) => {
      console.error("ChatGPT Explorer: branch intent failed", error);
    });
    return true;
  }

  function accessibleAnchorText(anchor) {
    return [
      anchor.getAttribute("aria-label"),
      anchor.getAttribute("title"),
      anchor.textContent
    ].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
  }

  function branchDescriptorForAnchor(anchor) {
    const direct = accessibleAnchorText(anchor);
    if (Conversation.looksLikeBranchParentLabel(direct)) return direct;

    let current = anchor.parentElement;
    for (let depth = 0; current && depth < 3; depth += 1, current = current.parentElement) {
      const text = String(current.textContent || "").replace(/\s+/g, " ").trim();
      if (text.length > 0 && text.length <= 280 && Conversation.looksLikeBranchParentLabel(text)) return text;
    }
    return direct;
  }

  function scanForBranchParentLink() {
    if (!branchTrackingEnabled) return;
    const childUrl = location.href;
    const childConversationId = Conversation.conversationId(childUrl);
    if (!childConversationId) return;

    for (const anchor of document.querySelectorAll('a[href*="/c/"]')) {
      if (!Conversation.isSupportedChatUrl(anchor.href)) continue;
      const parentConversationId = Conversation.conversationId(anchor.href);
      if (!parentConversationId || parentConversationId === childConversationId) continue;

      const descriptor = branchDescriptorForAnchor(anchor);
      if (!Conversation.looksLikeBranchParentLabel(descriptor)) continue;

      chrome.runtime.sendMessage({
        type: "branch-relation-found",
        parentUrl: anchor.href,
        parentTitle: Conversation.stripBranchParentLabel(descriptor),
        childUrl,
        childTitle: document.title || ""
      }).catch(() => {});
      return;
    }
  }

  function scheduleBranchMarkerScan() {
    setTimeout(scanForBranchParentLink, 250);
    setTimeout(scanForBranchParentLink, 1500);
  }

  document.addEventListener("click", (event) => {
    rememberPossibleMessageSource(event);
    maybeSendBranchIntent(event);

    if (!quickAddEnabled || event.defaultPrevented) return;
    if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;

    const anchor = anchorFromEvent(event);
    if (!anchor || !Conversation.isSupportedChatUrl(anchor.href)) return;

    event.preventDefault();
    event.stopImmediatePropagation();

    const title = Conversation.normalizeLinkTitle(
      anchor.textContent || anchor.getAttribute("aria-label") || anchor.title,
      anchor.href
    );

    chrome.runtime.sendMessage({
      type: "quick-add-chat-link",
      url: anchor.href,
      title
    }).catch((error) => {
      console.error("ChatGPT Explorer: Quick Add capture failed", error);
    });
  }, true);

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", scheduleBranchMarkerScan, { once: true });
  } else {
    scheduleBranchMarkerScan();
  }

  setInterval(() => {
    if (location.href === lastUrl) return;
    lastUrl = location.href;
    lastMessageId = null;
    scheduleBranchMarkerScan();
  }, 1000);
})();
