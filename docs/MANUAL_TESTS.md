# Manual Edge test checklist — V0.2.0

Use a disposable Explorer export/backup before destructive tests if the tree matters.

## Upgrade compatibility

- [ ] Replace V0.1 files with V0.2 and reload the extension.
- [ ] Existing folders and chats are still present.
- [ ] Existing chat links still open.

## Selection

- [ ] Single click selects only one row.
- [ ] Ctrl+click adds a second non-adjacent row.
- [ ] Ctrl+click on an already selected row removes it.
- [ ] Shift+click selects the visible range from the anchor.
- [ ] Collapse a folder: hidden descendants are not included in a Shift range.
- [ ] Switch to A→Z: Shift range follows the visible alphabetical order.
- [ ] Escape clears the selection.

## Drag and drop

- [ ] Drag one chat onto another folder: it moves there.
- [ ] Ctrl-select several chats, drag one selected row onto another folder: all move together.
- [ ] The drag ghost says `Move N items`.
- [ ] Drag selected items onto `Move to root`: they become root items.
- [ ] Drag a folder into another folder: it moves with its descendants.
- [ ] Try to drag a folder onto itself: rejected.
- [ ] Try to drag a folder into one of its descendants: rejected.
- [ ] After a move, reload the side panel: the new location persists.

## Delete

- [ ] Select several chats and press Delete: one confirmation appears and all selected chats are deleted.
- [ ] Select a folder with descendants and another chat, press Delete: confirmation mentions nested items and removes the expected subtree.
- [ ] Clicking × on an unselected row selects/deletes that row only.

## Existing operations

- [ ] + Folder still uses the selected/anchor destination.
- [ ] + Current chat still uses the selected/anchor destination.
- [ ] Rename still works.
- [ ] Export then Import round-trip still works.
- [ ] Manual/A→Z/Z→A modes still render correctly.


## V0.2.1 pointer drag regression

- [ ] Drag from the middle of a conversation name (not the bullet) starts a move.
- [ ] Moving less than a few pixels still behaves as a normal click.
- [ ] Drag a single chat onto another folder; it moves and persists after reload.
- [ ] Ctrl-select several chats, then drag any selected chat by its name; the group moves together.
- [ ] Drag an unselected chat while other items are selected; only the dragged chat moves.
- [ ] Drag a folder into its own descendant; target is shown invalid and the move is rejected.
- [ ] Drag any item to **Move to root**; it becomes a root item.
- [ ] Double-click on a chat name still opens the chat when no drag occurs.

## F2 rename

1. Select one conversation or folder.
2. Press F2.
3. Confirm that the rename prompt opens for the selected item.
4. With multiple items selected, press F2 and confirm that only the active/anchor item is renamed.
5. Confirm that Esc, Delete, Ctrl+click, Shift+click and drag/drop still behave normally.
