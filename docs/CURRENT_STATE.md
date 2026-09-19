# Current State

Version: **0.2.0 (candidate initial baseline)**

The previous V0.1 prototype was manually validated in Microsoft Edge before the repository's first commit. Since no initial commit had yet been made, V0.2 is intended to become the repository's first committed baseline.

## Previously validated in Edge

- Manifest V3 extension loads.
- Extension action opens the browser side panel.
- Nested folders render correctly.
- Current ChatGPT conversations can be added from active-tab title + URL.
- Saved conversations can be reopened.
- Local tree data persists.
- A→Z sorting works.
- Explorer JSON export works.

## Added in V0.2

- Classic desktop selection model:
  - single click;
  - Ctrl/Cmd+click toggle;
  - Shift+click visible range;
  - Ctrl/Cmd+Shift+click additive range.
- Selection feedback/count.
- Drag one or several selected items.
- Drop into folders.
- Drop back to root through an explicit root drop zone.
- Folder move cycle protection.
- Bulk delete with a single confirmation.
- Delete keyboard shortcut.
- Escape clears selection.
- Selection/tree/drag logic split into dedicated modules.
- Storage schema remains version 1 for V0.1 compatibility.

## Static validation completed

- `manifest.json` parses as JSON.
- JavaScript source files pass syntax checking.
- Manifest/HTML local references resolve.
- Selection manager unit checks pass.
- Tree move/delete/cycle unit checks pass.
- The supplied V0.1 Explorer export parses against the unchanged schema during local validation.

## Manual validation required for V0.2

Run `docs/MANUAL_TESTS.md`, particularly:

- Ctrl and Shift selection;
- moving multiple chats between folders;
- moving items to root;
- moving folders;
- rejection of folder cycles;
- bulk delete;
- persistence after reload.

## Next likely targets after V0.2 acceptance

- exact sibling reorder by dropping between rows;
- context menu / explicit Move to… action;
- then bulk history population/import before larger organization features.


## V0.2.1 drag fix

- Replaced native HTML5 drag/drop with pointer-event drag handling for better reliability in the Edge side panel.
- Drag can start from the whole conversation/folder label area, not only the leading bullet/gutter.
- A 6 px movement threshold preserves normal click, Ctrl/Shift selection and double-click behavior.
- Existing multi-selection is preserved when dragging a selected item; dragging an unselected item selects only that item first.
- Folder and root drop targets keep explicit valid/invalid visual feedback.
- Storage schema remains version 1; existing V0.1/V0.2 local data stays compatible.
