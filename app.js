// Data schema (normalized):
// Exercise { id, name }                        // library, reusable across programs/days
// Program  { id, name, nextDayIndex, days:[Day] }
// Day      { id, name, items:[DayItem] }
// DayItem  { id, exerciseId, sets, targetReps:number[] }
//
// WorkoutEntry (immutable history):
// { id, programId, dayId, programName, dayName, performedAt,
//   exercises:[{ name, sets:[{ target, reps, weight }] }] }
//
// Session state is kept in-memory only while active.

const storageKey = 'gym-log-state-v2';
const dbName = 'gym-log-db-v1';
const dbVersion = 1;

const state = loadState();
ensureUiDefaults();

let currentScreen = 'programs';
let selectedProgramId = null;
let selectedDayId = null; // for editing day in program detail

let session = null;
// session = {
//   programId, dayId, dayIndex,
//   exerciseIndex,
//   exercises:[{ name, sets, targetReps:number[] }],
//   log:[{ name, targetReps:number[], sets:[{reps:number|null, weight:number|null}] }]
// }

// ---------- DOM ----------
const headerSubtitle = document.getElementById('headerSubtitle');
const installBtn = document.getElementById('installBtn');

const screens = {
  programs: document.getElementById('screen-programs'),
  programDetail: document.getElementById('screen-program-detail'),
  exercises: document.getElementById('screen-exercises'),
  session: document.getElementById('screen-session'),
  history: document.getElementById('screen-history')
};

const tabButtons = Array.from(document.querySelectorAll('.tabbar .tab'));

const programForm = document.getElementById('programForm');
const programList = document.getElementById('programList');

const backToProgramsBtn = document.getElementById('backToProgramsBtn');
const programDetailTitle = document.getElementById('programDetailTitle');
const renameProgramBtn = document.getElementById('renameProgramBtn');
const deleteProgramBtn = document.getElementById('deleteProgramBtn');

const dayForm = document.getElementById('dayForm');
const dayList = document.getElementById('dayList');
const dayEditor = document.getElementById('dayEditor');
const dayEditorTitle = document.getElementById('dayEditorTitle');
const renameDayBtn = document.getElementById('renameDayBtn');
const deleteDayBtn = document.getElementById('deleteDayBtn');
const dayItemForm = document.getElementById('dayItemForm');
const dayItemExerciseSelect = document.getElementById('dayItemExerciseSelect');
const dayItemList = document.getElementById('dayItemList');

const exerciseForm = document.getElementById('exerciseForm');
const exerciseList = document.getElementById('exerciseList');

const sessionSetupForm = document.getElementById('sessionSetupForm');
const sessionProgramSelect = document.getElementById('sessionProgramSelect');
const pickDayToggle = document.getElementById('pickDayToggle');
const sessionDayLabel = document.getElementById('sessionDayLabel');
const sessionDaySelect = document.getElementById('sessionDaySelect');
const nextDayHint = document.getElementById('nextDayHint');
const sessionSetupCard = document.getElementById('sessionSetupCard');
const sessionRunCard = document.getElementById('sessionRunCard');

const completeSessionBtn = document.getElementById('completeSessionBtn');
const sessionStatus = document.getElementById('sessionStatus');
const sessionControls = document.getElementById('sessionControls');
const currentExerciseEl = document.getElementById('currentExercise');
const setProgressEl = document.getElementById('setProgress');
const prevExerciseBtn = document.getElementById('prevExerciseBtn');
const nextExerciseBtn = document.getElementById('nextExerciseBtn');
const setsGrid = document.getElementById('setsGrid');
const addSetBtn = document.getElementById('addSetBtn');
const removeSetBtn = document.getElementById('removeSetBtn');

const historyList = document.getElementById('historyList');
const clearHistoryBtn = document.getElementById('clearHistoryBtn');
const historyExerciseSelect = document.getElementById('historyExerciseSelect');
const historyChart = document.getElementById('historyChart');
const historyChartEmpty = document.getElementById('historyChartEmpty');
const exportBtn = document.getElementById('exportBtn');
const importBtn = document.getElementById('importBtn');
const importFile = document.getElementById('importFile');

let deferredPrompt = null;

