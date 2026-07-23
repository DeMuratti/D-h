#!/usr/bin/env node
/* run-tests.js — Dō test suite.
 *
 *   node tests/run-tests.js
 *
 * Covers the two layers the project rules call out (do-time.js, do-store.js)
 * plus characterization tests that boot the whole app in jsdom and drive it
 * through the DOM, so a refactor that changes behaviour gets caught. */

const path = require('path');
const { run } = require('./harness');

let passed = 0, failed = 0;
const fails = [];

function t(name, fn) {
  try { fn(); passed++; console.log('  ok   ' + name); }
  catch (e) { failed++; fails.push([name, e.message]); console.log('  FAIL ' + name + '\n         ' + e.message); }
}
function eq(a, b, msg) {
  const A = JSON.stringify(a), B = JSON.stringify(b);
  if (A !== B) throw new Error((msg ? msg + ': ' : '') + `expected ${B}, got ${A}`);
}
function ok(v, msg) { if (!v) throw new Error(msg || 'expected truthy, got ' + v); }
function section(s) { console.log('\n' + s); }

/* ── do-time.js ──────────────────────────────────────────────────── */
section('do-time.js');
const DoTime = require(path.join(__dirname, '..', 'do-time.js'));

t('dayKey reads local time, not UTC', () => {
  // 5 July 2026, 00:30 local. toISOString() would say 4 July in UTC+2/+3.
  eq(DoTime.dayKey(new Date(2026, 6, 5, 0, 30)), '2026-07-05');
});
t('parseDay round-trips', () => eq(DoTime.dayKey(DoTime.parseDay('2026-01-05')), '2026-01-05'));
t('addDays crosses a month boundary', () => eq(DoTime.addDays('2026-01-31', 1), '2026-02-01'));
t('addDays crosses the spring DST change', () => eq(DoTime.addDays('2026-03-28', 2), '2026-03-30'));
t('diffDays is exact across DST', () => eq(DoTime.diffDays('2026-03-28', '2026-03-30'), 2));
t('diffDays is signed', () => eq(DoTime.diffDays('2026-03-30', '2026-03-28'), -2));
t('weekdayMon0: Monday is 0', () => eq(DoTime.weekdayMon0('2026-07-06'), 0));
t('startOfWeek returns that week\'s Monday', () => eq(DoTime.startOfWeek('2026-07-09'), '2026-07-06'));
t('toMinutes / toHHMM round-trip', () => eq(DoTime.toHHMM(DoTime.toMinutes('07:30')), '07:30'));
t('isDayKey rejects junk', () => eq([DoTime.isDayKey('2026-07-05'), DoTime.isDayKey('nope')], [true, false]));

/* ── do-store.js ─────────────────────────────────────────────────── */
section('do-store.js');
const { DoStore, MemoryAdapter } = require(path.join(__dirname, '..', 'do-store.js'));

t('load() returns defaults on empty storage', () => {
  DoStore.use(MemoryAdapter());
  const s = DoStore.load();
  eq(s.tasks, []);
  eq(s.categories.length, 3);
});
t('saveAll then load round-trips', () => {
  DoStore.use(MemoryAdapter());
  DoStore.saveAll({ tasks: [{ id: 'a', name: 'X' }], categories: [], projects: [], calEvents: [] });
  eq(DoStore.load().tasks[0].name, 'X');
});
t('corrupt JSON does not throw', () => {
  DoStore.use(MemoryAdapter({ do5_tasks: '{not json' }));
  eq(DoStore.load().tasks, []);
});
t('exportJSON / parseBackup round-trips', () => {
  DoStore.use(MemoryAdapter());
  const json = DoStore.exportJSON({ tasks: [{ id: 'z' }], categories: [], projects: [], calEvents: [] });
  eq(DoStore.parseBackup(json).tasks[0].id, 'z');
});
t('parseBackup rejects a non-backup file', () => {
  let threw = false;
  try { DoStore.parseBackup('{"hello":1}'); } catch (e) { threw = true; }
  ok(threw, 'expected parseBackup to throw');
});

/* ── app boot ────────────────────────────────────────────────────── */
section('app boot');
t('all scripts load and the app renders without throwing', () => {
  const { out } = run(`
    __out.ok = true;
    __out.cats = categories.length;
    __out.hasRenderAll = typeof renderAll === 'function';
  `);
  ok(out.ok, 'boot probe did not run');
  eq(out.hasRenderAll, true, 'renderAll missing');
  eq(out.cats, 3, 'default categories');
});

