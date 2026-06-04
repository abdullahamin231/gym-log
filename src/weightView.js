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
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(e => ({ x: e.date, y: e.weight }));
  drawLineChart(dom.weightChart, series, { yLabel: 'kg' });
}

function logWeight() {
  const raw = dom.weightInput?.value.trim();
  const val = parseFloat(raw);
  if (isNaN(val) || val <= 0) return;
  const entry = { id: uid(), date: new Date().toISOString().slice(0, 10), weight: val };
  state.weightEntries.push(entry);
  saveState();
  dom.weightInput.value = '';
  dom.weightLogStatus.textContent = `Logged ${val} kg`;
  renderTrackWeight();
}
