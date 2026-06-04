// Data schema (normalized):
// Exercise { id, name }
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

let currentScreen = 'session';
let selectedProgramId = null;
let selectedDayId = null;

let session = null;

const hardcodedProgram = {
  name: 'program',
  days: [
    {
      name: 'Upper 1',
      blocks: [
        [{ name: 'Incline Bench', sets: 3, target: 8, display: '2-3 sets 4-8 reps' }, { name: 'DB Row', sets: 2, target: 12, display: '2 sets 8-12 reps' }],
        [{ name: 'Pec Deck', sets: 3, target: 12, display: '3 sets 8-12 reps' }, { name: 'Back Row Machine', sets: 3, target: 12, display: '3 sets 8-12 reps' }],
        [{ name: 'DB OHP', sets: 2, target: 12, display: '2 sets 8-12 reps' }, { name: 'EZ Bar Curls', sets: 2, targets: [4, 12], display: '30kgx4, 25kgx12' }],
        [{ name: 'Machine Triceps Extension', sets: 3, target: 12, display: '3 sets 8-12 reps' }, { name: 'Ab Crunches', sets: 3, target: 12, display: '3x8-12' }]
      ]
    },
    {
      name: 'Lower',
      blocks: [
        [{ name: 'Barbell Squats', sets: 2, target: 8, display: '2 sets 4-8 reps' }, { name: 'Hammer Curls', sets: 3, target: 12, display: '3 sets 8-12 reps' }],
        [{ name: 'RDL', sets: 2, target: 8, display: '2 sets 4-8 reps' }, { name: 'Ab Crunches', sets: 2, target: 8, display: '2 sets 4-8 reps' }],
        [{ name: 'Quad Isolation', sets: 4, target: 20, display: '3-4x15-20' }, { name: 'Neck Extensions', sets: 4, target: 20, display: '3-4x15-20' }]
      ]
    },
    {
      name: 'Arms',
      blocks: [
        [{ name: 'Close Grip Bench', sets: 3, target: 8, display: '2-3 sets 4-8 reps' }, { name: 'DB Pullovers', sets: 3, target: 8, display: '2-3 sets 4-8 reps' }],
        [{ name: 'Skull-crushers', sets: 3, target: 12, display: '2-3 sets 8-12 reps' }, { name: 'EZ Bar Curls', sets: 3, target: 12, display: '2-3 sets 8-12 reps' }],
        [{ name: 'Hammer Curls', sets: 3, target: 12, display: '2-3 sets 8-12 reps' }, { name: 'Upright Rows', sets: 3, target: 12, display: '2-3 sets 8-12 reps' }],
        [{ name: 'Ab Crunches', sets: 3, target: 12, display: '3 sets 8-12 reps' }]
      ]
    },
    {
      name: 'Upper 2',
      subtitle: 'Back focused',
      blocks: [
        [{ name: 'Incline Bench Press', sets: 3, target: 8, display: '2-3 sets 4-8 reps' }],
        [{ name: 'DB Rows', sets: 2, target: 12, display: '2 sets 8-12 reps' }, { name: 'Back Row Machine', sets: 3, target: 12, display: '3 sets 8-12 reps' }],
        [{ name: 'Pullups', sets: 3, target: 0, display: '3 sets AMRAP' }, { name: 'Triceps Pushdowns', sets: 2, targets: [7, 6], display: '14px7, 6' }],
        [{ name: 'Bicep Curls', sets: 3, target: 12, display: '2-3 sets 8-12 reps' }, { name: 'Ab Crunches', sets: 2, targets: [10, 8], display: '5p x10, 8' }],
        [{ name: 'Cable Lateral Raises', sets: 3, target: 15, display: '3 sets 8-15' }]
      ]
    }
  ]
};

// ---------- DOM ----------
const headerSubtitle = document.getElementById('headerSubtitle');
const installBtn = document.getElementById('installBtn');
const hardcodedProgramSheet = document.getElementById('hardcodedProgramSheet');

const screens = {
  programs: document.getElementById('screen-programs'),
  session: document.getElementById('screen-session'),
  history: document.getElementById('screen-history'),
  'track-weight': document.getElementById('screen-track-weight')
};

const tabButtons = Array.from(document.querySelectorAll('.tabbar .tab'));

const sessionDaySelect = document.getElementById('sessionDaySelect');

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

