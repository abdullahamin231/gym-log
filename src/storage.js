import { dbName, dbVersion, storageKey } from './config.js';
import { parseTargetReps, uid } from './utils.js';

const stateBackupPath = '__state__/gym-log-state-v2';
let backupWriteQueue = Promise.resolve();

export const state = loadState();
ensureUiDefaults();
ensureCalorieDefaults();

export function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(dbName, dbVersion);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('files')) {
        db.createObjectStore('files', { keyPath: 'path' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export function loadState() {
  try {
    const raw = localStorage.getItem(storageKey) || localStorage.getItem('gym-log-state-v1');
    if (!raw) return baseState();
    const parsed = JSON.parse(raw);
    return migrateIfNeeded(parsed);
  } catch (e) {
    console.error('Failed to parse storage', e);
    return baseState();
  }
}

export function saveState() {
  localStorage.setItem(storageKey, JSON.stringify(state));
  queueStateBackupWrite();
}

export function applyImportedState(next) {
  const migrated = migrateIfNeeded(next);
  state.programs = Array.isArray(migrated.programs) ? migrated.programs : [];
  state.exercises = Array.isArray(migrated.exercises) ? migrated.exercises : [];
  state.history = Array.isArray(migrated.history) ? migrated.history : [];
  state.ui = typeof migrated.ui === 'object' && migrated.ui ? migrated.ui : {};
  state.weightEntries = Array.isArray(migrated.weightEntries) ? migrated.weightEntries : [];
  state.calorieGoals = typeof migrated.calorieGoals === 'object' && migrated.calorieGoals ? migrated.calorieGoals : {};
  state.calorieDays = Array.isArray(migrated.calorieDays) ? migrated.calorieDays : [];
  ensureUiDefaults();
  ensureCalorieDefaults();
  saveState();
}

export async function restoreStateBackupIfNeeded() {
  if (localStorage.getItem(storageKey) || localStorage.getItem('gym-log-state-v1')) return false;

  try {
    const db = await openDb();
    const backup = await new Promise((resolve, reject) => {
      const tx = db.transaction('files', 'readonly');
      const req = tx.objectStore('files').get(stateBackupPath);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
    db.close?.();

    if (!backup?.state) return false;
    applyImportedState(backup.state);
    return true;
  } catch (e) {
    console.warn('IndexedDB state restore skipped:', e);
    return false;
  }
}

export function ensureUiDefaults() {
  state.ui ||= {};
  if (typeof state.ui.defaultProgramId !== 'string') state.ui.defaultProgramId = '';
  if (typeof state.ui.defaultProgramSeeded !== 'boolean') state.ui.defaultProgramSeeded = false;
}

export function ensureCalorieDefaults() {
  state.calorieGoals ||= {};
  if (!Number.isFinite(Number(state.calorieGoals.protein)) || Number(state.calorieGoals.protein) <= 0) {
    state.calorieGoals.protein = 150;
  }
  if (!Number.isFinite(Number(state.calorieGoals.calories)) || Number(state.calorieGoals.calories) <= 0) {
    state.calorieGoals.calories = 1600;
  }
  if (!Array.isArray(state.calorieDays)) state.calorieDays = [];
}

function baseState() {
  return {
    programs: [],
    exercises: [],
    history: [],
    ui: {},
    weightEntries: [],
    calorieGoals: { protein: 150, calories: 1600 },
    calorieDays: []
  };
}

function queueStateBackupWrite() {
  const snapshot = JSON.parse(JSON.stringify(state));
  backupWriteQueue = backupWriteQueue
    .then(() => writeStateBackup(snapshot))
    .catch(e => console.warn('IndexedDB state backup skipped:', e));
}

async function writeStateBackup(snapshot) {
  const db = await openDb();
  await new Promise((resolve, reject) => {
    const tx = db.transaction('files', 'readwrite');
    tx.objectStore('files').put({
      path: stateBackupPath,
      updatedAt: new Date().toISOString(),
      state: snapshot
    });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close?.();
}

function migrateIfNeeded(parsed) {
  if (Array.isArray(parsed.exercises) && Array.isArray(parsed.programs)) {
    return {
      ...parsed,
      ui: parsed.ui || {},
      weightEntries: Array.isArray(parsed.weightEntries) ? parsed.weightEntries : [],
      calorieGoals: parsed.calorieGoals || { protein: 150, calories: 1600 },
      calorieDays: Array.isArray(parsed.calorieDays) ? parsed.calorieDays : []
    };
  }

  const old = parsed;
  const next = baseState();
  next.history = Array.isArray(old.history) ? old.history : [];
  const byName = new Map();

  const getOrCreateExercise = (name) => {
    const key = String(name || '').trim().toLowerCase();
    if (!key) return null;
    if (byName.has(key)) return byName.get(key);
    const ex = { id: uid(), name: String(name).trim() };
    next.exercises.push(ex);
    byName.set(key, ex);
    return ex;
  };

  const oldPrograms = Array.isArray(old.programs) ? old.programs : [];
  oldPrograms.forEach(p => {
    const program = { id: p.id || uid(), name: p.name || 'Program', nextDayIndex: 0, days: [] };
    const oldDays = Array.isArray(p.days) ? p.days : [];
    oldDays.forEach(d => {
      const day = { id: d.id || uid(), name: d.name || 'Day', items: [] };
      const oldExercises = Array.isArray(d.exercises) ? d.exercises : [];
      oldExercises.forEach(ex => {
        const lib = getOrCreateExercise(ex.name || 'Exercise');
        if (!lib) return;
        day.items.push({
          id: uid(),
          exerciseId: lib.id,
          sets: Number(ex.sets) || 1,
          targetReps: Array.isArray(ex.targetReps) ? ex.targetReps : parseTargetReps(String(ex.targetReps || ''), Number(ex.sets) || 1)
        });
      });
      program.days.push(day);
    });
    next.programs.push(program);
  });

  return next;
}
