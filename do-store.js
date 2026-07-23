/* ============================================================================
 *  do-store.js — Dō's storage layer.
 *  ----------------------------------------------------------------------------
 *  ONE place that knows *where* data lives. The app never touches localStorage
 *  directly any more; it calls save()/load(), which call this.
 *
 *  WHY THIS EXISTS
 *  Google Calendar and the Google Health API both need a server (their OAuth
 *  refresh tokens can't live in a browser), so this app will eventually read and
 *  write over the network instead of localStorage. If `localStorage.getItem` is
 *  sprinkled across a dozen files, that migration is a rewrite. Behind this
 *  interface, it's a one-line change:
 *
 *      DoStore.use(new ApiAdapter('https://api.example.com'));
 *
 *  An adapter is just an object with get(key) / set(key, value) / remove(key),
 *  where value is always a string. Two ship here: LocalStorageAdapter (default)
 *  and MemoryAdapter (tests, private mode, sandboxes).
 *
 *  ALSO HERE
 *  - Schema versioning, so changing a field shape later has a migration hook
 *    instead of silently corrupting saved data.
 *  - exportJSON() / importJSON(), because localStorage can be evicted by the
 *    browser and months of project plans should not live in exactly one place.
 * ==========================================================================*/
(function (global) {
  'use strict';

  /* ---- schema ---------------------------------------------------------- */

  const SCHEMA_VERSION = 2;

  const KEYS = {
    tasks: 'do5_tasks',
    categories: 'do5_cats',
    projects: 'do5_projs',
    calEvents: 'do5_cal',
    version: 'do_schema_v',
  };

  const SLICES = ['tasks', 'categories', 'projects', 'calEvents'];

  const DEFAULT_CATEGORIES = [
    { id: 'work', name: 'Work', color: '#5A7EB5' },
    { id: 'personal', name: 'Personal', color: '#4A8A6C' },
    { id: 'health', name: 'Health', color: '#C4754A' },
  ];

  const defaults = () => ({
    tasks: [], categories: DEFAULT_CATEGORIES.map((c) => ({ ...c })),
    projects: [], calEvents: [],
  });

  /* ---- adapters -------------------------------------------------------- */

  function LocalStorageAdapter() {
    return {
      name: 'localStorage',
      get(k) { return localStorage.getItem(k); },
      set(k, v) { localStorage.setItem(k, v); },
      remove(k) { localStorage.removeItem(k); },
    };
  }

  function MemoryAdapter(seed) {
    const mem = Object.assign(Object.create(null), seed || {});
    return {
      name: 'memory',
      get(k) { return Object.prototype.hasOwnProperty.call(mem, k) ? mem[k] : null; },
      set(k, v) { mem[k] = String(v); },
      remove(k) { delete mem[k]; },
    };
  }

  // Pick a working adapter: localStorage can exist but throw (Safari private mode).
  function detectAdapter() {
    try {
      const probe = '__do_probe__';
      localStorage.setItem(probe, '1');
      localStorage.removeItem(probe);
      return LocalStorageAdapter();
    } catch (e) {
      console.warn('DoStore: localStorage unavailable, falling back to memory (data will not persist).');
      return MemoryAdapter();
    }
  }

  /* ---- store ----------------------------------------------------------- */

  const DoStore = {
    adapter: null,
    lastError: null,

    use(adapter) {
      this.adapter = adapter;
      return this;
    },

    _a() {
      if (!this.adapter) this.adapter = detectAdapter();
      return this.adapter;
    },

    _readArray(key) {
      try {
        const raw = this._a().get(key);
        if (!raw) return null;
        const val = JSON.parse(raw);
        return Array.isArray(val) ? val : null;
      } catch (e) {
        console.warn('DoStore: unreadable data for', key, e);
        return null;
      }
    },

    // Returns { tasks, categories, projects, calEvents }. Never throws.
    load() {
      const state = defaults();
      const tasks = this._readArray(KEYS.tasks);
      const cats = this._readArray(KEYS.categories);
      const projs = this._readArray(KEYS.projects);
      const cal = this._readArray(KEYS.calEvents);
      if (tasks) state.tasks = tasks;
      if (cats && cats.length) state.categories = cats;
      if (projs) state.projects = projs;
      if (cal) state.calEvents = cal;

      let stored = parseInt(this._a().get(KEYS.version) || '1', 10);
      if (!Number.isFinite(stored)) stored = 1;
      if (stored < SCHEMA_VERSION) this._migrate(state, stored);
      return state;
    },

    // Add a case per version bump. Keep them small and forward-only.
    _migrate(state, from) {
      let v = from;
      // if (v === 1) { state.tasks.forEach(t => { if (t.reps == null) t.reps = []; }); v = 2; }
      while (v < SCHEMA_VERSION) v++;
      this.saveAll(state); // stamps the new version
      return state;
    },

    // Persist the whole state. Returns true on success.
    saveAll(state) {
      try {
        const a = this._a();
        a.set(KEYS.tasks, JSON.stringify(state.tasks || []));
        a.set(KEYS.categories, JSON.stringify(state.categories || []));
        a.set(KEYS.projects, JSON.stringify(state.projects || []));
        a.set(KEYS.calEvents, JSON.stringify(state.calEvents || []));
        a.set(KEYS.version, String(SCHEMA_VERSION));
        this.lastError = null;
        return true;
      } catch (e) {
        // Most likely the storage quota, or private mode. Don't crash the app.
        this.lastError = e;
        console.error('DoStore: save failed', e);
        return false;
      }
    },

    /* ---- backup ---------------------------------------------------------
     * localStorage is not durable — browsers evict it under storage pressure.
     * exportJSON() is the user's escape hatch.
     * ------------------------------------------------------------------- */

    exportJSON(state) {
      const s = state || this.load();
      return JSON.stringify({
        app: 'do',
        schema: SCHEMA_VERSION,
        exportedAt: new Date().toISOString(),
        data: { tasks: s.tasks, categories: s.categories, projects: s.projects, calEvents: s.calEvents },
      }, null, 2);
    },

    // Parse + validate a backup. Throws on malformed input; never half-applies.
    parseBackup(text) {
      const parsed = JSON.parse(text);
      const data = parsed && parsed.data ? parsed.data : parsed;
      if (!data || typeof data !== 'object') throw new Error('Not a Dō backup file.');
      const state = defaults();
      let found = 0;
      for (const slice of SLICES) {
        if (Array.isArray(data[slice])) { state[slice] = data[slice]; found++; }
      }
      if (!found) throw new Error('No Dō data found in that file.');
      if (!state.categories.length) state.categories = defaults().categories;
      return state;
    },

    // Replace everything with a backup's contents. Returns the new state.
    importJSON(text) {
      const state = this.parseBackup(text);
      this.saveAll(state);
      return state;
    },

    // Wipe stored data (used by tests; the app should confirm with the user first).
    clear() {
      const a = this._a();
      Object.values(KEYS).forEach((k) => a.remove(k));
    },
  };

  global.DoStore = DoStore;
  global.DoStoreAdapters = { LocalStorageAdapter, MemoryAdapter };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { DoStore, LocalStorageAdapter, MemoryAdapter, SCHEMA_VERSION, KEYS };
  }

})(typeof globalThis !== 'undefined' ? globalThis : this);
