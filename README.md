# Tidewater — phone tidy &amp; privacy

An honest, on-device tool for tidying up a phone. Open `index.html` in a phone
browser (no install) and everything runs locally — no photos, apps, or data
ever leave the device.

## What it does

| Tool | What happens |
| --- | --- |
| **Duplicate photos** | Pick photos (or a folder); it groups identical **and** near-identical shots side by side, keeps the best copy, and builds an exact delete list with file names and folders. Matching uses SHA-256 for exact copies and an 8×8 average-hash for look-alikes — all in the browser. |
| **Photo dashboard** | Every service that can auto-upload photos (Google Photos, iCloud, OneDrive, Amazon Photos, Dropbox, Samsung Cloud…) with the exact steps to switch each one off, plus a "which one is my backup home" tracker. |
| **App inventory** | Log apps with their size and whether they cost a subscription (free trials counted as paid), sort by size, and export an uninstall list. Includes a reference list of commonly-forgotten apps. |
| **Cleanup** | Step-by-step guidance for finding and safely removing folders left behind by uninstalled apps, on Android and iPhone. |
| **Voice assistant** | Hands-free navigation using the phone's own speech engine — say "find duplicates", "where do my photos go", "show my apps", "read this". Offline and private. |

## Honest limits (these apply to *every* app, not just this one)

Modern phones deliberately sandbox apps, so no app can:

- **silently delete files or uninstall other apps** — the OS requires you to
  confirm each one. This tool builds an exact list and walks you to the right
  screen instead.
- **flip another app's cloud-backup switch** — so the photo dashboard shows you
  exactly where each toggle lives rather than pretending to change it.
- **open a live AI chat from a shareable web page** — the sandbox blocks
  outbound connections, so the built-in assistant is an offline voice guide.
  A real conversational assistant would require a native (installed) app.

Deeper features (automatic deletion, reading the full installed-app list with
sizes, live AI chat) are only possible in a native Android/iOS app with the
matching OS permissions — that's the natural next step from this prototype.

## Run it

It's a single self-contained file. Open `index.html` locally, or host the repo
with GitHub Pages and open the URL on your phone.
