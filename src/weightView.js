import { drawLineChart } from './chart.js';
import { dom } from './dom.js';
import { saveState, state } from './storage.js';
import { uid } from './utils.js';

export function initWeightView() {
  dom.logWeightBtn?.addEventListener('click', logWeight);
  dom.weightInput?.addEventListener('keydown', e => {
    if (e.key === 'Enter') logWeight();
  });
}

export function renderTrackWeight() {
  const series = state.weightEntries
    .slice()
    .sort((a, b) => String(a.date).localeCompare(String(b.date)))
    .map(e => ({ x: e.date, y: e.weight }));
  drawLineChart(dom.weightChart, series, { yLabel: 'kg' });
  renderWeightLog();
}

function logWeight() {
  const raw = dom.weightInput?.value.trim();
  const val = parseFloat(raw);
  if (isNaN(val) || val <= 0) return;
  const loggedAt = new Date();
  const entry = { id: uid(), date: loggedAt.toISOString(), weight: val };
  state.weightEntries.push(entry);
  saveState();
  dom.weightInput.value = '';
  dom.weightLogStatus.textContent = `Logged ${val} kg at ${loggedAt.toLocaleString()}`;
  renderTrackWeight();
}

function renderWeightLog() {
  if (!dom.weightEntriesList) return;
  dom.weightEntriesList.innerHTML = '';

  const entries = state.weightEntries
    .slice()
    .sort((a, b) => String(b.date).localeCompare(String(a.date)))
    .slice(0, 8);

  if (!entries.length) {
    dom.weightEntriesList.innerHTML = '<li class="muted" style="list-style:none">No weight entries yet.</li>';
    return;
  }

  entries.forEach(entry => {
    const li = document.createElement('li');
    li.className = 'weight-log-item';

    const weight = document.createElement('strong');
    weight.textContent = `${entry.weight} kg`;

    const date = document.createElement('span');
    const parsed = new Date(entry.date);
    date.textContent = Number.isNaN(parsed.getTime()) ? String(entry.date) : parsed.toLocaleString();

    li.append(weight, date);
    dom.weightEntriesList.appendChild(li);
  });
}
