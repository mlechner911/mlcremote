# MLCRemote — Product Page Authoring Guide

This directory contains everything needed to generate the product marketing page.
Run `mlcprodweb preview` from the project root to see it locally.

---

## File overview

| File / Dir     | Purpose |
|----------------|---------|
| `meta.yaml`    | Structured metadata: version, platforms, features, download links |
| `en.md`         | English marketing copy (H1 = hero title, rest = body) |
| `de.md`         | German marketing copy |
| `assets/`       | Screenshots and product images referenced in `meta.yaml` |
| `pages/`        | Optional sub-pages (docs, examples, changelog, …) |

---

## meta.yaml fields

```yaml
id:        "my-product"         # slug used in URL: /products/my-product/
name:      "My Product"
version:   "1.2.0"
status:    "stable"             # beta | stable | retired
category:  "Development Tools"
license:   "MIT"
platforms: [Windows, macOS, Linux]
github:    "https://github.com/..."
slogan_en: "One or two sentences shown on the products index card."   # REQUIRED
slogan_de: "Ein oder zwei Sätze für die Produktkartenliste."          # REQUIRED
openapi:   "openapi.yaml"       # optional — auto-generates API Reference tab

screenshots:
  - "hero.png"                  # files must exist in assets/
  - "screenshot2.png"

downloads:
  free: false                   # false = login required (auth gate in JS)
  windows: "myproduct-win.exe"  # filename at /downloads/my-product/<file>
  linux:   "myproduct-linux"
  macos:   "myproduct-mac.dmg"

features:
  - icon:     "zap"             # Lucide icon name (https://lucide.dev/icons)
    title_en: "Fast"
    title_de: "Schnell"
    desc_en:  "One sentence."
    desc_de:  "Ein Satz."
```

---

## Writing en.md / de.md

- The **first line** must be a Markdown H1 (`# Title`) — this becomes the hero heading.
- Everything after is rendered as the page body.
- Use standard Markdown: headings, lists, bold, code blocks.
- Keep the copy focused on **benefits**, not feature lists (features go in meta.yaml).

---

## Adding screenshots

1. Put image files in `assets/` (PNG, WebP, SVG).
2. Reference them in `meta.yaml` under `screenshots`.
3. Run `mlcprodweb preview` to see them.

### No screenshots yet? Use SVG illustrations instead.

For tools without a UI, two SVG styles work well as stand-ins (and often look better
than real screenshots):

**Option A — Terminal window SVG**
A fake terminal chrome (macOS/Linux traffic lights, dark bg, monospace font) with real
command output. Great for CLI tools and REST APIs. Shows the user immediately how it
feels to use the product.

Example: `assets/terminal-quickstart.svg` in this project.
Copy it as a starting point and edit the text nodes with your own commands and output.

**Option B — Workflow/architecture diagram SVG**
A minimal flow diagram: `Input` → `[Your Tool]` → `Output`, with component badges.
Great for middleware, services, or multi-step pipelines.

Example: `assets/workflow-diagram.svg` in this project.

**Option C — AI-generated image via Ollama**
Use the `x/z-image-turbo:bf16` model on `macstudio.fritz.box` to generate a PNG from
a text prompt. Good for hero images, concept art, or anything that benefits from a
more visual/illustrative style rather than a technical diagram.

```bash
curl http://macstudio.fritz.box:11434/api/generate \
  -d '{
    "model": "x/z-image-turbo:bf16",
    "prompt": "A dark-themed developer tool UI showing a PDF being generated from HTML code, minimal, flat design, dark background",
    "options": {
      "seed": 42,
      "width": 760,
      "height": 420
    }
  }' | jq -r '.response' | base64 -d > assets/hero-generated.png
```

Then add `hero-generated.png` to `meta.yaml` screenshots.

Prompt tips for product screenshots:
- Describe the tool's purpose visually, not literally ("a terminal window" → not great)
- Add style anchors: `"dark background"`, `"flat design"`, `"developer aesthetic"`, `"clean minimal UI"`
- Keep the seed fixed so re-runs produce the same image — change it intentionally when you want a new variant
- Width 760, height 420 (hero) or 760×500 (gallery) — always specify both

