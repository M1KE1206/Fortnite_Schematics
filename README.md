# STW Schematic Tracker

Client-side tracker for Fortnite Save the World schematics: calculates the exact
resources needed to bring schematics to max level (PL130) and god-roll all perks,
across your whole collection, with inventory tracking and shortage overview.

## Features

- Per-schematic level (10-50) and per-perk-slot rarity tracking (6 slots)
- Reroll (RE-PERK!) and element change costs included
- Automatic in-game icons via the Fortnite Wiki (no API key), cached in your browser
- Aggregated totals + inventory shortage view
- All cost values editable in Settings (defaults follow current in-game values)
- Data stored in localStorage; JSON export/import for backup
- Optional one-click inventory sync from your Epic account (local only)
- One-click import of your schematics (name, level, current perks) from your Epic account

## Epic account sync (optional)

Link your Epic account once (Inventory & Settings tab) and pull your STW
evolution and perk materials with one click. Runs entirely on your machine:
the dev server talks to Epic's (unofficial) services and stores a revocable
device auth in `.stw-auth.json` (gitignored, never leaves your PC). Note:
these are the same unofficial endpoints community tools use - they may break
if Epic changes them.

## Development

npm install
npm run dev     # dev server
npm test        # unit tests (Vitest)
npm run build   # production build to dist/