/* ── task CRUD through the DOM ───────────────────────────────────── */
section('task lifecycle (driven through the DOM)');

t('saveTask creates a task and persists it', () => {
  const { out } = run(`
    openTaskPanel();
    $('taskName').value = 'Write the report';
    saveTask();
    __out.count = tasks.length;
    __out.name  = tasks[0].name;
    __out.stored = JSON.parse(localStorage.getItem('do5_tasks')).length;
  `);
  eq(out.count, 1);
  eq(out.name, 'Write the report');
  eq(out.stored, 1, 'task was not persisted');
});

t('toggling done persists the change', () => {
  const { out } = run(`
    openTaskPanel(); $('taskName').value='T'; saveTask();
    const card = document.querySelector('[data-check]');
    card.dispatchEvent(new window.Event('click', {bubbles:true}));
    __out.done = tasks[0].done;
    __out.storedDone = JSON.parse(localStorage.getItem('do5_tasks'))[0].done;
  `);
  eq(out.done, true, 'in-memory not toggled');
  eq(out.storedDone, true, 'toggle was not persisted');
});

t('deleteTask removes and persists', () => {
  const { out } = run(`
    openTaskPanel(); $('taskName').value='T'; saveTask();
    deleteTask(tasks[0].id);
    __out.count = tasks.length;
    __out.stored = JSON.parse(localStorage.getItem('do5_tasks')).length;
  `);
  eq(out.count, 0);
  eq(out.stored, 0, 'delete was not persisted');
});

/* ── selection: the positional-indexOf bug ───────────────────────── */
section('panel selection maps to the right record');

t('category selection works when DOM order matches array order', () => {
  const { out } = run(`
    openTaskPanel();
    $('taskName').value='T';
    const items=[...$('catSelectGrid').children];
    items[1].dispatchEvent(new window.Event('click',{bubbles:true}));
    saveTask();
    __out.catId = tasks[0].catId;
    __out.expected = categories[1].id;
  `);
  eq(out.catId, out.expected, 'wrong category stored');
});

// The real bug: the old code read the selection by DOM position, so any
// reordering of the grid silently wrote the wrong id.
t('category selection survives the grid being reordered', () => {
  const { out } = run(`
    openTaskPanel();
    $('taskName').value='T';
    const grid=$('catSelectGrid');
    // move the last item to the front — DOM order no longer matches categories[]
    grid.insertBefore(grid.lastElementChild, grid.firstElementChild);
    const clicked=grid.children[0];               // this is categories[2]
    clicked.dispatchEvent(new window.Event('click',{bubbles:true}));
    saveTask();
    __out.catId = tasks[0].catId;
    __out.expected = categories[2].id;
  `);
  eq(out.catId, out.expected, 'selection read by DOM position, not by id');
});

t('project selection survives the grid being reordered', () => {
  const { out } = run(`
    projects.push({id:'p1',name:'Alpha',emoji:'🚀'},{id:'p2',name:'Beta',emoji:'📚'});
    openTaskPanel();
    $('taskName').value='T';
    const grid=$('taskProjGrid');
    grid.insertBefore(grid.lastElementChild, grid.firstElementChild);
    const clicked=grid.children[0];               // Beta (p2)
    clicked.dispatchEvent(new window.Event('click',{bubbles:true}));
    saveTask();
    __out.projectId = tasks[0].projectId;
  `);
  eq(out.projectId, 'p2', 'project selection read by DOM position, not by id');
});

t('"None" project option still stores null', () => {
  const { out } = run(`
    projects.push({id:'p1',name:'Alpha'});
    openTaskPanel();
    $('taskName').value='T';
    $('taskProjGrid').children[0].dispatchEvent(new window.Event('click',{bubbles:true}));
    saveTask();
    __out.projectId = tasks[0].projectId;
  `);
  eq(out.projectId, null);
});

/* ── colour pickers ──────────────────────────────────────────────── */
section('colour pickers');

t('all three pickers render the full palette', () => {
  const { out } = run(`
    openTaskPanel();
    openCalPanel();
    renderProjColorPicker();
    __out.task = $('colorPicker').children.length;
    __out.proj = $('projColorPicker').children.length;
    __out.evt  = $('calEvtColorPicker').children.length;
    __out.palette = PALETTE.length;
  `);
  eq(out.task, out.palette, 'task colour picker');
  eq(out.proj, out.palette, 'project colour picker');
  eq(out.evt, out.palette, 'cal-event colour picker');
});

