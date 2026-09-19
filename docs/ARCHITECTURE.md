# Architecture

## Goal

Provide a small, maintainable navigation layer for ChatGPT conversations without changing ChatGPT's own DOM or reimplementing the ChatGPT client.

## Runtime shape

```text
Microsoft Edge / Chromium
├── chatgpt.com                       (untouched)
└── ChatGPT Explorer side panel
    ├── sidepanel.html/css/js         UI/orchestration
    ├── selection.js                  desktop selection semantics
    ├── drag-manager.js               transient drag UI state
    ├── tree-ops.js                   pure hierarchy mutations/guards
    ├── storage.js                    persistence adapter
    └── background.js                 side-panel action behavior
```

## Data model

The stored root object remains schema version 1:

```text
{
  schemaVersion: 1,
  nodes: Node[]
}
```

Each node contains:

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

The hierarchy is represented by `parentId`. `null` means root. Folder depth is not artificially limited.

## Selection model

Selection is transient UI state and is not persisted.

`SelectionManager` keeps:

```text
selectedIds: Set<string>
anchorId: string | null
```

Shift selection uses the currently visible flattened order, which means collapsed descendants are not part of the range and alphabetical sorting changes the range exactly as displayed.

## Drag/move model

Before a move, the selected IDs are reduced to their top-level selected roots. If both a folder and one of its descendants are selected, moving the folder implicitly carries the descendant and the descendant is not moved a second time.

`tree-ops.js` prevents:

- dropping a folder onto itself;
- dropping a folder into one of its descendants;
- using a chat as a parent destination.

Moves currently append moved roots to the destination's manual order and normalize `sortIndex` for affected parents.

Exact before/after sibling insertion is deliberately deferred.

## Storage

V0.2 continues to use `chrome.storage.local` through `storage.js`. The storage schema is unchanged from V0.1, so existing local trees remain compatible.

## ChatGPT integration boundary

The extension reads only browser-tab metadata exposed through `chrome.tabs`:

- current URL;
- current browser-tab title.

It does not inject a content script and does not read or modify ChatGPT's DOM.

## Planned boundaries

Not part of V0.2:

- exact drag reordering between siblings;
- context menu;
- bulk ChatGPT history import;
- tags/favorites/search;
- explicit branch relationships;
- cloud/multi-device synchronization;
- Android-specific UI.


## Drag and drop

Drag-and-drop uses pointer events rather than native HTML5 drag events. This avoids browser-side-panel inconsistencies and gives the UI full control over the drag threshold, multi-selection semantics, ghost indicator and folder/root hit testing.
