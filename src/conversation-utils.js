(() => {
  "use strict";

  const CHATGPT_MATCH_PATTERNS = [
    "https://chatgpt.com/*",
    "https://chat.openai.com/*"
  ];

  const PROJECT_TITLE_SEPARATORS = [" | ", " · ", " › ", " → ", " — ", " – ", " - "];
  const BRANCH_ACTION_PATTERNS = [
    /branch\s+(?:in|to)\s+new\s+chat/i,
    /cr[eé]er\s+une\s+branche.*nouveau\s+chat/i,
    /branche.*nouveau\s+chat/i
  ];
  const BRANCH_PARENT_PATTERNS = [
    /^\s*branched\s+from\b/i,
    /^\s*branche\s+(?:de|depuis)\b/i,
    /^\s*issu(?:e)?\s+d(?:e|u|')\b/i
  ];

  function parseUrl(rawUrl) {
    try {
      return new URL(rawUrl);
    } catch {
      return null;
    }
  }

  function isChatGptHost(rawUrl) {
    const url = parseUrl(rawUrl);
    return Boolean(url && (url.hostname === "chatgpt.com" || url.hostname === "chat.openai.com"));
  }

  function conversationId(rawUrl) {
    const url = parseUrl(rawUrl);
    if (!url || !isChatGptHost(rawUrl)) return null;
    const match = url.pathname.match(/\/c\/([^/?#]+)/);
    return match ? match[1] : null;
  }

  function isSupportedChatUrl(rawUrl) {
    return Boolean(conversationId(rawUrl));
  }

  function isProjectConversationUrl(rawUrl) {
    const url = parseUrl(rawUrl);
    return Boolean(
      url
      && isChatGptHost(rawUrl)
      && url.pathname.startsWith("/g/g-p-")
      && conversationId(rawUrl)
    );
  }

  function stripChatGptSuffix(title) {
    return String(title || "")
      .replace(/\s*[|·›→–—-]\s*ChatGPT\s*$/i, "")
      .trim();
  }

  function stripProjectPrefix(title) {
    let best = null;
    for (const separator of PROJECT_TITLE_SEPARATORS) {
      const index = title.indexOf(separator);
      if (index <= 0) continue;
      if (!best || index < best.index) best = { index, separator };
    }
    if (!best) return title;
    const remainder = title.slice(best.index + best.separator.length).trim();
    return remainder || title;
  }

  function normalizeCapturedTitle(title, rawUrl) {
    let cleaned = stripChatGptSuffix(title);
    if (isProjectConversationUrl(rawUrl)) cleaned = stripProjectPrefix(cleaned);
    return cleaned || "ChatGPT conversation";
  }

  function normalizeLinkTitle(title, rawUrl) {
    const cleaned = String(title || "").replace(/\s+/g, " ").trim();
    return normalizeCapturedTitle(cleaned, rawUrl);
  }

  function sameConversationUrl(a, b) {
    const aId = conversationId(a);
    const bId = conversationId(b);
    if (aId && bId) return aId === bId;
    return String(a || "") === String(b || "");
  }

  function looksLikeBranchAction(text) {
    const value = String(text || "").replace(/\s+/g, " ").trim();
    return BRANCH_ACTION_PATTERNS.some((pattern) => pattern.test(value));
  }

  function looksLikeBranchParentLabel(text) {
    const value = String(text || "").replace(/\s+/g, " ").trim();
    return BRANCH_PARENT_PATTERNS.some((pattern) => pattern.test(value));
  }

  function stripBranchParentLabel(text) {
    let value = String(text || "").replace(/\s+/g, " ").trim();
    value = value
      .replace(/^\s*branched\s+from\s*[:·›→–—-]?\s*/i, "")
      .replace(/^\s*branche\s+(?:de|depuis)\s*[:·›→–—-]?\s*/i, "")
      .replace(/^\s*issu(?:e)?\s+d(?:e|u|')\s*[:·›→–—-]?\s*/i, "")
      .trim();
    return value || "ChatGPT conversation";
  }

  globalThis.ChatGPTExplorerConversation = {
    CHATGPT_MATCH_PATTERNS,
    conversationId,
    isChatGptHost,
    isSupportedChatUrl,
    isProjectConversationUrl,
    normalizeCapturedTitle,
    normalizeLinkTitle,
    sameConversationUrl,
    looksLikeBranchAction,
    looksLikeBranchParentLabel,
    stripBranchParentLabel
  };
})();
