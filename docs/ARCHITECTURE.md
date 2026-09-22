# Architecture

## Goal

Provide a small, maintainable navigation layer for ChatGPT conversations without reimplementing the ChatGPT client or storing conversation contents.

## Runtime shape

```text
Microsoft Edge / Chromium
├── chatgpt.com
│   └── optional capture helper
│       ├── Quick Add link interception
│       ├── Branch in new chat observation
│       └── visible Branched from parent-link discovery
└── ChatGPT Explorer extension
    ├── sidepanel.html/css/js         UI/orchestration
    ├── selection.js                  desktop selection semantics
    ├── drag-manager.js               transient drag UI state
    ├── tree-ops.js                   folder hierarchy mutations/guards
    ├── branch-ops.js                 branch/family relationship utilities
    ├── conversation-utils.js         ChatGPT URL/title normalization
    ├── storage.js                    tree + branch metadata persistence
    ├── settings.js                   extension/UI preferences adapter
    └── background.js                 side-panel + capture/branch orchestration
```

## Two independent hierarchies

V0.4 explicitly separates:

1. **Explorer hierarchy** — organization chosen by the user (`parentId` between folders/chats).
2. **Family hierarchy** — genealogical relation between ChatGPT conversations (`branchParentConversationId`).

Moving a chat between Explorer folders never changes its branch parent. Detecting a branch never changes an existing Explorer folder assignment except when a previously unknown child is auto-created, in which case it inherits the known parent's folder as an initial placement.

## Data model

The stored root object remains schema version 1:

```text
{
  schemaVersion: 1,
  nodes: Node[]
}
```

All nodes keep their existing fields:

```text
id
kind/type: folder | chat
name
parentId
url                 chat only
chatTitle           chat only
sortIndex
createdAt
updatedAt
```

Chat nodes may additionally contain:

```text
branchParentConversationId : string | null
branchRootConversationId   : string | null
branchSourceMessageId       : string | null
branchDetectedAt            : string | null
branchDetectionSource       : string | null
branchAutoNamed             : boolean
```

These fields are additive and optional, so existing schema-version-1 exports remain valid.

## Settings

Extension/UI preferences live separately under `chatgptExplorerSettings`:

```text
quickAddEnabled
branchTrackingEnabled
quickAddParentId
expandedFolderIds
viewMode                  explorer | families
```

`expandedFolderIds` is intentionally stored instead of `collapsedFolderIds`: a new/unknown folder ID is absent from the set and therefore defaults to collapsed.

## Selection and drag model

Selection is transient UI state and is not persisted. Shift selection follows the currently visible Explorer tree.

Drag/drop is enabled in Explorer view only. Before a move, selected IDs are reduced to top-level selected roots. `tree-ops.js` prevents self/descendant folder cycles and chat-parent destinations.

Exact before/after sibling insertion remains deferred.

## Conversation identity and titles

`conversation-utils.js` centralizes ChatGPT URL/title handling.

Conversation identity is based on `/c/<conversation-id>`, so project and non-project URL forms for the same conversation are equivalent.

Project-title cleanup is URL-gated. Non-project titles are not split merely because they contain separators.

## Quick Add boundary

When enabled, and only after optional ChatGPT host permission is granted, the content script observes ordinary unmodified left-clicks on recognized ChatGPT conversation links. It reads only the URL and visible/accessibility label, prevents that navigation and sends metadata to the background worker.

It does not read message bodies or modify the page.

## Branch observation

Branch observation is active only when `branchTrackingEnabled` is true. Quick Add and branch tracking share optional host permission and the same capture script, but their behavior is independently toggled.


### Explicit branch action

The content script listens for the accessible/visible command text corresponding to **Branch in new chat**. It does not prevent the action. It sends a `branch-intent` containing the current parent conversation ID and, when available, the source message's `data-message-id`.

The background worker stores this intent temporarily in `chrome.storage.session`. It then watches tab URL changes:

- same-tab branch: the original tab navigates to a different `/c/<id>`;
- new-tab branch: a tab created with the original tab as opener is linked immediately; if it is already created on its final conversation URL, the relation is recorded at creation time, otherwise it is completed on the later URL update.

When the child conversation ID appears, the relationship is persisted.

### Existing branch marker

The content script also performs a narrow best-effort scan for actual conversation links whose accessible text indicates `Branched from` or a supported localized equivalent. When found, it sends the parent and child URLs as explicit evidence.

No title-similarity or timing-only heuristic creates a family relation.

## Branch auto-capture

When a branch relation is detected:

- the parent chat record is ensured to exist;
- the child chat record is ensured to exist;
- if the parent already exists, a newly created child initially inherits the parent's Explorer folder;
- the child receives branch metadata;
- an automatically generated fallback name can later be replaced by the real browser-tab title when it becomes available.

Background tree mutations are serialized through one promise queue shared by Quick Add and branch updates.
Disabling branch tracking clears pending branch intents so a delayed tab navigation cannot create genealogy after the user has turned tracking off.

## Families view

`branch-ops.js` builds a conversation-ID map and computes known family roots. Families view renders only roots that have at least one known branch descendant. Standalone chats are intentionally omitted.

Family rendering is read/navigation oriented. Folder drag/drop remains an Explorer-view concern.

## Planned boundaries

Not part of V0.4:

- exact drag reordering between siblings;
- per-family collapse persistence;
- context menu / explicit Move to…;
- automatic/bulk history import;
- tags/search;
- real ChatGPT rename/delete/project synchronization;
- cloud/multi-device synchronization;
- Android-specific UI.
