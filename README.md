# Knight's Launcher

A desktop launcher for the [Knights and Merchants REMAKE](https://www.kamremake.com/) project.

Manage game versions, maps and campaigns — download, install and launch them all from one place.

## Features (planned)

- Download and install game versions from the KaM Remake update server
- Launch installed versions
- Manage maps and campaigns (download, move between versions)
- Cross-platform: Windows (primary), Linux and macOS

## Tech Stack

| Layer | Technology |
|---|---|
| UI | Angular 19 + Bootstrap 5.3 |
| Desktop shell | Tauri 2 (Rust) |
| Language | TypeScript (frontend), Rust (backend — minimal) |
| Build | Angular CLI + Cargo |
| CI | GitHub Actions |

## Prerequisites

### All platforms
- [Node.js](https://nodejs.org/) 20 or later
- [Rust](https://rustup.rs/) (stable toolchain)

### Linux (Ubuntu 22.04+ / Debian 12+)

> **Ubuntu 20.04 and older are not supported.** Tauri 2 requires `webkit2gtk-4.1`,
> which is only available from Ubuntu 22.04 / Debian 12 onwards.

```bash
sudo apt-get install \
    libwebkit2gtk-4.1-dev \
    libayatana-appindicator3-dev \
    librsvg2-dev \
    patchelf
```

### Windows
No extra steps — the MSVC toolchain is picked up automatically if
[Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/)
are installed (required by Rust on Windows).

### macOS
```bash
xcode-select --install
```

## Development

```bash
# Install dependencies
npm install

# Start dev mode (hot-reload, opens the app window)
npm run tauri dev
```

The Angular dev server runs on `http://localhost:1420`. Tauri points its webview
at that address, so changes to TypeScript/HTML/CSS files reload the window
instantly without restarting the Rust backend.

## Building

### Linux (native)

```bash
npm run tauri build
```

Output:
- `src-tauri/target/release/bundle/deb/*.deb`
- `src-tauri/target/release/bundle/appimage/*.AppImage`

### Windows (native, run on Windows)

```bash
npm run tauri build
```

Output:
- `src-tauri/target/release/bundle/msi/*.msi`
- `src-tauri/target/release/bundle/nsis/*.exe`

### Via Docker (Linux build only)

Useful if you don't want to install the webkit/GTK system libraries locally.

```bash
docker compose run --rm build
```

Rust and npm caches are stored in named Docker volumes, so subsequent builds
are fast.

### CI (GitHub Actions)

Every push to `main` and every pull request automatically builds for both
Linux and Windows. Artifacts are uploaded and available for download from the
Actions run page.

macOS builds are included in the workflow but commented out — uncomment the
relevant matrix entry in `.github/workflows/build.yml` to enable them.

## App Icons

Icons are not included in the repository. Generate them from a single source
image (512×512 PNG or larger):

```bash
npm run tauri icon path/to/icon.png
```

This creates all required sizes under `src-tauri/icons/`.

## Project Structure

```
knights-launcher/
├── src/                        # TypeScript / Angular frontend
│   ├── app/
│   │   ├── AppComponent.ts     # Root component
│   │   ├── AppComponent.html
│   │   ├── AppComponent.css
│   │   └── AppConfig.ts        # Application-level providers
│   ├── index.html              # Shell HTML (Bootstrap dark theme set here)
│   ├── main.ts                 # Angular bootstrap entry point
│   └── styles.css              # Global styles (Bootstrap import)
├── src-tauri/                  # Rust / Tauri backend
│   ├── src/
│   │   ├── lib.rs              # Plugin registration; add commands here
│   │   └── main.rs             # Binary entry point
│   ├── capabilities/
│   │   └── default.json        # Tauri API permission declarations
│   ├── icons/                  # App icons (generate with "tauri icon")
│   ├── Cargo.toml
│   └── tauri.conf.json         # Tauri configuration
├── public/                     # Static assets (copied as-is to build output)
├── .github/workflows/
│   └── build.yml               # CI: Linux + Windows matrix build
├── angular.json                # Angular CLI workspace configuration
├── tsconfig.json
├── Dockerfile                  # Reproducible Linux build environment
├── docker-compose.yml
└── rustfmt.toml                # Rust formatting rules
```

## Contributing

Contributions are welcome. A few notes:

- Coding style is documented in `CLAUDE.md` — please follow it
- The frontend (TypeScript/Angular) is where most feature work happens;
  Rust changes should be minimal and limited to cases where no Tauri plugin
  covers the need
- Open an issue before starting large features so we can align on approach

## License

[MIT](LICENSE) — © greeny
