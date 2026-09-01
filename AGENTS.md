<!-- mlc-dochub:begin — auto-managed, do not edit between these markers -->
## MLC Doc Hub — mlcremote

Structured documentation lives in `.mlcai/`, maintained through the
`mlc-dochub` MCP server.

- **Project ID:** `mlcremote` — MLCRemote — Desktop Remote Administration
- **Source directory:** `/mnt/data2tb/mlcremote` (read source files with native Read —
  the MCP tools only touch `.mlcai/`)

### Existing docs

Read any of these directly (native Read is fine) to gather context before you work:

- `.mlcai/INTEGRATION.md` — How this project fits into the larger system
- `.mlcai/TECH_STACK.md` — Stack & dependencies
- `.mlcai/API_CONTRACT.md` — API contract / endpoints
- `.mlcai/GLOSSARY.md` — Terms & abbreviations
- `.mlcai/DETAIL_DOCS.md` — Project detail docs (links to docs/)
- `.mlcai/USER_DOCS.md` — End-user perspective
- `.mlcai/PRODUCT.md` — Product marketing page pointer (submodule meta)
- `.mlcai/UI_LOGIC.md` — UI logic / components

### Product marketing page (separate concern)

Customer-facing marketing copy is **not** project documentation. It lives in
`./mlcprodweb/`, backed by `mlc@nas.local:/volume1/homes/mlc/repositories/product/mlcremote.git`. Rendered live at https://mlcgo.eu/products/mlcremote/.

### Working with `.mlcai/`

**Never write a `.mlcai/` file with a native editor.** Every create / update /
delete goes through the `mlc-dochub` MCP tools — they stamp the `## 📋 Meta`
footer, append to the activity log and guard against concurrent edits. Reading
with a native Read is fine and usually cheaper.

**If the tools are not available to you, read but do not write** — and point the
user at `task install-all` in the mlcintegration checkout (https://github.com/mlc911/mlcintegration).

The server states its full operating rules on connect (`author=`, `base_modified`,
which doc serves which purpose). Clients that drop server-level instructions —
Antigravity does, verified 29.08.2026 — get the same rules from the global
`~/.gemini/GEMINI.md`, section 6.
<!-- mlc-dochub:end -->
