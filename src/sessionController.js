import { dom } from './dom.js';
import { findDay, findExercise, findProgram, getDefaultProgram } from './programStore.js';
import { saveState, state } from './storage.js';
import { ensureTargetRepsLength, formatTarget, normalizeExerciseName, uid } from './utils.js';

let session = null;
let setHeaderSubtitle = () => {};
let renderHistory = () => {};

export function initSessionController(options) {
  setHeaderSubtitle = options.setHeaderSubtitle;
  renderHistory = options.renderHistory;

  dom.sessionStartBtn?.addEventListener('click', startSession);
  dom.completeSessionBtn.addEventListener('click', () => completeSession(false));
  dom.prevExerciseBtn?.addEventListener('click', () => cycleExercise(-1));
  dom.nextExerciseBtn?.addEventListener('click', () => cycleExercise(1));
  dom.addSetBtn?.addEventListener('click', () => changeCurrentExerciseSets(1));
  dom.removeSetBtn?.addEventListener('click', () => changeCurrentExerciseSets(-1));

  window.addEventListener('keydown', e => {
    if (!session) return;
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    const active = document.activeElement?.tagName || '';
    if (active === 'INPUT' || active === 'TEXTAREA' || active === 'SELECT') return;
    e.preventDefault();
    cycleExercise(e.key === 'ArrowLeft' ? -1 : 1);
  });
}

export function hasActiveSession() {
  return Boolean(session);
}

export function resetSession() {
  session = null;
  document.body.classList.remove('session-active');
}

export function updateSessionUI() {
  if (!session) {
    document.body.classList.remove('session-active');
    dom.sessionRunCard?.classList.add('hidden');
    dom.sessionControls.classList.add('hidden');
    dom.sessionStatus.textContent = 'No active session.';
    return;
  }

  document.body.classList.add('session-active');
  dom.sessionRunCard?.classList.remove('hidden');
  dom.sessionControls.classList.remove('hidden');
  const current = session.exercises[session.exerciseIndex];
  dom.currentExerciseEl.textContent = current.name;
  dom.setProgressEl.textContent = `Exercise ${session.exerciseIndex + 1}/${session.exercises.length} \u2022 ${current.sets} sets`;
  if (dom.removeSetBtn) dom.removeSetBtn.disabled = (current.sets || 1) <= 1;

  const program = findProgram(session.programId);
  const day = findDay(session.programId, session.dayId);
  dom.sessionStatus.textContent = `${program?.name || 'Program'} \u2022 ${day?.name || 'Day'} \u2014 Exercise ${session.exerciseIndex + 1}/${session.exercises.length}`;

  renderSetsGrid();
}

function startSession() {
  if (session) return;

  const program = getDefaultProgram();
  if (!program || !program.days.length) return;

  const day = findDay(program.id, dom.sessionDaySelect.value);
  if (!day || !day.items.length) return;
  const dayIndex = program.days.findIndex(d => d.id === day.id);

  const exercises = day.items.map(item => {
    const name = findExercise(item.exerciseId)?.name || 'Unknown Exercise';
    return { name, sets: item.sets, targetReps: Array.isArray(item.targetReps) ? item.targetReps.slice() : [] };
  });

  const previousByName = {};
  exercises.forEach(ex => {
    const prev = getLatestExerciseFromHistory(ex.name);
    if (!prev) return;
    previousByName[normalizeExerciseName(ex.name)] = prev;
    if (prev.sets.length > 0) {
      ex.sets = prev.sets.length;
      ex.targetReps = ensureTargetRepsLength(ex.targetReps, ex.sets);
    }
  });

  session = {
    programId: program.id,
    dayId: day.id,
    dayIndex,
    exerciseIndex: 0,
    exercises,
    previousByName,
    log: exercises.map(ex => ({
      name: ex.name,
      targetReps: ex.targetReps,
      sets: buildInitialSets(previousByName[normalizeExerciseName(ex.name)], ex.sets)
    }))
  };

  setHeaderSubtitle('Active');
  updateSessionUI();
}

function buildInitialSets(prev, count) {
  return Array.from({ length: count }, (_, idx) => {
    const prevSet = prev?.sets?.[idx];
    return {
      reps: typeof prevSet?.reps === 'number' ? prevSet.reps : null,
      weight: typeof prevSet?.weight === 'number' ? prevSet.weight : null
    };
  });
}

function getLatestExerciseFromHistory(exerciseName) {
  const target = normalizeExerciseName(exerciseName);
  if (!target) return null;

  let best = null;
  for (const entry of state.history || []) {
    const performedAt = entry?.performedAt;
    const exercises = entry?.exercises;
    if (!performedAt || !Array.isArray(exercises)) continue;
    const match = exercises.find(ex => normalizeExerciseName(ex?.name) === target);
    if (!match || !Array.isArray(match.sets)) continue;
    if (!best || String(performedAt) > String(best.performedAt)) {
      best = {
        performedAt: String(performedAt),
        sets: match.sets.map(s => ({
          reps: s?.reps ?? null,
          weight: s?.weight ?? null
        }))
      };
    }
  }
  return best;
}

