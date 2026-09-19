# AGENTS.md

## Project principles

- Microsoft Edge on Windows is the reference platform for the first releases.
- Use Chromium Manifest V3 and standard browser-extension APIs.
- Prefer vanilla HTML, CSS, and JavaScript. Add a dependency only when it has a clear maintenance benefit.
- Do not modify ChatGPT's DOM. ChatGPT pages remain untouched; the extension UI lives in the browser side panel.
- Do not store conversation message contents. Store only Explorer metadata and references to ChatGPT conversations.
- Keep Explorer metadata independent from OpenAI data and UI structure.
- Keep persistence behind a small storage adapter so the backend can change later.
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

## Current product boundary

The extension is a navigation/organization layer. It is not a ChatGPT client and it does not scrape conversation contents.
