import { dom } from './dom.js';
import { findExercise, getDefaultProgram } from './programStore.js';
import { saveState, state } from './storage.js';
import { ensureTargetRepsLength, formatTargetReps, parseTargetReps, normalizeExerciseName, uid } from './utils.js';

let editMode = false;
let renderSessionSetup = () => {};

export function initProgramView(options = {}) {
  renderSessionSetup = options.renderSessionSetup || renderSessionSetup;
}

export function renderPrograms() {
  renderProgramSheet();
}

function renderProgramSheet() {
  if (!dom.hardcodedProgramSheet) return;
  const program = getDefaultProgram();
  dom.hardcodedProgramSheet.innerHTML = '';

  const toolbar = document.createElement('div');
  toolbar.className = 'program-toolbar';

  const title = document.createElement('div');
  title.className = 'program-sheet-title';
  title.textContent = program?.name || 'Program';
  toolbar.appendChild(title);

  const actions = document.createElement('div');
  actions.className = 'row';

  if (editMode && program) {
    const addDay = document.createElement('button');
    addDay.className = 'btn ghost';
    addDay.type = 'button';
    addDay.textContent = '+ Day';
    addDay.addEventListener('click', () => {
      program.days.push({ id: uid(), name: `Day ${program.days.length + 1}`, items: [] });
      persistProgramChange();
      renderPrograms();
    });
    actions.appendChild(addDay);
  }

  const editBtn = document.createElement('button');
  editBtn.className = editMode ? 'btn btn-primary' : 'btn ghost';
  editBtn.type = 'button';
  editBtn.textContent = editMode ? 'Done' : 'Edit';
  editBtn.addEventListener('click', () => {
    editMode = !editMode;
    renderPrograms();
  });
  actions.appendChild(editBtn);
  toolbar.appendChild(actions);
  dom.hardcodedProgramSheet.appendChild(toolbar);

  if (!program) {
    const empty = document.createElement('div');
    empty.className = 'muted';
    empty.textContent = 'No program available.';
    dom.hardcodedProgramSheet.appendChild(empty);
    return;
  }

  program.days.forEach((day, dayIndex) => {
    const section = document.createElement('section');
    section.className = 'program-day';

    const heading = document.createElement('div');
    heading.className = 'program-day-heading';

    if (editMode) {
      const dayName = document.createElement('input');
      dayName.className = 'program-day-name-input';
      dayName.type = 'text';
      dayName.value = day.name || '';
      dayName.placeholder = 'Day name';
      dayName.addEventListener('change', () => {
        day.name = dayName.value.trim() || `Day ${dayIndex + 1}`;
        persistProgramChange();
        renderPrograms();
      });
      heading.appendChild(dayName);

      const removeDay = document.createElement('button');
      removeDay.className = 'btn ghost danger';
      removeDay.type = 'button';
      removeDay.textContent = 'Remove Day';
      removeDay.addEventListener('click', () => {
        if (!confirm(`Remove ${day.name || 'this day'}?`)) return;
        program.days = program.days.filter(d => d.id !== day.id);
        if ((program.nextDayIndex || 0) >= program.days.length) {
          program.nextDayIndex = Math.max(0, program.days.length - 1);
        }
        persistProgramChange();
        renderPrograms();
      });
      heading.appendChild(removeDay);
    } else {
      const name = document.createElement('h3');
      name.textContent = day.name;
      heading.appendChild(name);
      const count = document.createElement('span');
      count.textContent = `${day.items.length} exercise${day.items.length !== 1 ? 's' : ''}`;
      heading.appendChild(count);
    }
    section.appendChild(heading);

    if (editMode) {
      const editor = document.createElement('div');
      editor.className = 'program-editor';
      day.items.forEach(item => editor.appendChild(renderEditableItem(program, day, item)));

      const addExercise = document.createElement('button');
      addExercise.className = 'btn ghost btn-block';
      addExercise.type = 'button';
      addExercise.textContent = '+ Exercise';
      addExercise.addEventListener('click', () => {
        const exerciseId = getOrCreateExerciseId('New Exercise');
        day.items.push({
          id: uid(),
          exerciseId,
          sets: 3,
          targetReps: [8, 8, 8]
        });
        persistProgramChange();
        renderPrograms();
      });
      editor.appendChild(addExercise);
      section.appendChild(editor);
    } else {
      const row = document.createElement('div');
      row.className = 'program-block';
      day.items.forEach(item => {
        const cell = document.createElement('div');
        cell.className = 'program-prescription';
        const exercise = document.createElement('strong');
        exercise.textContent = findExercise(item.exerciseId)?.name || 'Unknown Exercise';
        const prescription = document.createElement('span');
        prescription.textContent = `${item.sets} sets x ${formatTargetReps(item.targetReps)} reps`;
        cell.append(exercise, prescription);
        row.appendChild(cell);
      });
      section.appendChild(row);
    }

    dom.hardcodedProgramSheet.appendChild(section);
  });
}

function renderEditableItem(program, day, item) {
  const row = document.createElement('div');
  row.className = 'program-editor-row';

  const nameLabel = document.createElement('label');
  nameLabel.textContent = 'Exercise';
  const nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.value = findExercise(item.exerciseId)?.name || '';
  nameInput.placeholder = 'Exercise name';
  nameInput.addEventListener('change', () => {
    const exerciseId = getOrCreateExerciseId(nameInput.value);
    if (!exerciseId) return;
    item.exerciseId = exerciseId;
    persistProgramChange();
    renderPrograms();
  });
  nameLabel.appendChild(nameInput);

  const setsLabel = document.createElement('label');
  setsLabel.textContent = 'Sets';
  const setsInput = document.createElement('input');
  setsInput.type = 'number';
  setsInput.min = '1';
  setsInput.step = '1';
  setsInput.inputMode = 'numeric';
  setsInput.value = item.sets || 1;
  setsInput.addEventListener('change', () => {
    const nextSets = Math.max(1, parseInt(setsInput.value, 10) || 1);
    item.sets = nextSets;
    item.targetReps = ensureTargetRepsLength(item.targetReps, nextSets);
    persistProgramChange();
    renderPrograms();
  });
  setsLabel.appendChild(setsInput);

  const repsLabel = document.createElement('label');
  repsLabel.textContent = 'Target reps';
  const repsInput = document.createElement('input');
  repsInput.type = 'text';
  repsInput.inputMode = 'numeric';
  repsInput.value = Array.isArray(item.targetReps) ? item.targetReps.join(', ') : '';
  repsInput.placeholder = '8, 8, 10';
  repsInput.addEventListener('change', () => {
    item.targetReps = parseTargetReps(repsInput.value, Math.max(1, item.sets || 1));
    persistProgramChange();
    renderPrograms();
  });
  repsLabel.appendChild(repsInput);

  const remove = document.createElement('button');
  remove.className = 'btn ghost danger';
  remove.type = 'button';
  remove.textContent = 'Remove';
  remove.addEventListener('click', () => {
    day.items = day.items.filter(i => i.id !== item.id);
    persistProgramChange();
    renderPrograms();
  });

  row.append(nameLabel, setsLabel, repsLabel, remove);
  return row;
}

function getOrCreateExerciseId(name) {
  const clean = String(name || '').trim();
  if (!clean) return null;
  const key = normalizeExerciseName(clean);
  const existing = state.exercises.find(ex => normalizeExerciseName(ex.name) === key);
  if (existing) return existing.id;
  const exercise = { id: uid(), name: clean };
  state.exercises.push(exercise);
  return exercise.id;
}

function persistProgramChange() {
  saveState();
  renderSessionSetup();
}