t('clicking a swatch updates the picked colour and the picked class', () => {
  const { out } = run(`
    openTaskPanel();
    const sw=$('colorPicker').children[3];
    sw.dispatchEvent(new window.Event('click',{bubbles:true}));
    __out.picked = pickedColor;
    __out.expected = PALETTE[3];
    __out.pickedCount = $('colorPicker').querySelectorAll('.picked').length;
  `);
  eq(out.picked, out.expected, 'pickedColor not updated');
  eq(out.pickedCount, 1, 'exactly one swatch should carry .picked');
});

t('project picker click updates pickedProjColor only', () => {
  const { out } = run(`
    renderProjColorPicker();
    const before=pickedColor;
    $('projColorPicker').children[2].dispatchEvent(new window.Event('click',{bubbles:true}));
    __out.proj = pickedProjColor;
    __out.expected = PALETTE[2];
    __out.taskUnchanged = (pickedColor===before);
  `);
  eq(out.proj, out.expected);
  eq(out.taskUnchanged, true, 'task colour leaked');
});

t('cal-event picker click updates pickedEvtColor', () => {
  const { out } = run(`
    openCalPanel();
    $('calEvtColorPicker').children[4].dispatchEvent(new window.Event('click',{bubbles:true}));
    __out.evt = pickedEvtColor;
    __out.expected = PALETTE[4];
  `);
  eq(out.evt, out.expected);
});

/* ── calendar entry panel ────────────────────────────────────────── */
section('calendar entries');

t('saving an event persists it', () => {
  const { out } = run(`
    openCalPanel(null,'2026-07-05');
    setEventType('event');
    $('calEvtTitle').value='Dentist';
    saveCalEntry();
    __out.count = calEvents.length;
    __out.title = calEvents[0] && calEvents[0].title;
    __out.stored = JSON.parse(localStorage.getItem('do5_cal')).length;
  `);
  eq(out.count, 1);
  eq(out.title, 'Dentist');
  eq(out.stored, 1, 'event not persisted');
});

t('scheduling an existing task from the cal panel hits the right task', () => {
  const { out } = run(`
    tasks.push({id:'t1',name:'One',done:false,reps:[]},{id:'t2',name:'Two',done:false,reps:[]});
    openCalPanel(null,'2026-07-05');
    setEventType('task');
    $('calTaskDate').value='2026-07-09';
    const grid=$('calTaskGrid');
    grid.insertBefore(grid.lastElementChild, grid.firstElementChild);   // reorder
    grid.children[0].dispatchEvent(new window.Event('click',{bubbles:true}));  // Two
    saveCalEntry();
    __out.t1 = tasks.find(t=>t.id==='t1').scheduledDate || null;
    __out.t2 = tasks.find(t=>t.id==='t2').scheduledDate || null;
  `);
  eq(out.t2, '2026-07-09', 'wrong task scheduled');
  eq(out.t1, null, 'scheduled the wrong task too');
});

t('linking a project range from the cal panel hits the right project', () => {
  const { out } = run(`
    projects.push({id:'p1',name:'Alpha'},{id:'p2',name:'Beta'});
    openCalPanel(null,'2026-07-05');
    setEventType('project');
    const grid=$('calProjGrid');
    grid.insertBefore(grid.lastElementChild, grid.firstElementChild);   // reorder
    grid.children[0].dispatchEvent(new window.Event('click',{bubbles:true}));  // Beta
    $('calProjStart').value='2026-07-05';
    $('calProjEnd').value='2026-07-10';
    saveCalEntry();
    __out.projectId = calEvents[0] && calEvents[0].projectId;
  `);
  eq(out.projectId, 'p2', 'wrong project linked');
});

/* ── categories ──────────────────────────────────────────────────── */
section('categories');

t('adding a category persists it', () => {
  const { out } = run(`
    openTaskPanel();
    $('newCatName').value='Errands';
    $('addCatBtn').dispatchEvent(new window.Event('click',{bubbles:true}));
    __out.count = categories.length;
    __out.stored = JSON.parse(localStorage.getItem('do5_cats')).length;
  `);
  eq(out.count, 4);
  eq(out.stored, 4, 'new category not persisted');
});

/* ── summary ─────────────────────────────────────────────────────── */
console.log('\n' + '─'.repeat(52));
console.log(`${passed} passed, ${failed} failed`);
if (failed) {
  console.log('\nFailures:');
  fails.forEach(([n, m]) => console.log(`  • ${n}\n    ${m}`));
}
process.exit(failed ? 1 : 0);
