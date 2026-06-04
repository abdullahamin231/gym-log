import { drawLineChart } from './chart.js';
import { dom } from './dom.js';
import { saveState, state } from './storage.js';

let getCurrentScreen = () => '';

export function initHistoryView(options) {
  getCurrentScreen = options.getCurrentScreen;
  dom.historyExerciseSelect?.addEventListener('change', () => {
    if (getCurrentScreen() !== 'history') return;
    renderHistoryChart();
  });

  dom.clearHistoryBtn.addEventListener('click', () => {
    if (!state.history.length) return;
    if (!confirm('Clear all history entries?')) return;
    state.history = [];
    saveState();
    renderHistory();
  });
}

export function renderHistory() {
  dom.historyList.innerHTML = '';
  const template = document.getElementById('historyTemplate');
  if (!state.history.length) {
    dom.historyList.innerHTML = '<li class="muted" style="list-style:none">No sessions logged yet.</li>';
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
      dom.historyList.appendChild(node);
    });

  renderHistoryChart();
}

export function renderHistoryChart() {
  if (!dom.historyExerciseSelect || !dom.historyChart || !dom.historyChartEmpty) return;

  const previousSelection = dom.historyExerciseSelect.value;
  const names = new Set();
  state.history.forEach(entry => {
    (entry.exercises || []).forEach(ex => {
      if (ex?.name) names.add(ex.name);
    });
  });
  const options = Array.from(names).sort((a, b) => a.localeCompare(b));

  dom.historyExerciseSelect.innerHTML = '';
  if (!options.length) {
    dom.historyExerciseSelect.disabled = true;
    dom.historyChartEmpty.textContent = 'Log sessions with weights to see progress here.';
    drawLineChart(dom.historyChart, [], { yLabel: 'Weight' });
    return;
  }
  dom.historyExerciseSelect.disabled = false;
  options.forEach(name => {
    const opt = document.createElement('option');
    opt.value = name;
    opt.textContent = name;
    dom.historyExerciseSelect.appendChild(opt);
  });

  const nextSelection = options.includes(previousSelection) ? previousSelection : options[0];
  dom.historyExerciseSelect.value = nextSelection;
  const series = buildExerciseWeightSeries(nextSelection);
  if (!series.length) {
    dom.historyChartEmpty.textContent = 'No weight entries found for this exercise yet.';
  } else {
    const last = series[series.length - 1].y;
    const first = series[0].y;
    const delta = (last - first).toFixed(1).replace(/\.0$/, '');
    dom.historyChartEmpty.textContent = `First: ${first} \u2022 Latest: ${last} \u2022 \u0394 ${delta}`;
  }
  drawLineChart(dom.historyChart, series, { yLabel: 'Weight' });
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
