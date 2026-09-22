# AGENTS.md

## Project principles

- Microsoft Edge on Windows is the reference platform for the first releases.
- Use Chromium Manifest V3 and standard browser-extension APIs.
- Prefer vanilla HTML, CSS, and JavaScript. Add a dependency only when it has a clear maintenance benefit.
- The extension UI lives in the browser side panel. Do not alter ChatGPT's visible DOM.
- Narrow ChatGPT content scripts are allowed for explicit integration features (Quick Add and branch detection), but they must read the minimum required metadata and must not read conversation message contents.
- Do not store conversation message contents. Store only Explorer metadata and references/relationships between ChatGPT conversations.
- Keep Explorer folder hierarchy independent from branch/family hierarchy.
- Keep persistence behind small storage/settings adapters so the backend can change later.
- Preserve backward compatibility with previously stored Explorer data whenever practical.
- Prefer small, reviewable changes over broad rewrites.
- Update `docs/CURRENT_STATE.md` after every meaningful implementation pass.
- Document architecture decisions that constrain later work in `docs/ARCHITECTURE.md`.

## UI conventions

- Use standard desktop selection semantics: click, Ctrl/Cmd+click, Shift+click.
- Shift ranges follow the currently visible tree order.
- Dragging a selected item moves the selected top-level items together.
- A selected descendant is not moved separately when its ancestor is also selected.
- Never allow moving a folder into itself or one of its descendants.
- Keep destructive bulk actions behind one explicit confirmation.
- Folder expansion state is UI state, not tree structure. New/unknown folders start collapsed.
- Family view is observational: branch relations never change folder parentage by themselves.

## Current product boundary

The extension is a navigation/organization layer with limited opt-in integration with chatgpt.com. It is not a ChatGPT client and it does not scrape conversation contents.
