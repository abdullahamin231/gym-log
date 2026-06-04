import { dom } from './dom.js';
import { findDay, findExercise, getDefaultDayForProgram, getDefaultProgram } from './programStore.js';
import { formatTargetReps } from './utils.js';

export function renderSessionSetup() {
  const program = getDefaultProgram();
  dom.sessionDaySelect.innerHTML = '';

  if (!program || !program.days.length) {
    dom.sessionDaySelect.disabled = true;
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = program ? 'No days available' : 'No program';
    dom.sessionDaySelect.appendChild(opt);

    dom.sessionPreviewProgram.textContent = '';
    dom.sessionPreviewDay.textContent = 'No workout';
    dom.sessionPreviewExerciseCount.textContent = '';
    dom.sessionPreviewExercises.innerHTML = '<li class="muted" style="padding:14px 16px;list-style:none">Set up a program to get started.</li>';
    return;
  }

  dom.sessionDaySelect.disabled = false;
  program.days.forEach(d => {
    const opt = document.createElement('option');
    opt.value = d.id;
    opt.textContent = d.name;
    dom.sessionDaySelect.appendChild(opt);
  });

  const { day } = getDefaultDayForProgram(program);
  if (day) dom.sessionDaySelect.value = day.id;

  renderSessionPreview();
}

export function renderSessionPreview() {
  const program = getDefaultProgram();
  if (!program || !program.days.length) return;

  const dayId = dom.sessionDaySelect.value;
  if (!dayId) return;
  const day = findDay(program.id, dayId);
  if (!day) return;

  dom.sessionPreviewProgram.textContent = program.name;
  dom.sessionPreviewDay.textContent = day.name;
  dom.sessionPreviewExerciseCount.textContent = `${day.items.length} exercise${day.items.length !== 1 ? 's' : ''}`;

  dom.sessionPreviewExercises.innerHTML = '';
  day.items.forEach(item => {
    const ex = findExercise(item.exerciseId);
    if (!ex) return;
    const li = document.createElement('li');
    li.className = 'session-preview-item';
    const nameSpan = document.createElement('span');
    nameSpan.className = 'session-preview-ex-name';
    nameSpan.textContent = ex.name;
    const metaSpan = document.createElement('span');
    metaSpan.className = 'session-preview-ex-meta';
    metaSpan.textContent = `${item.sets} \u00d7 ${formatTargetReps(item.targetReps)}`;
    li.append(nameSpan, metaSpan);
    dom.sessionPreviewExercises.appendChild(li);
  });
}
