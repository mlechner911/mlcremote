# Supported Features

MLCRemote provides a rich set of features for file management and editing. This document details the supported file formats for previews and syntax highlighting.

## File Previews
The unified "Smart Preview" system automatically detects file types and renders them appropriately.

###  Images
Supported formats (via Image Viewer):
- `.png`
- `.jpg` / `.jpeg`
- `.gif`
- `.webp`
- `.svg` (Rendered as image, editable as code)

###  Video
Supported formats (via HTML5 Video Player):
- `.mp4`
- `.webm`
- `.ogg`
- `.mov`

### 🎵 Audio
Supported formats (via HTML5 Audio Player):
- `.mp3`
- `.wav`
- `.ogg`
- `.flac`
- `.aac` / `.m4a`

### 📄 Documents
- **PDF**: Full in-app PDF viewer with pagination and zoom (`.pdf`).
- **Markdown**: Live preview of Markdown rendering (`.md`, `.markdown`).
- **Archive**: Read-only content listing for archives (`.zip`, `.tar`, `.tar.gz`, `.tgz`).

## Syntax Highlighting
The integrated editor supports syntax highlighting for a wide range of languages and configuration files:

### Code & Scripting
- **Go**: `.go`
- **PHP**: `.php`
- **Python**: `.py`
- **C / C++**: `.c`, `.h`, `.cpp`, `.hpp`, `.cxx`, `.c++`
- **Java**: `.java`
- **JavaScript / TypeScript**: `.js`, `.ts`, `.jsx`, `.tsx`
- **HTML / CSS**: `.html`, `.css`, `.sass`, `.scss`, `.less`
- **Shell Scripts**: `.sh`, `.bash`, `.csh`
    - Special files: `.bashrc`, `.zshrc`, `.profile`, `.bash_history`
- **SQL**: `.sql`

### Configuration & Data
- **JSON**: `.json`
- **YAML**: `.yaml`, `.yml`
- **TOML**: `.toml`
- **INI / Config**: `.ini`, `.cfg`, `.conf`, `.config`, `.gitconfig`, `.editorconfig`
    - Special files: `nginx.conf`
- **XML / SVG**: `.xml`, `.svg`
- **Environment**: `.env`
- **Git**: `.gitignore`

### Build & DevOps
- **Docker**: `Dockerfile`
- **Make**: `Makefile`

## Other Features
- **File Meta**: View detailed file metadata (Size, Permissions, Mod Time) for any file.
- **Binary Fallback**: Unknown binary files are identified and offered for download.
- **Large File Protection**:
    - **Preview**: Text previews limited to 512KB to prevent UI freezing.
    - **Editor**: "Head" and "Tail" partial loading for files > 1MB.
