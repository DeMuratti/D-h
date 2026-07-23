/* app.init.js — extracted from todo-app.html. Service worker registration + boot sequence. MUST load last. */


// ── SERVICE WORKER REGISTRATION ──────────────────────────────────
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}

// ── INIT ────────────────────────────────────────────────────────
// Wire the Store before anything can mutate state: persistence goes to save()
// (which hands the globals to DoStore), and every mutation re-renders.
Store.configure({persist:save});
Store.subscribe(renderAll);

load();updateDate();initCal();
selectedDate=today();
fitbitRestoreSession();
renderAll();
