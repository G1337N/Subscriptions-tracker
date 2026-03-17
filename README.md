# Subscription Tracker (Desktop)

A desktop app to track subscriptions, renewal dates, links, status, and real spend.

Built with **Tauri + React**.

## What users can do

- Add subscriptions with service name, category, cost, billing cycle
- Set next payment and current payment dates
- Use custom category details for `Other`
- Pause/activate subscriptions with date
- Save and open direct management links in browser
- See spend summary based on logged payments (no fake projections)
- Use light/dark mode

## Download & install (Linux)

Go to **Releases** and download one of:

- `.deb` (Ubuntu / Debian / Linux Mint)
- `.rpm` (Fedora / RHEL / CentOS)

Detailed install steps: see [INSTALL_LINUX.md](./INSTALL_LINUX.md)

## Run locally (dev)

```bash
cd /home/l/projects/subscription-tracker
source ~/.cargo/env
npm install
npx tauri dev
```

## Build locally (Linux)

```bash
cd /home/l/projects/subscription-tracker
source ~/.cargo/env
npm install
npx tauri build --bundles deb,rpm
```

Binary output:

- `src-tauri/target/release/subscription-tracker`

Package output:

- `src-tauri/target/release/bundle/deb/*.deb`
- `src-tauri/target/release/bundle/rpm/*.rpm`

## Project structure

- `src/` — React UI
- `src-tauri/` — native desktop shell (Rust/Tauri)
- `.github/workflows/release.yml` — build and publish Linux packages on version tags

## Versioning / releases

When a tag like `v0.1.0` is pushed, GitHub Actions builds Linux installers and publishes them to a GitHub Release.

## License

TBD (add a LICENSE file before public distribution if needed)
