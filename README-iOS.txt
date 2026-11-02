POKÉMON CHAMPIONS — REGULATION M-C TEAM BUILDER
iPhone/iPad offline-first PWA

WHAT'S INCLUDED
- Searchable Champions Pokédex and form selector
- Pokémon-specific ability selection
- Pokémon-specific learnable move lists
- Held-item selector
- Nature and Tera Type fields
- 6 team slots
- Champions Stat Point inputs (6 stats; 0–32 per stat; 66 per Pokémon)
- Team checks, local team save/load, text import/export
- IndexedDB database cache and service-worker app-shell cache

IMPORTANT FIRST-RUN STEP
This ZIP contains the complete app shell, but the large game database is downloaded on first use from public community datasets and cached on your iPhone. You need an internet connection for the first database sync. After the sync completes, the app can be opened offline.

INSTALL ON IPHONE (NO COMPUTER REQUIRED)
1. Extract this ZIP in the iOS Files app.
2. Create a free public GitHub repository named pokemon-champions-team-builder.
3. Upload every file in this folder to the repository root (not the ZIP and not the enclosing folder).
4. In GitHub repository Settings > Pages, choose Deploy from a branch, branch main, folder /(root), then Save.
5. Wait for GitHub Pages to publish. Open https://YOUR-USERNAME.github.io/pokemon-champions-team-builder/ in Safari.
6. Tap Share > Add to Home Screen. If shown, enable Open as Web App.
7. Open the new Home Screen app while online. Tap Sync database and wait until it says Database saved offline.
8. Test: close the app, enable Airplane Mode, and reopen it.

DATABASE SOURCES
- Gheist23/pokemonbattledata: Pokémon Champions battle data, app-data, and per-Pokémon learnable_moves CSVs.
- tinoxo/PokeCalc: Regulation M-C roster and legality snapshots.
- Seancheey/PokeDD: Regulation M-C additions and overrides.
- otterlyclueless/pokemon-champions-data: fallback Champions learnset data.

DATA ACCURACY NOTE
The app uses the Pokémon Champions battle-data repository's per-Pokémon learnable_moves CSVs where available and Regulation M-C roster/override sources. Forms inherit their base species learnset when no separate form-specific learnset exists. A missing learnset is left unavailable rather than showing every move. These are community-maintained datasets, not an official Nintendo API; verify tournament-critical legality against the current in-game rules and official regulation notice.

OFFLINE STORAGE
The database is cached in IndexedDB on the device/browser. Teams are stored locally in the same browser profile. Clearing Safari website data or removing site data may erase local teams/database; use Export team for backups.

This is an independent fan-made tool and is not affiliated with Nintendo, Game Freak, The Pokémon Company, or Pokémon Champions.
