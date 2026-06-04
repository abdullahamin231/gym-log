import { dbName, dbVersion, storageKey } from './config.js';
import { parseTargetReps, uid } from './utils.js';

export const state = loadState();
ensureUiDefaults();

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
    if (!raw) return { programs: [], exercises: [], history: [], ui: {}, weightEntries: [] };
    const parsed = JSON.parse(raw);
    return migrateIfNeeded(parsed);
  } catch (e) {
    console.error('Failed to parse storage', e);
    return { programs: [], exercises: [], history: [], ui: {}, weightEntries: [] };
  }
}

export function saveState() {
  localStorage.setItem(storageKey, JSON.stringify(state));
}

export function applyImportedState(next) {
  const migrated = migrateIfNeeded(next);
  state.programs = Array.isArray(migrated.programs) ? migrated.programs : [];
  state.exercises = Array.isArray(migrated.exercises) ? migrated.exercises : [];
  state.history = Array.isArray(migrated.history) ? migrated.history : [];
  state.ui = typeof migrated.ui === 'object' && migrated.ui ? migrated.ui : {};
  state.weightEntries = Array.isArray(migrated.weightEntries) ? migrated.weightEntries : [];
  ensureUiDefaults();
  saveState();
}

export function ensureUiDefaults() {
  state.ui ||= {};
  if (typeof state.ui.defaultProgramId !== 'string') state.ui.defaultProgramId = '';
  if (typeof state.ui.defaultProgramSeeded !== 'boolean') state.ui.defaultProgramSeeded = false;
}

function migrateIfNeeded(parsed) {
  if (Array.isArray(parsed.exercises) && Array.isArray(parsed.programs)) {
    return {
      ...parsed,
      ui: parsed.ui || {},
      weightEntries: Array.isArray(parsed.weightEntries) ? parsed.weightEntries : []
    };
  }

  const old = parsed;
  const next = { programs: [], exercises: [], history: Array.isArray(old.history) ? old.history : [], ui: {}, weightEntries: [] };
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