**SVG Tips:**
- SVG text uses `tspan` — edit inline in any text editor or in Inkscape/Figma.
- Catppuccin Mocha palette is already set up in both example SVGs (colors match the
  site's dark theme): background `#1e1e2e`, surface `#313244`, text `#cdd6f4`,
  blue `#89b4fa`, green `#a6e3a1`, purple `#cba6f7`, yellow `#f9e2af`.
- Keep width 760px — that matches the hero-screenshot container.
- The first `screenshots` entry is the hero image; extras go in the gallery.

---

## OpenAPI / REST API documentation

If the product exposes a REST API, mention it in the marketing copy (`en.md` / `de.md`)
with a short endpoint table and a quickstart `curl` example — see this project's `en.md`
as a template.

If you have an OpenAPI spec file (YAML or JSON), place it in `mlcprodweb/`:

```
mlcprodweb/
  openapi.yaml    ← OpenAPI 3.x spec
```

Then reference it in `meta.yaml`:

```yaml
openapi: "openapi.yaml"   # enables auto-generated API reference sub-page (see below)
```

**Auto-generated API reference page:**
When `openapi` is set, `mlcprodweb generate` / `preview` automatically renders a
styled API reference page at `/products/<id>/en/api/` — no manual markdown needed.
The page shows:
- Service title, version, description from the spec `info` block
- Each path+method as a card: HTTP method badge, path, summary, parameter table,
  request body schema, response codes
- Fits the dark theme — minimal custom renderer, not Swagger UI

---

## Sub-pages (docs, examples, gallery, …)

Two types of sub-page are supported:

### Markdown sub-pages

Create `pages/<slug>/en.md` and `pages/<slug>/de.md`:

```
pages/
  docs/
    en.md   ← /products/my-product/en/docs/
    de.md   ← /products/my-product/de/docs/
```

Sub-pages appear automatically in the product tab bar. H1 becomes the page title.

### Gallery sub-pages

Create `pages/<slug>/gallery.yaml` with a list of image sections and items.
Images live alongside the YAML (or as a symlink to another dir in the same repo):

```
pages/
  showcase/
    gallery.yaml          ← section/item definitions
    images/               ← PNGs (or symlink: ln -s ../../../web/images images)
      emotions/
        happy.png
      ...
```

`gallery.yaml` format:

```yaml
title_en: "My Showcase"
title_de: "Mein Showcase"
auth_required: false      # true = soft JS gate: blurs gallery, shows register CTA

sections:
  - id: emotions
    title_en: "Emotions"
    title_de: "Emotionen"
    desc_en:  "One sentence describing this section."
    desc_de:  "Ein Satz zur Beschreibung."
    items:
      - image: images/emotions/happy.png
        label_en: "Happy"
        label_de: "Fröhlich"
        prompt: "Optional generation prompt / caption shown on hover"
```

The gallery renders with a section jump-nav, masonry-style image grid, and lightbox.
`auth_required: true` blurs the content and shows a login/register CTA to unauthenticated
visitors (soft gate — JS-based, not Caddy-level). Good for driving registrations.

See `txt2zimage/mlcprodweb/pages/showcase/gallery.yaml` as a real-world example.

---

## Downloads

- `downloads.free: true` → direct `<a href>` links (rendered at build time).
- `downloads.free: false` → auth-gated: `auth.js` shows download buttons only to logged-in users.
  Upload files to VPS: `rsync ./myproduct-win.exe root@mlcgo.eu:/var/www/html/downloads/my-product/`

---

## AI-assisted authoring with Gemini CLI + MCP

`mlcprodweb mcp-server` exposes five tools to Gemini (and any MCP-compatible AI):
`read_guide`, `read_project_files`, `read_files`, `write_file`, `validate`, `scaffold`.

The MCP server is registered globally in `~/.gemini/settings.json` — no per-project setup needed.

### Creating a new product page

```bash
cd /path/to/your/project   # IMPORTANT: start Gemini from the project root
gemini
```

Prompt:
```
Use ONLY the mlcprodweb MCP tools for all file operations —
do NOT use shell commands or native file editing tools.

1. Call read_guide — understand the schema before writing anything.
2. Call scaffold with name="<Product Name>", version="beta",
   platforms=["Linux", "macOS"].
3. Call read_project_files with files=["README.md"] to understand the product.
4. Write mlcprodweb/meta.yaml with all required fields:
   id, name, version, status, category, license, platforms,
   slogan_en, slogan_de, and 6+ features (each needs
   icon, title_en, title_de, desc_en, desc_de).
   Use Lucide icon names from lucide.dev.
5. Write mlcprodweb/en.md — H1 hero title, "What it does",
   "Key features" sections.
6. Write mlcprodweb/de.md — German translation.
7. Call validate — fix all ERRORS, address WARNINGS where possible.
```

After Gemini finishes: review the output, commit, and add to `sync.yaml`.

### Reviewing and updating an existing page

Use this when the project has changed and the product page may be outdated:

```bash
cd /path/to/your/project
gemini
```

Prompt:
```
Use ONLY the mlcprodweb MCP tools for all file operations —
do NOT use shell commands or native file editing tools.

1. Call read_project_files with files=["README.md", "CHANGELOG.md"]
   (add other relevant files if they exist).
2. Call read_files with files=["meta.yaml", "en.md", "de.md"].
3. Compare the current project state with the product page:
   - Are features still accurate?
   - Is the version correct?
   - Are there new features not yet mentioned?
   - Is anything described that no longer exists?
4. Update any outdated files using write_file.
5. Call validate — fix all ERRORS, address WARNINGS.
```

### Important rules for AI agents

- **Always start Gemini from the project root** — the MCP server inherits
  the working directory; scaffold and write_file work relative to CWD.
- **Only use MCP tools** for reading/writing mlcprodweb/ files — do not use
  Gemini's native shell or file tools, which ignore the path restrictions.
- **Do not invent GitHub URLs** — leave `github: ""` if unsure.
- **Do not copy openapi.yaml** manually — if the project has one, reference
  it in meta.yaml and Gemini can copy it using write_file.
- **validate reports two levels:** ERRORS must be fixed; WARNINGS should be
  improved but won't break the build.

---

## Publishing to mlcgo.eu

1. Commit this `mlcprodweb/` directory.
2. Add this project to `/mnt/data2tb/mlcgo-vps/sync.yaml`:

```yaml
  - id: mlcremote
    repo: git@github.com:your-org/mlcremote.git
    path: /mnt/data2tb/mlcgo-vps
```

   Then run: `task content:sync && task products:deploy`.

> **Note:** When this file was generated by `mlcprodweb init`, the concrete `sync.yaml`
> path and a ready-to-paste YAML snippet were inserted above automatically.
> If you see a generic placeholder instead, re-run `mlcprodweb init` or edit `sync.yaml` manually.

---

## mlcprodweb config

`mlcprodweb init` stores your mlcgo-vps repo path in:

```
~/.config/mlcprodweb/config
```

Format:
```
vps_repo=/mnt/data2tb/mlcgo-vps
```

Edit this file to change the default path shown when running `mlcprodweb init` in future projects.
To reset: delete the file and re-run `mlcprodweb init`.