const sessionPreview = document.getElementById('sessionPreview');
const sessionPreviewDay = document.getElementById('sessionPreviewDay');
const sessionPreviewProgram = document.getElementById('sessionPreviewProgram');
const sessionPreviewExerciseCount = document.getElementById('sessionPreviewExerciseCount');
const sessionPreviewExercises = document.getElementById('sessionPreviewExercises');
const sessionStartBtn = document.getElementById('sessionStartBtn');

const historyList = document.getElementById('historyList');
const clearHistoryBtn = document.getElementById('clearHistoryBtn');
const historyExerciseSelect = document.getElementById('historyExerciseSelect');
const historyChart = document.getElementById('historyChart');
const historyChartEmpty = document.getElementById('historyChartEmpty');
const exportBtn = document.getElementById('exportBtn');
const importBtn = document.getElementById('importBtn');
const importFile = document.getElementById('importFile');

const weightInput = document.getElementById('weightInput');
const logWeightBtn = document.getElementById('logWeightBtn');
const weightChart = document.getElementById('weightChart');
const weightLogStatus = document.getElementById('weightLogStatus');

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

// ---------- IndexedDB ----------
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

// ---------- Storage ----------
function loadState() {
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

function saveState() {
  localStorage.setItem(storageKey, JSON.stringify(state));
}

function applyImportedState(next) {
  const migrated = migrateIfNeeded(next);
  state.programs = Array.isArray(migrated.programs) ? migrated.programs : [];
  state.exercises = Array.isArray(migrated.exercises) ? migrated.exercises : [];
  state.history = Array.isArray(migrated.history) ? migrated.history : [];
  state.ui = typeof migrated.ui === 'object' && migrated.ui ? migrated.ui : {};
  state.weightEntries = Array.isArray(migrated.weightEntries) ? migrated.weightEntries : [];
  ensureUiDefaults();
  saveState();
}

function ensureUiDefaults() {
  state.ui ||= {};
  if (typeof state.ui.defaultProgramId !== 'string') state.ui.defaultProgramId = '';
  if (typeof state.ui.defaultProgramSeeded !== 'boolean') state.ui.defaultProgramSeeded = false;
}

function migrateIfNeeded(parsed) {
  if (Array.isArray(parsed.exercises) && Array.isArray(parsed.programs)) return { ...parsed, ui: parsed.ui || {}, weightEntries: Array.isArray(parsed.weightEntries) ? parsed.weightEntries : [] };

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

function formatTarget(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return '\u2014';
  return String(n);
}

function formatTargetReps(targetReps) {
  const arr = Array.isArray(targetReps) ? targetReps : [];
  const pieces = arr.map(formatTarget);
  if (!pieces.length || pieces.every(p => p === '\u2014')) return '\u2014';
  if (pieces.every(p => p === pieces[0])) return pieces[0];
  return pieces.join('/');
}

function ensureDefaultProgramSeededIfEmpty() {
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

function getDefaultProgramId() {
  if (state.ui.defaultProgramId && findProgram(state.ui.defaultProgramId)) return state.ui.defaultProgramId;
  return state.programs[0]?.id || '';
}

function getDefaultDayForProgram(program) {
  if (!program?.days.length) return { day: null, index: -1 };
  const idx = Math.max(0, Math.min(program.nextDayIndex || 0, program.days.length - 1));
  return { day: program.days[idx], index: idx };
}

function getDefaultProgram() {
  const id = getDefaultProgramId();
  return id ? findProgram(id) : state.programs[0] || null;
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

  const primary = ['programs', 'session', 'history', 'track-weight'];
  const activeTab = primary.includes(screenName) ? screenName : 'programs';
  tabButtons.forEach(btn => btn.classList.toggle('active', btn.dataset.nav === activeTab));

  if (screenName === 'programs') setHeaderSubtitle('Program');
  if (screenName === 'session') setHeaderSubtitle(session ? 'Active' : 'Today');
  if (screenName === 'history') setHeaderSubtitle('History');
  if (screenName === 'track-weight') setHeaderSubtitle('Track Weight');
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
function renderHardcodedProgramSheet() {
  if (!hardcodedProgramSheet) return;
  hardcodedProgramSheet.innerHTML = '';

  const title = document.createElement('div');
  title.className = 'program-sheet-title';
  title.textContent = hardcodedProgram.name;
  hardcodedProgramSheet.appendChild(title);

  hardcodedProgram.days.forEach(day => {
    const section = document.createElement('section');
    section.className = 'program-day';

    const heading = document.createElement('div');
    heading.className = 'program-day-heading';
    const name = document.createElement('h3');
    name.textContent = day.name;
    heading.appendChild(name);
    if (day.subtitle) {
      const subtitle = document.createElement('span');
      subtitle.textContent = day.subtitle;
      heading.appendChild(subtitle);
    }
    section.appendChild(heading);

    day.blocks.forEach(block => {
      const row = document.createElement('div');
      row.className = 'program-block';
      block.forEach(item => {
        const cell = document.createElement('div');
        cell.className = 'program-prescription';
        const exercise = document.createElement('strong');
        exercise.textContent = item.name;
        const prescription = document.createElement('span');
        prescription.textContent = item.display;
        cell.append(exercise, prescription);
        row.appendChild(cell);
      });
      section.appendChild(row);
    });

    hardcodedProgramSheet.appendChild(section);
  });
}

function renderPrograms() {
  renderHardcodedProgramSheet();
}

function renderSessionSetup() {
  const program = getDefaultProgram();
  sessionDaySelect.innerHTML = '';

  if (!program || !program.days.length) {
    sessionDaySelect.disabled = true;
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = program ? 'No days available' : 'No program';
    sessionDaySelect.appendChild(opt);

    sessionPreviewProgram.textContent = '';
    sessionPreviewDay.textContent = 'No workout';
    sessionPreviewExerciseCount.textContent = '';
    sessionPreviewExercises.innerHTML = '<li class="muted" style="padding:14px 16px;list-style:none">Set up a program to get started.</li>';
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
  if (day) sessionDaySelect.value = day.id;

  renderSessionPreview();
}

function renderSessionPreview() {
  const program = getDefaultProgram();
  if (!program || !program.days.length) return;

  const dayId = sessionDaySelect.value;
  if (!dayId) return;
  const day = findDay(program.id, dayId);
  if (!day) return;

  sessionPreviewProgram.textContent = program.name;
  sessionPreviewDay.textContent = day.name;
  sessionPreviewExerciseCount.textContent = `${day.items.length} exercise${day.items.length !== 1 ? 's' : ''}`;

  sessionPreviewExercises.innerHTML = '';
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
    sessionPreviewExercises.appendChild(li);
  });
}

function renderHistory() {
  historyList.innerHTML = '';
  const template = document.getElementById('historyTemplate');
  if (!state.history.length) {
    historyList.innerHTML = '<li class="muted" style="list-style:none">No sessions logged yet.</li>';
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
        `${entry.programName} \u2022 ${entry.dayName} \u2022 ${new Date(entry.performedAt).toLocaleString()}`;
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
        line.textContent = `${ex.name} \u2014 ${sets}`;
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
    historyChartEmpty.textContent = `First: ${first} \u2022 Latest: ${last} \u2022 \u0394 ${delta}`;
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
  ctx.fillStyle = '#141414';
  ctx.fillRect(0, 0, w, h);

  const padL = 46 * dpr;
  const padR = 12 * dpr;
  const padT = 14 * dpr;
  const padB = 26 * dpr;
  const plotW = w - padL - padR;
  const plotH = h - padT - padB;

  ctx.strokeStyle = 'rgba(239,237,232,0.3)';
  ctx.lineWidth = 1 * dpr;
  ctx.beginPath();
  ctx.moveTo(padL, padT);
  ctx.lineTo(padL, padT + plotH);
  ctx.lineTo(padL + plotW, padT + plotH);
  ctx.stroke();

  ctx.fillStyle = 'rgba(107,106,99,0.95)';
  ctx.font = `${12 * dpr}px DM Mono, monospace`;

  if (yLabel) ctx.fillText(yLabel, 10 * dpr, 14 * dpr);

  if (!points.length) {
    ctx.fillStyle = 'rgba(107,106,99,0.75)';
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

  const ticks = 4;
  ctx.fillStyle = 'rgba(107,106,99,0.9)';
  for (let i = 0; i <= ticks; i++) {
    const t = i / ticks;
    const yVal = minY + (1 - t) * (maxY - minY);
    const yPx = padT + t * plotH;
    ctx.strokeStyle = 'rgba(34,34,34,0.9)';
    ctx.beginPath();
    ctx.moveTo(padL, yPx);
    ctx.lineTo(padL + plotW, yPx);
    ctx.stroke();
    ctx.fillText(`${Math.round(yVal * 10) / 10}`, 6 * dpr, yPx + 4 * dpr);
  }

  ctx.strokeStyle = 'rgba(217,56,56,0.9)';
  ctx.lineWidth = 2 * dpr;
  ctx.beginPath();
  points.forEach((p, i) => {
    const x = xToPx(i);
    const y = yToPx(p.y);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();

  ctx.fillStyle = 'rgba(217,56,56,1)';
  points.forEach((p, i) => {
    const x = xToPx(i);
    const y = yToPx(p.y);
    ctx.beginPath();
    ctx.arc(x, y, 3.5 * dpr, 0, Math.PI * 2);
    ctx.fill();
  });

  const firstDate = new Date(points[0].x);
  const lastDate = new Date(points[points.length - 1].x);
  ctx.fillStyle = 'rgba(107,106,99,0.9)';
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
      weightEntries: state.weightEntries,
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

function logWeight() {
  const raw = weightInput?.value.trim();
  const val = parseFloat(raw);
  if (isNaN(val) || val <= 0) return;
  const entry = { id: uid(), date: new Date().toISOString().slice(0, 10), weight: val };
  state.weightEntries.push(entry);
  saveState();
  weightInput.value = '';
  weightLogStatus.textContent = `Logged ${val} kg`;
  renderTrackWeight();
}

logWeightBtn?.addEventListener('click', logWeight);
weightInput?.addEventListener('keydown', e => {
  if (e.key === 'Enter') logWeight();
});

function renderTrackWeight() {
  const series = state.weightEntries
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(e => ({ x: e.date, y: e.weight }));
  drawLineChart(weightChart, series, { yLabel: 'kg' });
}

function render() {
  if (currentScreen === 'programs') renderPrograms();
  if (currentScreen === 'session') renderSessionSetup();
  if (currentScreen === 'history') renderHistory();
  if (currentScreen === 'track-weight') renderTrackWeight();
  updateSessionUI();
}

// ---------- Session ----------
sessionDaySelect?.addEventListener('change', () => {
  if (currentScreen !== 'session') return;
  renderSessionPreview();
});

sessionStartBtn?.addEventListener('click', () => {
  if (session) return;

  const program = getDefaultProgram();
  if (!program || !program.days.length) return;

  const day = findDay(program.id, sessionDaySelect.value);
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
      sets: Array.from({ length: ex.sets }, () => ({ reps: null, weight: null }))
    }))
  };

  setHeaderSubtitle('Active');
  updateSessionUI();
});

function updateSessionUI() {
  if (!session) {
    document.body.classList.remove('session-active');
    sessionRunCard?.classList.add('hidden');
    sessionControls.classList.add('hidden');
    sessionStatus.textContent = 'No active session.';
    return;
  }

  document.body.classList.add('session-active');
  sessionRunCard?.classList.remove('hidden');
  sessionControls.classList.remove('hidden');
  const current = session.exercises[session.exerciseIndex];
  currentExerciseEl.textContent = current.name;
  setProgressEl.textContent = `Exercise ${session.exerciseIndex + 1}/${session.exercises.length} \u2022 ${current.sets} sets`;
  if (removeSetBtn) removeSetBtn.disabled = (current.sets || 1) <= 1;

  const program = findProgram(session.programId);
  const day = findDay(session.programId, session.dayId);
  sessionStatus.textContent = `${program?.name || 'Program'} \u2022 ${day?.name || 'Day'} \u2014 Exercise ${session.exerciseIndex + 1}/${session.exercises.length}`;

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

    row.append(label, weightInput, repsInput);

    if (prev?.sets?.length) {
      const prevSet = prev.sets[i];
      const prevLine = document.createElement('div');
      prevLine.className = 'set-prev';
      if (!prevSet) {
        prevLine.textContent = 'Last \u2014';
      } else {
        const reps = typeof prevSet.reps === 'number' ? prevSet.reps : null;
        const weight = typeof prevSet.weight === 'number' ? prevSet.weight : null;
        if (reps == null && weight == null) {
          prevLine.textContent = 'Last \u2014';
        } else if (reps != null && weight != null) {
          prevLine.textContent = `Last ${weight}kg for ${reps}reps`;
        } else if (weight != null) {
          prevLine.textContent = `Last ${weight}kg for \u2014`;
        } else {
          prevLine.textContent = `Last \u2014 for ${reps}reps`;
        }
      }
      row.appendChild(prevLine);
    }
    setsGrid.appendChild(row);
  }
}

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
  ensureDefaultProgramSeededIfEmpty();
  showScreen('session');
  render();
})();
