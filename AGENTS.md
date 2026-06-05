## Rules
- DO NOT update the CACHE_NAME variable which stores the user's programs, exercises, sessions and history UNLESS the update modifies the type signature of any of the former. Visual changes should NOT reset the database.

## Feature File Map

| Feature | Files | Description |
|---------|-------|-------------|
| **App shell / Boot** | `index.html`, `app.js`, `styles.css` | SPA shell, bootloader, all styles |
| **PWA / Offline** | `manifest.json`, `sw.js`, `src/pwa.js`, `icons/` | App manifest, service worker, install prompt |
| **Configuration** | `src/config.js` | Storage key, DB name/version constants |
| **DOM references** | `src/dom.js` | Central registry of all DOM element references |
| **Utilities** | `src/utils.js` | UUID gen, exercise name normalization, target rep parsing |
| **State persistence** | `src/storage.js` | localStorage load/save, IndexedDB, state migration, mutable `state` object |
| **Chart rendering** | `src/chart.js` | Canvas line chart for history & weight progression |
| **Program view** | `src/defaultProgram.js`, `src/programStore.js`, `src/programView.js` | Read-only display of the default workout program |
| **Session / Workout** | `src/sessionPreview.js`, `src/sessionController.js` | Session home preview, active workout tracking, sets grid |
| **History** | `src/historyView.js` | Completed sessions log, exercise progress chart selector |
| **Weight tracking** | `src/weightView.js` | Body weight logging + chart |
| **Calorie / Macro** | `src/calorieView.js` | Calorie/macro goals, food logging, incline walk calculator |
| **Backup / Import** | `src/backup.js` | Export/import all data as JSON |
