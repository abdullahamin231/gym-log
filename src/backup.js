import { dbName } from './config.js';
import { dom } from './dom.js';
import { openDb, applyImportedState, state } from './storage.js';

export function initBackup(options) {
  const { onImported } = options;
  dom.exportBtn?.addEventListener('click', () => exportAllData());
  dom.importBtn?.addEventListener('click', () => dom.importFile?.click());
  dom.importFile?.addEventListener('change', async () => {
    const file = dom.importFile.files?.[0];
    dom.importFile.value = '';
    if (!file) return;
    await importAllData(file, onImported);
  });
}

async function exportAllData() {
  const payload = {
    format: 'gym-log-backup-v1',
    exportedAt: new Date().toISOString(),
    state: {
      programs: state.programs,
      exercises: state.exercises,
      history: state.history,
      weightEntries: state.weightEntries,
      calorieGoals: state.calorieGoals,
      calorieDays: state.calorieDays,
      ui: state.ui
    },
    indexedDb: {
      dbName,
      stores: { files: [] }
    }
  };

  try {
    const db = await openDb();
    const files = await new Promise((resolve, reject) => {
      const tx = db.transaction('files', 'readonly');
      const store = tx.objectStore('files');
      if (store.getAll) {
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      } else {
        const items = [];
        store.openCursor().onsuccess = e => {
          const cursor = e.target.result;
          if (cursor) {
            items.push(cursor.value);
            cursor.continue();
          }
        };
        tx.oncomplete = () => resolve(items);
        tx.onerror = () => reject(tx.error);
      }
    });
    payload.indexedDb.stores.files = files;
  } catch (e) {
    console.warn('IndexedDB export skipped:', e);
  }

  const json = JSON.stringify(payload, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `gym-log-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function importAllData(file, onImported) {
  const text = await file.text();
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    alert('Invalid JSON file.');
    return;
  }

  if (parsed?.format !== 'gym-log-backup-v1' || !parsed?.state) {
    alert('Unrecognized backup format.');
    return;
  }

  if (!confirm('Importing will replace your current data for this site on this device. Continue?')) return;
  applyImportedState(parsed.state);

  try {
    const db = await openDb();
    const files = parsed?.indexedDb?.stores?.files;
    if (Array.isArray(files)) {
      await new Promise((resolve, reject) => {
        const tx = db.transaction('files', 'readwrite');
        const store = tx.objectStore('files');
        store.clear();
        files.forEach(item => {
          if (!item || typeof item.path !== 'string') return;
          store.put(item);
        });
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    }
  } catch (e) {
    console.warn('IndexedDB import skipped:', e);
  }

  onImported();
}
