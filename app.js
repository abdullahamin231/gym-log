import { initBackup } from './src/backup.js';
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

  const primary = ['programs', 'session', 'history', 'track-weight'];
  const activeTab = primary.includes(screenName) ? screenName : 'programs';
  dom.tabButtons.forEach(btn => btn.classList.toggle('active', btn.dataset.nav === activeTab));

  if (screenName === 'programs') setHeaderSubtitle('Program');
  if (screenName === 'session') setHeaderSubtitle(hasActiveSession() ? 'Active' : 'Today');
  if (screenName === 'history') setHeaderSubtitle('History');
  if (screenName === 'track-weight') setHeaderSubtitle('Track Weight');
}

function render() {
  if (currentScreen === 'programs') renderPrograms();
  if (currentScreen === 'session') renderSessionSetup();
  if (currentScreen === 'history') renderHistory();
  if (currentScreen === 'track-weight') renderTrackWeight();
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
  initPwa();

  ensureDefaultProgramSeededIfEmpty();
  showScreen('session');
  render();
}

boot();
