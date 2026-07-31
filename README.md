# OpenChamber RTL Patch for macOS

Unofficial macOS-only RTL patch for the OpenChamber desktop app.

This patch injects a small runtime script into OpenChamber's bundled web UI so Arabic, Hebrew, and other RTL text can render right-to-left and align to the right, while code blocks, terminal output, tables, and markdown code stay left-to-right.

## macOS Only

This project is designed for macOS only.

It depends on macOS application bundle paths, `/Applications/OpenChamber.app`, `osascript`, and `codesign`. It is not intended for Windows or Linux.

## What It Does

- Finds `/Applications/OpenChamber.app`.
- Backs up the original `web-dist/index.html` and `web-dist/mini-chat.html`.
- Injects an RTL runtime script into OpenChamber's `web-dist/assets` folder.
- Patches both the main window and mini chat HTML entrypoints.
- Re-signs the app locally with an ad-hoc signature.
- Keeps code-like surfaces in LTR mode.
- Applies RTL when any RTL character appears, even if the line starts with English text.

## Install

Close OpenChamber first, then run:

```bash
bash openchamber-rtl-patch.sh
```

You may be asked for your macOS password depending on your local permissions.

After installation, reopen OpenChamber.

The installer now saves a complete copy of the official signed app before patching. Check the current state with:

```bash
bash openchamber-rtl-patch.sh --status
```

For a selectable tool menu, run:

```bash
bash openchamber-rtl-patch.sh --menu
```

## CLI

Install the command from a checkout:

```bash
npm install --global .
```

Then use:

```bash
openchamber-rtl install
openchamber-rtl status --json
openchamber-rtl update
openchamber-rtl restore
```

`update` restores the official signed bundle, waits for OpenChamber's version to change, and reapplies RTL after the update. Keep the terminal open and click **Restart to Update** in OpenChamber.

## Restore

To restore the original OpenChamber files:

```bash
bash openchamber-rtl-patch.sh --restore
```

Restore puts the complete official signed app back when that backup exists, so the built-in updater remains valid.

## Smart updates

Run this command before using OpenChamber's **Restart to Update** button:

```bash
bash openchamber-rtl-patch.sh --smart-update
```

It restores the official signed bundle, opens OpenChamber, waits for the version to change, and reapplies the RTL patch after the new version starts. Keep the terminal window open while the update runs.

## After OpenChamber Updates

If an update is started without `--smart-update`, the official updater may remove the patch. Run the installer again only after confirming the new app version is installed; using `--restore` first is safer when the patch state is uncertain.

The installer keeps backups under:

```text
~/Library/Application Support/OpenChamber RTL Patch
```

## Test

```bash
npm test
```

## Notes

This is an unofficial local patch. It modifies the installed app bundle on your machine and may need to be re-applied after app updates.

If macOS shows a security warning after patching, open System Settings, go to Privacy & Security, and allow the app manually if you trust this local modification.
