# ChatGPT Explorer

Current baseline: **V0.2.1**

A lightweight Chromium side-panel extension for organizing ChatGPT conversations in a hierarchy independent from ChatGPT's own project/sidebar organization.

## V0.2 scope

The current baseline supports:

- arbitrary nested folders;
- classic Ctrl/Shift multi-selection;
- pointer-based drag & drop from the whole row/label, including multi-item moves;
- adding the currently open ChatGPT conversation;
- automatic capture of the browser tab title and conversation URL;
- custom Explorer names via rename;
- opening saved conversations in the current tab;
- local persistence with `chrome.storage.local`;
- manual insertion order plus A→Z / Z→A display sorting;
- JSON export/import backups;
- classic single and multi-selection with click, Ctrl/Cmd+click, and Shift+click;
- multi-item drag-and-drop into folders;
- drag-and-drop back to the root;
- cycle protection for folder moves;
- bulk delete with one confirmation;
- Escape to clear the selection.

It deliberately does **not** modify ChatGPT pages or store conversation message contents.

## Install / update in Microsoft Edge

1. Clone/download this repository or replace your previous files with this version.
2. Open `edge://extensions`.
3. Enable **Developer mode**.
4. If installing for the first time, choose **Load unpacked** and select the repository's `src` folder.
5. If V0.1 is already loaded from the same folder, replace the files and click **Reload** on the extension card.
6. Open ChatGPT Explorer from the extension action / Edge side panel.

Existing V0.1 local data remains compatible because the storage schema stays at version 1.

## Selection and movement

- Click: select one item.
- Ctrl/Cmd+click: add/remove one item from the selection.
- Shift+click: select the visible range from the anchor item.
- Ctrl/Cmd+Shift+click: add a visible range to the current selection.
- Drag any selected row: move the selected top-level items together.
- Drop on a folder: move there.
- Drop on **Move to root**: move to the root.
- Delete: bulk-delete the selection after confirmation.
- Escape: clear the selection.

Folders can also be moved. Invalid cycles (folder into itself/descendant) are rejected.

## Known V0.2 limits

- Dropping *between* sibling rows to choose an exact manual position is not implemented yet; moved items are appended to their destination in manual order.
- No context menu yet.
- No bulk history import yet.
- No tags/search/branch metadata yet.
- No cloud synchronization yet.

## Repository documentation

- `AGENTS.md` — constraints for future development passes.
- `docs/ARCHITECTURE.md` — current technical design.
- `docs/CURRENT_STATE.md` — handoff state for the next development conversation.
- `docs/MANUAL_TESTS.md` — browser smoke/regression checklist.
