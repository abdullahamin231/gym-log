import { initBackup } from './src/backup.js';
import { initCalorieView, renderCalorieView } from './src/calorieView.js';
import { dom } from './src/dom.js';
import { initHistoryView, renderHistory } from './src/historyView.js';
import { initPwa } from './src/pwa.js';
import { ensureDefaultProgramSeededIfEmpty } from './src/programStore.js';
import { renderPrograms } from './src/programView.js';
import { hasActiveSession, initSessionController, resetSession, updateSessionUI } from './src/sessionController.js';
import { renderSessionPreview, renderSessionSetup } from './src/sessionPreview.js';
import { initWeightView, renderTrackWeight } from './src/weightView.js';

let currentScreen = 'session';

function setHeaderSubtitle(text) {
  dom.headerSubtitle.textContent = text;
}

function showScreen(screenName) {
  if (hasActiveSession() && screenName !== 'session') return;
  currentScreen = screenName;
  Object.entries(dom.screens).forEach(([name, el]) => {
    el.classList.toggle('hidden', name !== screenName);
  });

  const primary = ['programs', 'session', 'history', 'track-weight', 'calorie'];
  const activeTab = primary.includes(screenName) ? screenName : 'programs';
  dom.tabButtons.forEach(btn => btn.classList.toggle('active', btn.dataset.nav === activeTab));

  if (screenName === 'programs') setHeaderSubtitle('Program');
  if (screenName === 'session') setHeaderSubtitle(hasActiveSession() ? 'Active' : 'Today');
  if (screenName === 'history') setHeaderSubtitle('History');
  if (screenName === 'track-weight') setHeaderSubtitle('Track Weight');
  if (screenName === 'calorie') setHeaderSubtitle('Calorie');
}

function render() {
  if (currentScreen === 'programs') renderPrograms();
  if (currentScreen === 'session') renderSessionSetup();
  if (currentScreen === 'history') renderHistory();
  if (currentScreen === 'track-weight') renderTrackWeight();
  if (currentScreen === 'calorie') renderCalorieView();
  updateSessionUI();
}

function initNavigation() {
  dom.tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      if (hasActiveSession()) return;
      const target = btn.dataset.nav;
      showScreen(target);
      render();
    });
  });

  dom.sessionDaySelect?.addEventListener('change', () => {
    if (currentScreen !== 'session') return;
    renderSessionPreview();
  });
}

function boot() {
  initNavigation();
  initHistoryView({ getCurrentScreen: () => currentScreen });
  initSessionController({ setHeaderSubtitle, renderHistory });
  initBackup({
    onImported: () => {
      resetSession();
      showScreen('history');
      render();
    }
  });
  initWeightView();
  initCalorieView();
  initPwa();

  ensureDefaultProgramSeededIfEmpty();
  showScreen('session');
  render();
}

boot();
