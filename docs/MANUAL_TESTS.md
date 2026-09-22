# Manual Edge test checklist — V0.4.0

**Release status:** V0.3.0 and V0.4.0 were manually accepted in Microsoft Edge on 2026-09-22. This file is intentionally kept as a reusable regression checklist for future changes; unchecked boxes are not pending release blockers.

Export Explorer data before destructive tests if the current tree matters.

## Upgrade compatibility

- [ ] Replace previous files with V0.4.0 and reload from `edge://extensions`.
- [ ] Existing folders/chats remain present.
- [ ] Existing chat links still open.
- [ ] Existing custom Explorer names are unchanged.
- [ ] Existing V0.3 Quick Add still works after permission is granted.

## Folder expansion — V0.4

- [ ] On first open after V0.4, folders whose expansion state was never saved are collapsed.
- [ ] Expand one folder, close/reopen the side panel: it remains expanded.
- [ ] Collapse it, close/reopen: it remains collapsed.
- [ ] Create a new folder: it starts collapsed.
- [ ] Click **Expand all**: all Explorer folders open.
- [ ] Close/reopen the side panel: expanded state is preserved.
- [ ] Click **Collapse all**: all Explorer folders close and stay closed after reopen.
- [ ] Delete a folder that was expanded: no settings error occurs.

## Selection and drag regression

- [ ] Single click selects only one row.
- [ ] Ctrl+click adds/removes rows.
- [ ] Shift+click selects visible range.
- [ ] Escape clears selection.
- [ ] Drag a chat into another folder.
- [ ] Multi-select chats and drag together.
- [ ] Drag to root.
- [ ] Folder cycle moves are rejected.
- [ ] Drag/drop is available in Explorer view and not in Families view.

## Existing operations regression

- [ ] + Folder uses selected/anchor destination.
- [ ] + Current chat uses selected/anchor destination.
- [ ] Project-name prefix is removed for newly captured project conversations.
- [ ] Same `/c/<id>` in project/plain URL form is detected as a duplicate.
- [ ] Rename button and F2 work.
- [ ] Export/Import round-trip works.
- [ ] Manual/A→Z/Z→A render correctly.

## Quick Add regression

- [ ] Turn Quick Add on and accept optional ChatGPT host permission.
- [ ] Normal-left-click a conversation link: it is added and navigation is prevented.
- [ ] Modifier and middle clicks keep normal behavior.
- [ ] Change Explorer destination and confirm later captures use it.
- [ ] Turn Quick Add off and confirm normal navigation resumes.

## Branch detection — explicit action

- [ ] Turn **Track branches** on and accept optional ChatGPT host permission (if not already granted).
- [ ] Confirm Quick Add can remain off while branch tracking still works.

- [ ] Ensure the parent conversation is open in ChatGPT.
- [ ] Use a message menu and choose **Branch in new chat**.
- [ ] If ChatGPT creates the branch in a new tab that already has its final `/c/<id>` URL at creation time, confirm the relationship is still captured.
- [ ] Let ChatGPT create/open the child conversation normally.
- [ ] Open Explorer and switch to **Families**.
- [ ] Confirm the original conversation appears as a family root and the new conversation appears below it.
- [ ] If the parent already belonged to an Explorer folder, confirm the newly auto-captured child initially appears in that same folder in Explorer view.
- [ ] Branch the new child again: confirm a second generation appears correctly.
- [ ] Confirm branch detection does not block ChatGPT's own branching action.

## Branch source-message metadata

- [ ] Branch from a message where ChatGPT exposes `data-message-id` in the rendered page.
- [ ] Export Explorer JSON and check that `branchSourceMessageId` is populated for the child.
- [ ] If ChatGPT does not expose that attribute, confirm the branch relation still works with a null source-message ID.

## Historical branch marker discovery

- [ ] Open a previously created branch that visibly exposes a clickable `Branched from` parent marker/link.
- [ ] Wait a few seconds or interact once with the page.
- [ ] Confirm Explorer records the parent/child relation in Families view.
- [ ] Open a normal conversation with a similar title but no branch marker: confirm no family relation is invented.

## Families view

- [ ] Switch Explorer → Families and back; the selected view persists after reopening the side panel.
- [ ] Standalone chats with no known branch relatives are omitted from Families view.
- [ ] Double-click/open action on a family node opens the real chat.
- [ ] Rename from Families view updates the Explorer display name only (real ChatGPT rename is not part of V0.4).
- [ ] Delete from Families view removes the local Explorer node under the existing confirmation semantics.
