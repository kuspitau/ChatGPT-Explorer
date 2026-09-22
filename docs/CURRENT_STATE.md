# Current State

Version: **0.4.0**

V0.4.0 builds on the V0.3 capture integration and adds persistent folder expansion plus an independent branch-family model/view.

## Baseline carried forward

- Manifest V3 Edge side-panel extension.
- Nested Explorer folders and local persistence.
- Current-chat add/open.
- Project-title cleanup on newly captured chats.
- Conversation-ID duplicate detection.
- Optional Quick Add capture mode.
- Manual / A→Z / Z→A sorting.
- JSON export/import.
- Click / Ctrl/Cmd / Shift selection.
- Pointer-based single/multi drag & drop.
- Folder cycle protection and bulk delete.
- F2 rename.

## Added in V0.4.0

### Persisted collapsed-by-default folders

- New/unknown folders are collapsed by default.
- Expanded folder IDs are persisted in settings.
- Reopening the side panel restores previous expansion state.
- **Collapse all** and **Expand all** controls added.

### Branch relationship model

- Separate **Track branches** toggle; independent from Quick Add.

Chat nodes can now carry branch metadata independently of `parentId` folder organization.

Relationships are recorded only from explicit evidence:

- observed **Branch in new chat** action followed by a new conversation URL;
- visible parent conversation link marked as `Branched from` / supported localized equivalent.

No relationship is guessed from names.

### Automatic branch capture

- Parent and child records are ensured when a branch is detected.
- New child records inherit the known parent's Explorer folder as their initial location.
- Parent/child/root conversation IDs are stored.
- Optional source-message ID is captured when ChatGPT exposes it near the branch action.
- Temporary branch intent survives service-worker suspension through `chrome.storage.session`.
- Branch writes share the serialized background write queue with Quick Add.

### Families view

- New `View` selector: **Explorer** / **Families**.
- Families view renders known conversation roots and descendants as a separate tree.
- Standalone conversations are omitted.
- Explorer view marks known branch roots/children with branch glyphs.
- Drag/drop remains disabled in Families view so genealogy and folder organization cannot be confused.

## Compatibility

- Tree storage remains schema version 1.
- Existing V0.1–V0.3 trees and exports remain compatible.
- New branch fields are optional/additive.
- UI/Quick Add/folder expansion settings live under the separate settings key.

## Static validation completed

- `manifest.json` parses.
- All JavaScript source files pass `node --check`.
- Selection/tree/drag smoke checks pass.
- Project-title and conversation-identity checks pass.
- Settings collapsed-default and view-mode checks pass.
- Branch root/children utilities pass.
- Simulated background-worker branch flow passes, including a child tab created directly on its final conversation URL and pending-intent purge when tracking is disabled.
- Manifest/HTML local references resolve.
- ZIP integrity passes.

## Manual validation status

**Accepted in Microsoft Edge on 2026-09-22.** The user validated the V0.3.0 and V0.4.0 feature sets, including live branch detection. There are no remaining V0.3/V0.4 acceptance blockers.

`docs/MANUAL_TESTS.md` is retained as a regression checklist for later builds; unchecked boxes there do not mean V0.4 is pending.

## Next likely targets

- real ChatGPT synchronization infrastructure, starting with reversible rename;
- exact sibling reorder by dropping between rows;
- context menu / explicit Move to…;
- then bulk history population/import.
