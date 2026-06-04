import { hardcodedProgram } from './defaultProgram.js';
import { saveState, state } from './storage.js';
import { ensureTargetRepsLength, normalizeExerciseName, uid } from './utils.js';

export function findProgram(id) {
  return state.programs.find(p => p.id === id) || null;
}

export function findDay(programId, dayId) {
  const program = findProgram(programId);
  return program?.days.find(d => d.id === dayId) || null;
}

export function findExercise(exerciseId) {
  return state.exercises.find(e => e.id === exerciseId) || null;
}

export function ensureDefaultProgramSeededIfEmpty() {
  state.ui ||= {};
  const existingHardcoded = state.programs.find(p => normalizeExerciseName(p.name) === normalizeExerciseName(hardcodedProgram.name));
  if (existingHardcoded) {
    state.ui.defaultProgramId = existingHardcoded.id;
    state.ui.defaultProgramSeeded = true;
    saveState();
    return;
  }

  const exerciseIdByName = new Map(state.exercises.map(ex => [normalizeExerciseName(ex.name), ex.id]));
  const getOrCreateExerciseId = (name) => {
    const key = normalizeExerciseName(name);
    if (!key) return null;
    const existingId = exerciseIdByName.get(key);
    if (existingId) return existingId;
    const ex = { id: uid(), name: String(name).trim() };
    state.exercises.push(ex);
    exerciseIdByName.set(key, ex.id);
    return ex.id;
  };

  const addItem = (day, exerciseName, sets, targetReps) => {
    const exerciseId = getOrCreateExerciseId(exerciseName);
    if (!exerciseId) return;
    const setCount = Math.max(1, Number(sets) || 1);
    const reps = Array.isArray(targetReps)
      ? ensureTargetRepsLength(targetReps, setCount)
      : Array(setCount).fill(Number.isFinite(Number(targetReps)) ? Number(targetReps) : 0);
    day.items.push({
      id: uid(),
      exerciseId,
      sets: setCount,
      targetReps: reps
    });
  };

  const program = { id: uid(), name: hardcodedProgram.name, nextDayIndex: 0, days: [] };

  hardcodedProgram.days.forEach(sourceDay => {
    const day = { id: uid(), name: sourceDay.subtitle ? `${sourceDay.name} (${sourceDay.subtitle})` : sourceDay.name, items: [] };
    sourceDay.blocks.flat().forEach(item => {
      addItem(day, item.name, item.sets, item.targets || item.target);
    });
    program.days.push(day);
  });

  state.programs.push(program);
  state.ui.defaultProgramId = program.id;
  state.ui.defaultProgramSeeded = true;
  saveState();
}

export function getDefaultProgramId() {
  if (state.ui.defaultProgramId && findProgram(state.ui.defaultProgramId)) return state.ui.defaultProgramId;
  return state.programs[0]?.id || '';
}

export function getDefaultDayForProgram(program) {
  if (!program?.days.length) return { day: null, index: -1 };
  const idx = Math.max(0, Math.min(program.nextDayIndex || 0, program.days.length - 1));
  return { day: program.days[idx], index: idx };
}

export function getDefaultProgram() {
  const id = getDefaultProgramId();
  return id ? findProgram(id) : state.programs[0] || null;
}
