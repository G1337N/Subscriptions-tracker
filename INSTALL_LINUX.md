# Install Subscription Tracker on Linux

## Option A: Debian/Ubuntu (.deb)

1. Download latest `.deb` from Releases.
2. Install:

```bash
sudo apt install ./"Subscription Tracker"_*_amd64.deb
```

3. Run from app launcher: **Subscription Tracker**

---

## Option B: Fedora/RHEL (.rpm)

1. Download latest `.rpm` from Releases.
2. Install:

```bash
sudo dnf install ./"Subscription Tracker"-*.x86_64.rpm
```

3. Run from app launcher: **Subscription Tracker**

---

## Uninstall

### Debian/Ubuntu

```bash
sudo apt remove subscription-tracker
```

### Fedora/RHEL

```bash
sudo dnf remove subscription-tracker
```

---

## Troubleshooting

- If install fails due missing dependencies, run system updates first.
- If old data causes weird behavior, remove app data:

```bash
rm -rf ~/.local/share/com.openclaw.subscription.tracker
```
