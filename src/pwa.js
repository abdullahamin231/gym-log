import { dom } from './dom.js';

let deferredPrompt = null;

export function initPwa() {
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    deferredPrompt = e;
    dom.installBtn.style.display = 'inline-flex';
  });

  dom.installBtn.addEventListener('click', async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    dom.installBtn.style.display = 'none';
  });

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(err => console.error('SW registration failed', err));
  }
}
