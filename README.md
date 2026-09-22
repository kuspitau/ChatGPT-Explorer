# ChatGPT Explorer

Current baseline: **V0.4.0** — manually accepted in Microsoft Edge on 2026-09-22.

A lightweight Chromium side-panel extension for organizing ChatGPT conversations in a hierarchy independent from ChatGPT's own project/sidebar organization, with a separate branch-family view.

## Current scope

The current baseline supports:

- arbitrary nested Explorer folders;
- folders collapsed by default, with persisted expansion state;
- **Collapse all** / **Expand all**;
- classic Ctrl/Shift multi-selection;
- pointer-based drag & drop from the whole row/label, including multi-item moves;
- adding the currently open ChatGPT conversation;
- automatic capture of browser-tab title + conversation URL;
- project-conversation title cleanup when newly captured;
- duplicate detection by ChatGPT conversation ID rather than exact URL;
- optional **Quick add** mode that captures normal ChatGPT conversation-link clicks instead of navigating to them;
- optional **Track branches** mode, independent from Quick Add;
- automatic recording of branch relationships when Explorer observes **Branch in new chat**;
- best-effort recovery of existing branch relationships when a visible `Branched from`/localized parent link is present;
- a separate **Families** view showing original chats and their known descendants as a tree;
- custom Explorer names via rename, including F2;
- opening saved conversations in the current tab;
- local persistence with `chrome.storage.local`;
- manual insertion order plus A→Z / Z→A display sorting;
- JSON export/import backups;
- multi-item drag-and-drop into folders and back to root;
- cycle protection for folder moves;
- bulk delete with one confirmation;
- Escape to clear the selection.

The extension does **not** store conversation message contents. Branch metadata consists only of conversation IDs/URLs, optional source-message ID, detection source and timestamps.

## Install / update in Microsoft Edge

1. Export Explorer data first if the current local tree matters.
2. Replace the project files with this version.
3. Open `edge://extensions`.
4. Enable **Developer mode** if needed.
5. Click **Reload** on the existing ChatGPT Explorer card. If installing for the first time, choose **Load unpacked** and select the repository's `src` folder.
6. Open ChatGPT Explorer from the extension action / Edge side panel.

Existing V0.1–V0.3 tree data remains compatible. V0.4 keeps the tree schema at version 1 and adds optional branch metadata fields.

## Folder expansion

Folder state is now persistent:

- a folder not previously opened starts **collapsed**;
- opening/closing a folder is remembered;
- reopening the side panel restores the previous expansion state;
- **Collapse all** and **Expand all** are available in Explorer view.

The stored setting is the set of expanded folder IDs, which makes newly created folders naturally default to collapsed.

## Project-title cleanup and conversation identity

When **+ Current chat** captures a project conversation, Explorer removes the leading project-name segment from the browser-tab title before saving the Explorer name.

Duplicate detection uses the `/c/<conversation-id>` component, so project and non-project URLs for the same conversation are treated as one conversation.

Existing saved Explorer names are not rewritten automatically.

## Quick Add mode

Turn on **Quick add** in the side panel. The first activation asks Edge for optional permission to run the capture helper on ChatGPT pages.

While enabled:

- normal left-click on a ChatGPT conversation link adds it to Explorer and prevents navigation;
- Ctrl/Cmd/Shift/Alt-click and non-left clicks keep normal browser behavior;
- the current Explorer add destination is also used as the Quick Add destination;
- rapid captures are serialized in the background worker to avoid lost writes.

## Branch detection and Families view

Turn on **Track branches** once to grant/use ChatGPT page access for genealogy detection. It is independent from Quick Add: either mode can be on or off separately.

Explorer keeps **folder organization** and **conversation genealogy** as separate dimensions.

For chat nodes, V0.4 may store:

```text
branchParentConversationId
branchRootConversationId
branchSourceMessageId
branchDetectedAt
branchDetectionSource
```

Two detection paths are considered certain enough to persist:

1. Explorer observes the explicit **Branch in new chat** action, then sees the newly created conversation URL.
2. A ChatGPT page exposes a visible parent link whose accessible text indicates `Branched from` (or supported localized equivalent).

Explorer does not infer relationships from similar titles.

Switch **View** from `Explorer` to `Families` to show only known branch families. Standalone conversations with no known relatives are omitted from that view.

When a new branch is observed, Explorer automatically ensures the parent and child conversation records exist. The child is placed in the same Explorer folder as the parent when possible; the branch relationship itself remains independent from the folder hierarchy.

## Known limits

- Exact sibling insertion by dropping *between* rows is not implemented yet; moved items are appended to the destination manual order.
- Historical branch recovery depends on ChatGPT exposing a usable parent link/marker in the rendered page; Explorer deliberately does not guess when that evidence is absent.
- Branch UI detection depends on accessible text for the branch command and therefore may need adjustment if ChatGPT changes the command wording substantially.
- Families view is currently always expanded; per-family collapse state is not yet persisted.
- Quick Add captures links on ChatGPT pages only; it is not a browser-wide link interceptor.
- No context menu / explicit Move to… action yet.
- No automatic/bulk history import yet.
- No tags/search yet.
- No cloud synchronization yet.
- Real ChatGPT rename/delete/project synchronization discussed for later work is not included in V0.4.

## Repository documentation

- `AGENTS.md` — constraints for future development passes.
- `docs/ARCHITECTURE.md` — current technical design.
- `docs/CURRENT_STATE.md` — handoff state for the next development conversation.
- `docs/MANUAL_TESTS.md` — browser smoke/regression checklist.