function normalizeExerciseName(name) {
  return String(name || '').trim().toLowerCase();
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

function ensureTargetRepsLength(targetReps, sets) {
  const next = Array.isArray(targetReps) ? targetReps.slice(0, sets) : [];
  const last = next.length ? next[next.length - 1] : 0;
  while (next.length < sets) next.push(last);
  return next;
}

// ---------- IndexedDB (for app-bundled docs / future growth) ----------
function openDb() {
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

async function seedProgramMdIntoIndexedDb() {
  try {
    const db = await openDb();
    const existing = await new Promise((resolve, reject) => {
      const tx = db.transaction('files', 'readonly');
      const req = tx.objectStore('files').get('program.md');
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    if (existing) return;

    const res = await fetch('program.md');
    if (!res.ok) return;
    const content = await res.text();

    await new Promise((resolve, reject) => {
      const tx = db.transaction('files', 'readwrite');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.objectStore('files').put({
        path: 'program.md',
        content,
        createdAt: new Date().toISOString()
      });
    });
  } catch (e) {
    // Best-effort seed. App must still work without IndexedDB.
    console.warn('IndexedDB seed skipped:', e);
  }
}

async function getBundledFileContent(path) {
  // Prefer IndexedDB (offline), fall back to network (first load).
  try {
    const db = await openDb();
    const existing = await new Promise((resolve, reject) => {
      const tx = db.transaction('files', 'readonly');
      const req = tx.objectStore('files').get(path);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    if (existing?.content) return String(existing.content);
  } catch {
    // fall through
  }

  try {
    const res = await fetch(path);
    if (!res.ok) return '';
    return await res.text();
  } catch {
    return '';
  }
}

// ---------- Storage ----------
function loadState() {
  try {
    const raw = localStorage.getItem(storageKey) || localStorage.getItem('gym-log-state-v1');
    if (!raw) return { programs: [], exercises: [], history: [], ui: {} };
    const parsed = JSON.parse(raw);
    return migrateIfNeeded(parsed);
  } catch (e) {
    console.error('Failed to parse storage', e);
    return { programs: [], exercises: [], history: [], ui: {} };
  }
}

function saveState() {
  localStorage.setItem(storageKey, JSON.stringify(state));
}

function applyImportedState(next) {
  const migrated = migrateIfNeeded(next);
  state.programs = Array.isArray(migrated.programs) ? migrated.programs : [];
  state.exercises = Array.isArray(migrated.exercises) ? migrated.exercises : [];
  state.history = Array.isArray(migrated.history) ? migrated.history : [];
  state.ui = typeof migrated.ui === 'object' && migrated.ui ? migrated.ui : {};
  ensureUiDefaults();
  saveState();
}

function ensureUiDefaults() {
  state.ui ||= {};
  if (typeof state.ui.defaultProgramId !== 'string') state.ui.defaultProgramId = '';
}

function migrateIfNeeded(parsed) {
  // v2 already has `exercises` and uses day.items
  if (Array.isArray(parsed.exercises) && Array.isArray(parsed.programs)) return { ...parsed, ui: parsed.ui || {} };

  // v1 schema: programs[].days[].exercises[]
  const old = parsed;
  const next = { programs: [], exercises: [], history: Array.isArray(old.history) ? old.history : [], ui: {} };
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

// ---------- Helpers ----------
function uid() {
  if (crypto?.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function findProgram(id) {
  return state.programs.find(p => p.id === id) || null;
}

function findDay(programId, dayId) {
  const program = findProgram(programId);
  return program?.days.find(d => d.id === dayId) || null;
}

function findExercise(exerciseId) {
  return state.exercises.find(e => e.id === exerciseId) || null;
}

function parseTargetReps(value, sets) {
  const numbers = String(value || '')
    .split(',')
    .map(v => parseInt(v.trim(), 10))
    .filter(n => !Number.isNaN(n));
  if (!numbers.length) return Array(sets).fill(0);
  const target = [];
  for (let i = 0; i < sets; i++) {
    target[i] = numbers[i] ?? numbers[numbers.length - 1];
  }
  return target;
}

function parseExampleProgramFromMarkdown(markdown) {
  const lines = String(markdown || '').split(/\r?\n/);
  const days = [];
  let inExample = false;
  let currentDay = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    if (line.startsWith('## ')) {
      const heading = line.slice(3).trim();
      if (/^example program/i.test(heading)) {
        inExample = true;
        continue;
      }
      if (inExample) break;
    }

    if (!inExample) continue;

    if (line.startsWith('### ')) {
      const heading = line.slice(4).trim();
      const name =
        (heading.includes('—') ? heading.split('—').pop() : heading.includes('–') ? heading.split('–').pop() : heading)
          .trim() || heading;
      currentDay = { name, items: [] };
      days.push(currentDay);
      continue;
    }

    if (!currentDay) continue;
    if (!line.startsWith('- ')) continue;

    const bullet = line.slice(2).trim();
    const parts = bullet.includes('—')
      ? bullet.split('—')
      : bullet.includes('–')
        ? bullet.split('–')
        : bullet.includes(' - ')
          ? bullet.split(' - ')
          : [bullet];

    if (parts.length < 2) continue;
    const exerciseName = parts[0].trim();
    const rhs = parts.slice(1).join('-').trim();
    const match = rhs.match(/(\d+)\s*x\s*([0-9,\s]+)/i);
    if (!exerciseName || !match) continue;

    const sets = parseInt(match[1], 10);
    if (Number.isNaN(sets) || sets < 1) continue;

    const repsNumbers = (match[2].match(/\d+/g) || []).map(n => parseInt(n, 10)).filter(n => !Number.isNaN(n));
    const repsCsv = repsNumbers.length ? repsNumbers.join(',') : '';
    currentDay.items.push({ exerciseName, sets, repsCsv });
  }

  return { programName: 'Example Program', days };
}

async function importExampleProgramFromBundledMarkdown() {
  return importExampleProgramFromBundledMarkdownImpl({ silent: false });
}

async function importExampleProgramFromBundledMarkdownImpl(options) {
  const { silent } = options || {};
  const md = await getBundledFileContent('program.md');
  if (!md) {
    if (!silent) {
      alert('Could not load program.md. Make sure it exists in your GitHub Pages build and reload.');
    }
    return;
  }

  const parsed = parseExampleProgramFromMarkdown(md);
  if (!parsed.days.length) {
    if (!silent) alert('No example days found in program.md.');
    return;
  }

  const exerciseIdByName = new Map(state.exercises.map(ex => [ex.name.trim().toLowerCase(), ex.id]));
  const getOrCreateExerciseId = (name) => {
    const key = String(name || '').trim().toLowerCase();
    if (!key) return null;
    const existingId = exerciseIdByName.get(key);
    if (existingId) return existingId;
    const ex = { id: uid(), name: String(name).trim() };
    state.exercises.push(ex);
    exerciseIdByName.set(key, ex.id);
    return ex.id;
  };

  const program = { id: uid(), name: parsed.programName, nextDayIndex: 0, days: [] };
  parsed.days.forEach(d => {
    const day = { id: uid(), name: d.name, items: [] };
    d.items.forEach(item => {
      const exerciseId = getOrCreateExerciseId(item.exerciseName);
      if (!exerciseId) return;
      day.items.push({
        id: uid(),
        exerciseId,
        sets: item.sets,
        targetReps: parseTargetReps(item.repsCsv, item.sets)
      });
    });
    program.days.push(day);
  });

  state.programs.push(program);
  state.ui.defaultProgramId = program.id;
  saveState();

  selectedProgramId = program.id;
  selectedDayId = program.days[0]?.id || null;
  showScreen('programDetail');
  render();
}

async function autoImportExampleProgramIfEmpty() {
  if (state.programs.length) return;
  state.ui ||= {};
  if (state.ui.exampleProgramImported) return;

  try {
    await importExampleProgramFromBundledMarkdownImpl({ silent: true });
    if (!state.programs.length) return;
    state.ui.exampleProgramImported = true;
    saveState();
  } catch (e) {
    console.warn('Auto-import example program skipped:', e);
  }
}

function getDefaultProgramId() {
  if (state.ui.defaultProgramId && findProgram(state.ui.defaultProgramId)) return state.ui.defaultProgramId;
  return state.programs[0]?.id || '';
}

function getDefaultDayForProgram(program) {
  if (!program?.days.length) return { day: null, index: -1 };
  const idx = Math.max(0, Math.min(program.nextDayIndex || 0, program.days.length - 1));
  return { day: program.days[idx], index: idx };
}

// ---------- Navigation ----------
function setHeaderSubtitle(text) {
  headerSubtitle.textContent = text;
}

function showScreen(screenName) {
  if (session && screenName !== 'session') return;
  currentScreen = screenName;
  Object.entries(screens).forEach(([name, el]) => {
    el.classList.toggle('hidden', name !== screenName);
  });

  const primary = ['programs', 'exercises', 'session', 'history'];
  const activeTab = primary.includes(screenName) ? screenName : 'programs';
  tabButtons.forEach(btn => btn.classList.toggle('active', btn.dataset.nav === activeTab));

  if (screenName === 'programs') setHeaderSubtitle('Programs');
  if (screenName === 'programDetail') setHeaderSubtitle('Programs • Days');
  if (screenName === 'exercises') setHeaderSubtitle('Exercises');
  if (screenName === 'session') setHeaderSubtitle('Session');
  if (screenName === 'history') setHeaderSubtitle('History');
}

tabButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    if (session) return;
    const target = btn.dataset.nav;
    showScreen(target);
    render();
  });
});

// ---------- Rendering ----------
function renderPrograms() {
  programList.innerHTML = '';
  if (!state.programs.length) {
    const li = document.createElement('li');
    const left = document.createElement('div');
    left.className = 'muted';
    left.textContent = 'Create your first program, or load the built-in example.';

    const actions = document.createElement('div');
    actions.className = 'row';
    const loadExample = document.createElement('button');
    loadExample.className = 'btn ghost';
    loadExample.type = 'button';
    loadExample.textContent = 'Load Example';
    loadExample.onclick = async () => {
      try {
        await importExampleProgramFromBundledMarkdown();
      } catch (e) {
        console.error('Failed to load example program', e);
        alert('Failed to load the example program.');
      }
    };
    actions.append(loadExample);

    li.append(left, actions);
    programList.appendChild(li);
    return;
  }

  state.programs.forEach(program => {
    const li = document.createElement('li');
    const left = document.createElement('div');
    left.className = 'row';
    const name = document.createElement('strong');
    name.textContent = program.name;
    const count = document.createElement('span');
    count.className = 'tag';
    count.textContent = `${program.days.length} days`;
    left.append(name, count);

    const actions = document.createElement('div');
    actions.className = 'row';
    const open = document.createElement('button');
    open.className = 'btn ghost';
    open.type = 'button';
    open.textContent = 'Open';
    open.onclick = () => {
      selectedProgramId = program.id;
      selectedDayId = null;
      showScreen('programDetail');
      render();
    };
    actions.append(open);
    li.append(left, actions);
    programList.appendChild(li);
  });
}

function renderProgramDetail() {
  const program = findProgram(selectedProgramId);
  if (!program) {
    showScreen('programs');
    return;
  }

  programDetailTitle.textContent = program.name;

  dayList.innerHTML = '';
  if (!program.days.length) {
    dayList.innerHTML = '<li class="muted">Add a day, then build it using your exercise library.</li>';
  } else {
    program.days.forEach(day => {
      const li = document.createElement('li');
      const left = document.createElement('div');
      left.className = 'row';
      const name = document.createElement('strong');
      name.textContent = day.name;
      const count = document.createElement('span');
      count.className = 'tag';
      count.textContent = `${day.items.length} ex`;
      left.append(name, count);

      const actions = document.createElement('div');
      actions.className = 'row';
      const open = document.createElement('button');
      open.className = 'btn ghost';
      open.type = 'button';
      open.textContent = selectedDayId === day.id ? 'Editing' : 'Edit';
      open.onclick = () => {
        selectedDayId = day.id;
        renderProgramDetail();
      };
      actions.append(open);
      li.append(left, actions);
      dayList.appendChild(li);
    });
  }

  renderDayEditor();
}

function renderDayEditor() {
  const program = findProgram(selectedProgramId);
  const day = program ? findDay(program.id, selectedDayId) : null;
  dayEditor.classList.toggle('hidden', !day);
  if (!day) return;

  dayEditorTitle.textContent = day.name;

  // Exercise select
  dayItemExerciseSelect.innerHTML = '';
  const exercises = state.exercises.slice().sort((a, b) => a.name.localeCompare(b.name));
  if (!exercises.length) {
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = 'No exercises yet (add in Exercises tab)';
    dayItemExerciseSelect.appendChild(opt);
    dayItemExerciseSelect.disabled = true;
  } else {
    dayItemExerciseSelect.disabled = false;
    exercises.forEach(ex => {
      const opt = document.createElement('option');
      opt.value = ex.id;
      opt.textContent = ex.name;
      dayItemExerciseSelect.appendChild(opt);
    });
  }

  // Day items list
  dayItemList.innerHTML = '';
  if (!day.items.length) {
    dayItemList.innerHTML = '<li class="muted">Add exercises to this day.</li>';
    return;
  }

  day.items.forEach((item, idx) => {
    const li = document.createElement('li');

    const left = document.createElement('div');
    left.className = 'row';
    const name = document.createElement('strong');
    name.textContent = findExercise(item.exerciseId)?.name || 'Unknown Exercise';
    const meta = document.createElement('span');
    meta.className = 'muted';
    meta.textContent = `${item.sets} sets • target ${item.targetReps.join('/')}`;
    left.append(name, meta);

    const actions = document.createElement('div');
    actions.className = 'row';

    const up = document.createElement('button');
    up.className = 'btn ghost';
    up.type = 'button';
    up.textContent = '↑';
    up.disabled = idx === 0;
    up.onclick = () => {
      [day.items[idx - 1], day.items[idx]] = [day.items[idx], day.items[idx - 1]];
      saveState();
      renderDayEditor();
    };

    const down = document.createElement('button');
    down.className = 'btn ghost';
    down.type = 'button';
    down.textContent = '↓';
    down.disabled = idx === day.items.length - 1;
    down.onclick = () => {
      [day.items[idx + 1], day.items[idx]] = [day.items[idx], day.items[idx + 1]];
      saveState();
      renderDayEditor();
    };

    const edit = document.createElement('button');
    edit.className = 'btn ghost';
    edit.type = 'button';
    edit.textContent = 'Edit';
    edit.onclick = () => {
      const setsNext = parseInt(prompt('Sets', item.sets) ?? item.sets, 10);
      const targetNext = prompt('Target reps (e.g. 8 or 8,8,6)', item.targetReps.join(',')) ?? item.targetReps.join(',');
      item.sets = Number.isNaN(setsNext) || setsNext < 1 ? item.sets : setsNext;
      item.targetReps = parseTargetReps(targetNext, item.sets);
      saveState();
      renderDayEditor();
    };

    const del = document.createElement('button');
    del.className = 'btn ghost danger';
    del.type = 'button';
    del.textContent = 'Remove';
    del.onclick = () => {
      day.items = day.items.filter(i => i.id !== item.id);
      saveState();
      renderDayEditor();
    };

    actions.append(up, down, edit, del);
    li.append(left, actions);
    dayItemList.appendChild(li);
  });
}

function renderExercises() {
  exerciseList.innerHTML = '';
  if (!state.exercises.length) {
    exerciseList.innerHTML = '<li class="muted">Add exercises you use often. Then add them to days.</li>';
    return;
  }

  state.exercises
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
    .forEach(ex => {
      const li = document.createElement('li');
      const name = document.createElement('strong');
      name.textContent = ex.name;

      const actions = document.createElement('div');
      actions.className = 'row';

      const rename = document.createElement('button');
      rename.className = 'btn ghost';
      rename.type = 'button';
      rename.textContent = 'Rename';
      rename.onclick = () => {
        const next = prompt('Exercise name', ex.name);
        if (!next) return;
        ex.name = next.trim();
        saveState();
        render();
      };

      const del = document.createElement('button');
      del.className = 'btn ghost danger';
      del.type = 'button';
      del.textContent = 'Delete';
      del.onclick = () => deleteExercise(ex.id);

      actions.append(rename, del);
      li.append(name, actions);
      exerciseList.appendChild(li);
    });
}

function renderSessionSetup() {
  sessionProgramSelect.innerHTML = '';
  const programs = state.programs.slice().sort((a, b) => a.name.localeCompare(b.name));
  if (!programs.length) {
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = 'No programs (create one first)';
    sessionProgramSelect.appendChild(opt);
    sessionProgramSelect.disabled = true;
    return;
  }
  sessionProgramSelect.disabled = false;
  programs.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = p.name;
    sessionProgramSelect.appendChild(opt);
  });

  const defaultId = getDefaultProgramId();
  sessionProgramSelect.value = defaultId || programs[0].id;
  state.ui.defaultProgramId = sessionProgramSelect.value;
  saveState();

  renderSessionDays();
}

function renderSessionDays() {
  const program = findProgram(sessionProgramSelect.value);
  sessionDaySelect.innerHTML = '';
  if (!program?.days.length) {
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = 'No days in this program';
    sessionDaySelect.appendChild(opt);
    sessionDaySelect.disabled = true;
    nextDayHint.textContent = 'Add days to this program to start sessions.';
    return;
  }
  sessionDaySelect.disabled = false;
  program.days.forEach(d => {
    const opt = document.createElement('option');
    opt.value = d.id;
    opt.textContent = d.name;
    sessionDaySelect.appendChild(opt);
  });

  const { day } = getDefaultDayForProgram(program);
  sessionDaySelect.value = day?.id || program.days[0].id;
  if (pickDayToggle.checked) {
    nextDayHint.textContent = '';
  } else {
    const name = day?.name || program.days[0].name;
    nextDayHint.textContent = `Next up: ${name} (auto-rotates each completion)`;
  }
}

function renderHistory() {
  historyList.innerHTML = '';
  const template = document.getElementById('historyTemplate');
  if (!state.history.length) {
    historyList.innerHTML = '<li class="muted">No sessions logged yet.</li>';
    renderHistoryChart();
    return;
  }

  state.history
    .slice()
    .sort((a, b) => b.performedAt.localeCompare(a.performedAt))
    .forEach(entry => {
      const node = template.content.firstElementChild.cloneNode(true);
      node.dataset.historyId = entry.id;
      node.querySelector('.history-meta').textContent =
        `${entry.programName} • ${entry.dayName} • ${new Date(entry.performedAt).toLocaleString()}`;
      const deleteBtn = node.querySelector('[data-action="delete-history"]');
      if (deleteBtn) {
        deleteBtn.addEventListener('click', () => {
          if (!confirm('Remove this session from history?')) return;
          state.history = state.history.filter(h => h.id !== entry.id);
          saveState();
          renderHistory();
        });
      }
      const exContainer = node.querySelector('.history-exercises');
      entry.exercises.forEach(ex => {
        const line = document.createElement('div');
        const sets = ex.sets
          .map((s, i) => `${i + 1}:${s.reps}${s.weight ? `@${s.weight}` : ''}${s.target ? `/${s.target}` : ''}`)
          .join('  ');
        line.textContent = `${ex.name} — ${sets}`;
        exContainer.appendChild(line);
      });
      historyList.appendChild(node);
    });

  renderHistoryChart();
}

function renderHistoryChart() {
  if (!historyExerciseSelect || !historyChart || !historyChartEmpty) return;

  const previousSelection = historyExerciseSelect.value;
  const names = new Set();
  state.history.forEach(entry => {
    (entry.exercises || []).forEach(ex => {
      if (ex?.name) names.add(ex.name);
    });
  });
  const options = Array.from(names).sort((a, b) => a.localeCompare(b));

  historyExerciseSelect.innerHTML = '';
  if (!options.length) {
    historyExerciseSelect.disabled = true;
    historyChartEmpty.textContent = 'Log sessions with weights to see progress here.';
    drawLineChart(historyChart, [], { yLabel: 'Weight' });
    return;
  }
  historyExerciseSelect.disabled = false;
  options.forEach(name => {
    const opt = document.createElement('option');
    opt.value = name;
    opt.textContent = name;
    historyExerciseSelect.appendChild(opt);
  });

  const nextSelection = options.includes(previousSelection) ? previousSelection : options[0];
  historyExerciseSelect.value = nextSelection;
  const series = buildExerciseWeightSeries(nextSelection);
  if (!series.length) {
    historyChartEmpty.textContent = 'No weight entries found for this exercise yet.';
  } else {
    const last = series[series.length - 1].y;
    const first = series[0].y;
    const delta = (last - first).toFixed(1).replace(/\.0$/, '');
    historyChartEmpty.textContent = `First: ${first} • Latest: ${last} • Δ ${delta}`;
  }
  drawLineChart(historyChart, series, { yLabel: 'Weight' });
}

function buildExerciseWeightSeries(exerciseName) {
  const points = [];
  state.history.forEach(entry => {
    const performedAt = entry.performedAt;
    const match = (entry.exercises || []).find(ex => ex?.name === exerciseName);
    if (!match) return;
    const weights = (match.sets || [])
      .map(s => (s && typeof s.weight === 'number' && !Number.isNaN(s.weight) ? s.weight : null))
      .filter(v => v != null);
    if (!weights.length) return;
    const max = Math.max(...weights);
    points.push({ x: performedAt, y: max });
  });
  points.sort((a, b) => String(a.x).localeCompare(String(b.x)));
  return points;
}

function drawLineChart(canvas, points, { yLabel } = {}) {
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const cssW = canvas.clientWidth || 600;
  const cssH = canvas.clientHeight || 220;
  const w = Math.max(1, Math.floor(cssW * dpr));
  const h = Math.max(1, Math.floor(cssH * dpr));
  if (canvas.width !== w) canvas.width = w;
  if (canvas.height !== h) canvas.height = h;

  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#0f111a';
  ctx.fillRect(0, 0, w, h);

  const padL = 46 * dpr;
  const padR = 12 * dpr;
  const padT = 14 * dpr;
  const padB = 26 * dpr;
  const plotW = w - padL - padR;
  const plotH = h - padT - padB;

  ctx.strokeStyle = 'rgba(31,41,55,0.9)';
  ctx.lineWidth = 1 * dpr;
  ctx.beginPath();
  ctx.moveTo(padL, padT);
  ctx.lineTo(padL, padT + plotH);
  ctx.lineTo(padL + plotW, padT + plotH);
  ctx.stroke();

  ctx.fillStyle = 'rgba(156,163,175,0.9)';
  ctx.font = `${12 * dpr}px -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial`;
  if (yLabel) ctx.fillText(yLabel, 10 * dpr, 14 * dpr);

  if (!points.length) {
    ctx.fillStyle = 'rgba(156,163,175,0.7)';
    ctx.fillText('No data', padL + 10 * dpr, padT + plotH / 2);
    return;
  }

  const ys = points.map(p => p.y);
  let minY = Math.min(...ys);
  let maxY = Math.max(...ys);
  if (minY === maxY) {
    minY -= 1;
    maxY += 1;
  }
  const yPad = (maxY - minY) * 0.12;
  minY -= yPad;
  maxY += yPad;

  const xToPx = (i) => padL + (points.length === 1 ? plotW / 2 : (i / (points.length - 1)) * plotW);
  const yToPx = (y) => padT + (1 - (y - minY) / (maxY - minY)) * plotH;

  // Y ticks
  const ticks = 4;
  ctx.fillStyle = 'rgba(156,163,175,0.85)';
  for (let i = 0; i <= ticks; i++) {
    const t = i / ticks;
    const yVal = minY + (1 - t) * (maxY - minY);
    const yPx = padT + t * plotH;
    ctx.strokeStyle = 'rgba(31,41,55,0.55)';
    ctx.beginPath();
    ctx.moveTo(padL, yPx);
    ctx.lineTo(padL + plotW, yPx);
    ctx.stroke();
    ctx.fillText(
      `${Math.round(yVal * 10) / 10}`,
      6 * dpr,
      yPx + 4 * dpr
    );
  }

  // Line
  ctx.strokeStyle = 'rgba(102,252,241,0.9)';
  ctx.lineWidth = 2 * dpr;
  ctx.beginPath();
  points.forEach((p, i) => {
    const x = xToPx(i);
    const y = yToPx(p.y);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();

  // Points
  ctx.fillStyle = 'rgba(102,252,241,1)';
  points.forEach((p, i) => {
    const x = xToPx(i);
    const y = yToPx(p.y);
    ctx.beginPath();
    ctx.arc(x, y, 3.5 * dpr, 0, Math.PI * 2);
    ctx.fill();
  });

  // X labels (first/last)
  const firstDate = new Date(points[0].x);
  const lastDate = new Date(points[points.length - 1].x);
  ctx.fillStyle = 'rgba(156,163,175,0.85)';
  ctx.fillText(firstDate.toLocaleDateString(), padL, padT + plotH + 18 * dpr);
  const lastLabel = lastDate.toLocaleDateString();
  const metrics = ctx.measureText(lastLabel);
  ctx.fillText(lastLabel, padL + plotW - metrics.width, padT + plotH + 18 * dpr);
}

historyExerciseSelect?.addEventListener('change', () => {
  if (currentScreen !== 'history') return;
  renderHistoryChart();
});

// ---------- Backup / Restore ----------
async function exportAllData() {
  const payload = {
    format: 'gym-log-backup-v1',
    exportedAt: new Date().toISOString(),
    state: {
      programs: state.programs,
      exercises: state.exercises,
      history: state.history,
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

async function importAllData(file) {
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

  selectedProgramId = null;
  selectedDayId = null;
  session = null;
  document.body.classList.remove('session-active');
  showScreen('history');
  render();
}

exportBtn?.addEventListener('click', () => exportAllData());
importBtn?.addEventListener('click', () => importFile?.click());
importFile?.addEventListener('change', async () => {
  const file = importFile.files?.[0];
  importFile.value = '';
  if (!file) return;
  await importAllData(file);
});

function render() {
  if (currentScreen === 'programs') renderPrograms();
  if (currentScreen === 'programDetail') renderProgramDetail();
  if (currentScreen === 'exercises') renderExercises();
  if (currentScreen === 'session') renderSessionSetup();
  if (currentScreen === 'history') renderHistory();
  updateSessionUI();
}

// ---------- Programs ----------
programForm.addEventListener('submit', e => {
  e.preventDefault();
  const name = programForm.programName.value.trim();
  if (!name) return;
  const program = { id: uid(), name, nextDayIndex: 0, days: [] };
  state.programs.push(program);
  state.ui.defaultProgramId = program.id;
  programForm.reset();
  saveState();
  render();
});

backToProgramsBtn.addEventListener('click', () => {
  selectedProgramId = null;
  selectedDayId = null;
  showScreen('programs');
  render();
});

renameProgramBtn.addEventListener('click', () => {
  const program = findProgram(selectedProgramId);
  if (!program) return;
  const next = prompt('Program name', program.name);
  if (!next) return;
  program.name = next.trim();
  saveState();
  renderProgramDetail();
});

deleteProgramBtn.addEventListener('click', () => {
  const program = findProgram(selectedProgramId);
  if (!program) return;
  if (!confirm('Delete this program? History entries remain unchanged.')) return;
  state.programs = state.programs.filter(p => p.id !== program.id);
  if (state.ui.defaultProgramId === program.id) state.ui.defaultProgramId = getDefaultProgramId();
  selectedProgramId = null;
  selectedDayId = null;
  saveState();
  showScreen('programs');
  render();
});

// ---------- Days + Day builder ----------
dayForm.addEventListener('submit', e => {
  e.preventDefault();
  const program = findProgram(selectedProgramId);
  if (!program) return;
  const name = dayForm.dayName.value.trim();
  if (!name) return;
  const day = { id: uid(), name, items: [] };
  program.days.push(day);
  selectedDayId = day.id;
  dayForm.reset();
  saveState();
  renderProgramDetail();
});

renameDayBtn.addEventListener('click', () => {
  const program = findProgram(selectedProgramId);
  const day = program ? findDay(program.id, selectedDayId) : null;
  if (!day) return;
  const next = prompt('Day name', day.name);
  if (!next) return;
  day.name = next.trim();
  saveState();
  renderProgramDetail();
});

deleteDayBtn.addEventListener('click', () => {
  const program = findProgram(selectedProgramId);
  const day = program ? findDay(program.id, selectedDayId) : null;
  if (!program || !day) return;
  if (!confirm('Delete this day?')) return;
  const idx = program.days.findIndex(d => d.id === day.id);
  program.days = program.days.filter(d => d.id !== day.id);
  if (program.nextDayIndex >= program.days.length) program.nextDayIndex = 0;
  if (idx <= program.nextDayIndex && program.nextDayIndex > 0) program.nextDayIndex -= 1;
  selectedDayId = null;
  saveState();
  renderProgramDetail();
});

dayItemForm.addEventListener('submit', e => {
  e.preventDefault();
  const program = findProgram(selectedProgramId);
  const day = program ? findDay(program.id, selectedDayId) : null;
  if (!day) return;
  if (!state.exercises.length) return alert('Add exercises first (Exercises tab).');
  const exerciseId = dayItemExerciseSelect.value;
  const sets = parseInt(dayItemForm.sets.value, 10);
  const target = dayItemForm.target.value;
  if (!exerciseId || Number.isNaN(sets) || sets < 1) return;
  day.items.push({
    id: uid(),
    exerciseId,
    sets,
    targetReps: parseTargetReps(target, sets)
  });
  dayItemForm.reset();
  dayItemForm.sets.value = 3;
  saveState();
  renderDayEditor();
});

// ---------- Exercise library ----------
exerciseForm.addEventListener('submit', e => {
  e.preventDefault();
  const name = exerciseForm.exerciseName.value.trim();
  if (!name) return;
  state.exercises.push({ id: uid(), name });
  exerciseForm.reset();
  saveState();
  render();
});

function deleteExercise(exerciseId) {
  const ex = findExercise(exerciseId);
  if (!ex) return;
  const used = state.programs.some(p => p.days.some(d => d.items.some(i => i.exerciseId === exerciseId)));
  const msg = used
    ? 'Delete this exercise? It will also be removed from any days that use it.'
    : 'Delete this exercise?';
  if (!confirm(msg)) return;
  state.exercises = state.exercises.filter(e => e.id !== exerciseId);
  state.programs.forEach(p => p.days.forEach(d => (d.items = d.items.filter(i => i.exerciseId !== exerciseId))));
  saveState();
  render();
}

// ---------- Session Flow ----------
pickDayToggle.addEventListener('change', () => {
  sessionDayLabel.classList.toggle('hidden', !pickDayToggle.checked);
  renderSessionDays();
});

sessionProgramSelect.addEventListener('change', () => {
  state.ui.defaultProgramId = sessionProgramSelect.value;
  saveState();
  renderSessionDays();
});

sessionSetupForm.addEventListener('submit', e => {
  e.preventDefault();
  if (session) return alert('A session is already active.');
  const program = findProgram(sessionProgramSelect.value);
  if (!program) return alert('Select a program.');
  if (!program.days.length) return alert('Add days to this program first.');

  let day = null;
  let dayIndex = -1;
  if (pickDayToggle.checked) {
    day = findDay(program.id, sessionDaySelect.value);
    dayIndex = program.days.findIndex(d => d.id === day?.id);
  } else {
    const def = getDefaultDayForProgram(program);
    day = def.day;
    dayIndex = def.index;
  }
  if (!day) return alert('Select a day.');
  if (!day.items.length) return alert('This day has no exercises.');

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
      sets: Array.from({ length: ex.sets }, () => ({ reps: null, weight: null }))
    }))
  };

  showScreen('session');
  updateSessionUI();
});

completeSessionBtn.addEventListener('click', () => completeSession(false));

function cycleExercise(delta) {
  if (!session?.exercises?.length) return;
  const len = session.exercises.length;
  session.exerciseIndex = (session.exerciseIndex + delta + len) % len;
  updateSessionUI();
}

prevExerciseBtn?.addEventListener('click', () => cycleExercise(-1));
nextExerciseBtn?.addEventListener('click', () => cycleExercise(1));

function changeCurrentExerciseSets(delta) {
  if (!session) return;
  const current = session.exercises[session.exerciseIndex];
  const logEntry = session.log[session.exerciseIndex];
  if (!current || !logEntry) return;

  const nextSets = Math.max(1, (current.sets || 1) + delta);
  if (nextSets === current.sets) return;

  current.sets = nextSets;
  current.targetReps = ensureTargetRepsLength(current.targetReps, nextSets);
  logEntry.targetReps = current.targetReps;

  if (!Array.isArray(logEntry.sets)) logEntry.sets = [];
  while (logEntry.sets.length < nextSets) logEntry.sets.push({ reps: null, weight: null });
  if (logEntry.sets.length > nextSets) logEntry.sets = logEntry.sets.slice(0, nextSets);

  updateSessionUI();
}

addSetBtn?.addEventListener('click', () => changeCurrentExerciseSets(1));
removeSetBtn?.addEventListener('click', () => changeCurrentExerciseSets(-1));

window.addEventListener('keydown', e => {
  if (!session) return;
  if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
  const active = document.activeElement?.tagName || '';
  if (active === 'INPUT' || active === 'TEXTAREA' || active === 'SELECT') return;
  e.preventDefault();
  cycleExercise(e.key === 'ArrowLeft' ? -1 : 1);
});

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

function updateSessionUI() {
  if (!session) {
    document.body.classList.remove('session-active');
    sessionSetupCard?.classList.remove('hidden');
    sessionRunCard?.classList.remove('hidden');
    sessionControls.classList.add('hidden');
    sessionStatus.textContent = 'No active session. Start one above.';
    return;
  }

  document.body.classList.add('session-active');
  sessionControls.classList.remove('hidden');
  const current = session.exercises[session.exerciseIndex];
  currentExerciseEl.textContent = current.name;
  setProgressEl.textContent = `Exercise ${session.exerciseIndex + 1}/${session.exercises.length} • ${current.sets} sets`;
  if (removeSetBtn) removeSetBtn.disabled = (current.sets || 1) <= 1;

  const program = findProgram(session.programId);
  const day = findDay(session.programId, session.dayId);
  sessionStatus.textContent = `${program?.name || 'Program'} • ${day?.name || 'Day'} — Exercise ${session.exerciseIndex + 1}/${session.exercises.length}`;

  renderSetsGrid();
}

function renderSetsGrid() {
  if (!session || !setsGrid) return;
  const current = session.exercises[session.exerciseIndex];
  const logEntry = session.log[session.exerciseIndex];
  const prev = session.previousByName?.[normalizeExerciseName(current?.name)];
  setsGrid.innerHTML = '';

  if (!Array.isArray(logEntry.sets)) logEntry.sets = [];
  while (logEntry.sets.length < current.sets) logEntry.sets.push({ reps: null, weight: null });
  if (logEntry.sets.length > current.sets) logEntry.sets = logEntry.sets.slice(0, current.sets);

  for (let i = 0; i < current.sets; i++) {
    const row = document.createElement('div');
    row.className = 'set-row';

    const label = document.createElement('div');
    label.className = 'set-label';
    const target = current.targetReps[i] ?? 0;
    label.textContent = `Set ${i + 1} · t${target}`;

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

    row.append(label, repsInput, weightInput);

    if (prev?.sets?.length) {
      const prevSet = prev.sets[i];
      const prevLine = document.createElement('div');
      prevLine.className = 'set-prev';
      if (!prevSet) {
        prevLine.textContent = 'Last: —';
      } else {
        const reps = prevSet.reps ?? '—';
        const weight = prevSet.weight ?? null;
        prevLine.textContent = `Last: ${reps}${weight != null ? ` @ ${weight}` : ''}`;
      }
      row.appendChild(prevLine);
    }
    setsGrid.appendChild(row);
  }
}

// ---------- History ----------
clearHistoryBtn.addEventListener('click', () => {
  if (!state.history.length) return;
  if (!confirm('Clear all history entries?')) return;
  state.history = [];
  saveState();
  renderHistory();
});

// ---------- PWA install prompt ----------
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  deferredPrompt = e;
  installBtn.style.display = 'inline-flex';
});

installBtn.addEventListener('click', async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt = null;
  installBtn.style.display = 'none';
});

// ---------- Service Worker ----------
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(err => console.error('SW registration failed', err));
}

// ---------- Boot ----------
(async function boot() {
  showScreen('programs');
  render();
  await seedProgramMdIntoIndexedDb();
  await autoImportExampleProgramIfEmpty();
})();