function renderSetsGrid() {
  if (!session || !dom.setsGrid) return;
  const current = session.exercises[session.exerciseIndex];
  const logEntry = session.log[session.exerciseIndex];
  const prev = session.previousByName?.[normalizeExerciseName(current?.name)];
  dom.setsGrid.innerHTML = '';

  if (!Array.isArray(logEntry.sets)) logEntry.sets = [];
  while (logEntry.sets.length < current.sets) {
    const prevSet = prev?.sets?.[logEntry.sets.length];
    logEntry.sets.push({
      reps: typeof prevSet?.reps === 'number' ? prevSet.reps : null,
      weight: typeof prevSet?.weight === 'number' ? prevSet.weight : null
    });
  }
  if (logEntry.sets.length > current.sets) logEntry.sets = logEntry.sets.slice(0, current.sets);

  for (let i = 0; i < current.sets; i++) {
    const row = document.createElement('div');
    row.className = 'set-row';

    const label = document.createElement('div');
    label.className = 'set-label';
    const target = current.targetReps[i] ?? 0;
    label.textContent = `Set ${i + 1} \u00b7 t${formatTarget(target)}`;

    const repsInput = document.createElement('input');
    repsInput.type = 'number';
    repsInput.min = '0';
    repsInput.inputMode = 'numeric';
    repsInput.placeholder = 'Reps';
    repsInput.value = logEntry.sets[i].reps ?? '';
    repsInput.addEventListener('input', () => {
      const raw = repsInput.value.trim();
      logEntry.sets[i].reps = raw === '' ? null : parseInt(raw, 10);
    });

    const repsField = document.createElement('div');
    repsField.className = 'set-field';
    repsField.appendChild(repsInput);

    const weightInput = document.createElement('input');
    weightInput.type = 'number';
    weightInput.min = '0';
    weightInput.step = '0.1';
    weightInput.inputMode = 'decimal';
    weightInput.placeholder = 'Weight';
    weightInput.value = logEntry.sets[i].weight ?? '';
    weightInput.addEventListener('input', () => {
      const raw = weightInput.value.trim();
      logEntry.sets[i].weight = raw === '' ? null : parseFloat(raw);
    });

    const weightField = document.createElement('div');
    weightField.className = 'set-field';
    weightField.appendChild(weightInput);

    if (prev?.sets?.length) {
      const prevSet = prev.sets[i];
      const hintText = formatPreviousSet(prevSet);
      const weightPrev = document.createElement('div');
      weightPrev.className = 'set-prev';
      weightPrev.textContent = hintText;
      const repsPrev = document.createElement('div');
      repsPrev.className = 'set-prev';
      repsPrev.textContent = hintText;
      weightField.appendChild(weightPrev);
      repsField.appendChild(repsPrev);
    }

    row.append(label, weightField, repsField);
    dom.setsGrid.appendChild(row);
  }
}

function formatPreviousSet(prevSet) {
  if (!prevSet) return 'Last \u2014';
  const reps = typeof prevSet.reps === 'number' ? prevSet.reps : null;
  const weight = typeof prevSet.weight === 'number' ? prevSet.weight : null;
  if (reps == null && weight == null) return 'Last \u2014';
  if (reps != null && weight != null) return `Last ${weight}kg x ${reps}`;
  if (weight != null) return `Last ${weight}kg x \u2014`;
  return `Last \u2014 x ${reps}`;
}

function cycleExercise(delta) {
  if (!session?.exercises?.length) return;
  const len = session.exercises.length;
  session.exerciseIndex = (session.exerciseIndex + delta + len) % len;
  updateSessionUI();
}

function changeCurrentExerciseSets(delta) {
  if (!session) return;
  const current = session.exercises[session.exerciseIndex];
  const logEntry = session.log[session.exerciseIndex];
  const prev = session.previousByName?.[normalizeExerciseName(current?.name)];
  if (!current || !logEntry) return;

  const nextSets = Math.max(1, (current.sets || 1) + delta);
  if (nextSets === current.sets) return;

  current.sets = nextSets;
  current.targetReps = ensureTargetRepsLength(current.targetReps, nextSets);
  logEntry.targetReps = current.targetReps;

  if (!Array.isArray(logEntry.sets)) logEntry.sets = [];
  while (logEntry.sets.length < nextSets) {
    const prevSet = prev?.sets?.[logEntry.sets.length];
    logEntry.sets.push({
      reps: typeof prevSet?.reps === 'number' ? prevSet.reps : null,
      weight: typeof prevSet?.weight === 'number' ? prevSet.weight : null
    });
  }
  if (logEntry.sets.length > nextSets) logEntry.sets = logEntry.sets.slice(0, nextSets);

  updateSessionUI();
}

function completeSession(force) {
  if (!session) return;
  if (!force && !confirm('Complete session and save to history?')) return;

  const program = findProgram(session.programId);
  const day = findDay(session.programId, session.dayId);

  const entry = {
    id: uid(),
    programId: session.programId,
    dayId: session.dayId,
    programName: program?.name ?? 'Unknown Program',
    dayName: day?.name ?? 'Unknown Day',
    performedAt: new Date().toISOString(),
    exercises: session.log.map(ex => ({
      name: ex.name,
      sets: ex.sets.map((s, idx) => ({ target: ex.targetReps[idx], reps: s.reps, weight: s.weight }))
    }))
  };

  state.history.push(entry);

  if (program?.days.length) {
    const idx = session.dayIndex >= 0 ? session.dayIndex : program.days.findIndex(d => d.id === session.dayId);
    const nextIdx = idx >= 0 ? (idx + 1) % program.days.length : 0;
    program.nextDayIndex = nextIdx;
  }

  session = null;
  saveState();
  renderHistory();
  updateSessionUI();
}
