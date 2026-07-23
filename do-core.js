/* ============================================================================
 *  do-core.js — Dō's UI/mutation toolkit.
 *  ----------------------------------------------------------------------------
 *  Plain global-namespace script (NOT an ES module) so the inline onclick="..."
 *  handlers keep working. Loaded after do-time.js / do-store.js.
 *
 *  WHAT'S HERE
 *    1. Store          — the one way to mutate app state (persist + re-render)
 *    2. renderSelectGrid / getSelectedId — id-based selection, not DOM position
 *    3. renderSwatches — one colour picker instead of several copies
 *
 *  WHAT'S DELIBERATELY *NOT* HERE
 *  An earlier draft of this file carried its own `DoDate` helpers and its own
 *  `Store.state` + localStorage persistence. Both were superseded:
 *    - dates  -> do-time.js  (DoTime), which is DST-safe and has the tests
 *    - storage-> do-store.js (DoStore), which is adapter-swappable
 *  Keeping second copies here meant two sources of truth and direct
 *  localStorage calls from a file that isn't the storage layer. They're gone.
 *  Store now owns *sequencing* (mutate -> persist -> notify), not storage.
 * ==========================================================================*/
(function (global) {
  'use strict';

  /* ==========================================================================
   * 1. STORE — the one way to change app state
   * --------------------------------------------------------------------------
   * The app's state lives in the globals declared in app.config.js (tasks,
   * projects, categories, calEvents). Those are `let` bindings that get
   * reassigned wholesale (e.g. `tasks = tasks.filter(...)`), so Store cannot
   * hold a reference to them — it would go stale the first time one is
   * replaced. Instead Store calls the app's save(), which re-reads the globals
   * on every call and hands them to DoStore.
   *
   * This replaces the scattered `...; save(); renderAll();` tail on every
   * handler: forget one half of that pair and you get either a lost edit or a
   * stale screen. Store.update() makes both automatic.
   *
   *   SETUP (app.init.js, once):
   *     Store.configure({ persist: save });
   *     Store.subscribe(renderAll);
   *
   *   USAGE:
   *     t.done = !t.done; save(); renderAll();     // before
   *     Store.update(() => { t.done = !t.done; }); // after
   *
   *   For a mutation whose caller does its own partial render, use
   *   Store.persist() to save without triggering subscribers.
   * ======================================================================== */
  const Store = {
    _subs: [],
    _persistFn: null,

    // Inject the persist function (the app's save()). Done once at startup so
    // this file has no hidden dependency on a global name.
    configure(opts) {
      opts = opts || {};
      if (typeof opts.persist === 'function') this._persistFn = opts.persist;
      return this;
    },

    // Mutate -> persist -> re-render. The only sanctioned way to change state.
    update(mutator) {
      if (typeof mutator === 'function') mutator();
      const saved = this.persist();
      this._notify();
      return saved;
    },

    // Persist only. For handlers that render a subset of the UI themselves.
    persist() {
      const fn = this._persistFn
        || (typeof global.save === 'function' ? global.save : null);
      if (!fn) {
        console.error('Store: no persist function configured — call Store.configure({persist: save}).');
        return false;
      }
      return fn();
    },

    subscribe(fn) {
      this._subs.push(fn);
      return () => { this._subs = this._subs.filter((f) => f !== fn); };
    },

    _notify() {
      for (const fn of this._subs) {
        // One bad subscriber must not stop the others, or abort the mutation
        // that has already been persisted.
        try { fn(); } catch (e) { console.error('Store subscriber threw', e); }
      }
    },
  };

  /* ==========================================================================
   * 2. ID-BASED SELECTION (kills the fragile positional index matching)
   * --------------------------------------------------------------------------
   * The old pattern in app.panels.js read a selection back out of the DOM by
   * position:
   *     projects[pi.slice(1).indexOf(sp)]?.id
   * That silently depends on DOM order === array order. Reorder, filter or
   * sort the grid and it writes the WRONG record's id — no error, just bad
   * data. Render each option with a data-id, read the id straight back.
   *
   *   USAGE — render a selectable grid:
   *     renderSelectGrid($('taskProjGrid'), projects, {
   *       selectedId: task?.projectId || null,
   *       includeNone: true,                      // adds a "None" option (id = null)
   *       label: p => `${p.emoji || '📋'} ${esc(p.name)}`,
   *       itemClass: 'proj-select-item',
   *     });
   *
   *   USAGE — read the selection back (replaces the indexOf dance):
   *     const projectId = getSelectedId($('taskProjGrid'));   // id string, or null
   * ======================================================================== */
  function renderSelectGrid(container, items, opts) {
    opts = opts || {};
    const label = opts.label || ((x) => String(x.name != null ? x.name : x.id || ''));
    const itemClass = opts.itemClass || 'select-item';
    container.innerHTML = '';

    const makeBtn = (id, html, selected, extraClass) => {
      const btn = document.createElement('button');
      btn.className = itemClass + (extraClass ? ' ' + extraClass : '') + (selected ? ' selected' : '');
      btn.dataset.id = id === null ? '' : String(id); // "" sentinel === None
      btn.innerHTML = html;
      btn.onclick = () => {
        container.querySelectorAll('.' + itemClass).forEach((el) => el.classList.remove('selected'));
        btn.classList.add('selected');
        if (opts.onSelect) opts.onSelect(id);
      };
      container.appendChild(btn);
    };

    if (opts.includeNone) {
      makeBtn(null, 'None', opts.selectedId == null, 'none-item');
    }
    items.forEach((it) => makeBtn(it.id, label(it), it.id === opts.selectedId));
  }

  // Read the selected id from a grid rendered above. Returns a string id, or
  // null. Note that null means BOTH "nothing selected" and "the None option is
  // selected" — for the grids here those collapse to the same stored value
  // (null), so the ambiguity is harmless. If a caller ever needs to tell them
  // apart, check container.querySelector('.selected') directly.
  function getSelectedId(container) {
    const sel = container.querySelector('.selected');
    if (!sel) return null;
    const id = sel.dataset.id;
    return id === '' || id == null ? null : id;
  }

  /* ==========================================================================
   * 3. COLOUR SWATCHES (one helper instead of a copy per panel)
   * --------------------------------------------------------------------------
   * Replaces renderColorPicker / renderProjColorPicker / renderCalEvtColor,
   * which were the same fifteen lines three times over.
   *
   *   USAGE:
   *     renderSwatches($('colorPicker'), PALETTE, pickedColor, c => { pickedColor = c; });
   * ======================================================================== */
  function renderSwatches(container, palette, selected, onPick) {
    container.innerHTML = '';
    palette.forEach((c) => {
      const sw = document.createElement('button');
      sw.className = 'color-swatch' + (c === selected ? ' picked' : '');
      sw.style.background = c;
      sw.dataset.color = c;
      sw.onclick = () => {
        container.querySelectorAll('.color-swatch').forEach((s) => s.classList.remove('picked'));
        sw.classList.add('picked');
        if (onPick) onPick(c);
      };
      container.appendChild(sw);
    });
  }

  /* ==========================================================================
   * EXPORTS
   * ======================================================================== */
  global.Store = Store;
  global.renderSelectGrid = renderSelectGrid;
  global.getSelectedId = getSelectedId;
  global.renderSwatches = renderSwatches;

})(typeof globalThis !== 'undefined' ? globalThis : this);
