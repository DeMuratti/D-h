/* app.helpers.js — extracted from todo-app.html. Utilities, persistence, FAB + calendar-dropdown toggles. */

// ── HELPERS ─────────────────────────────────────────────────────
const uid=()=>Math.random().toString(36).slice(2,10);
const $=id=>document.getElementById(id);
const getCat=id=>categories.find(c=>c.id===id);
const getProj=id=>projects.find(p=>p.id===id);
function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
// Dates now go through DoTime (see do-time.js) so they are read in the user's
// own timezone. The old versions used toISOString(), which reads UTC — that
// shifted every calendar cell and every scheduled slot one day earlier.
const dateStr=d=>DoTime.dayKey(d);
const today=()=>DoTime.today();
const fmtDate=s=>DoTime.fmtDay(s);
const fmtTime=t=>DoTime.fmtTime(t);

// ── PERSIST ─────────────────────────────────────────────────────
// Persistence goes through DoStore (see do-store.js). The app no longer knows
// or cares where data lives — swapping localStorage for a server later is one
// line: DoStore.use(new ApiAdapter(...)).
// save() re-reads the globals each call, so the few places that reassign
// (e.g. tasks = tasks.filter(...)) keep working.
function save(){return DoStore.saveAll({tasks,categories,projects,calEvents});}
function load(){
  const s=DoStore.load();
  tasks=s.tasks;categories=s.categories;projects=s.projects;calEvents=s.calEvents;
}

// ── BACKUP ───────────────────────────────────────────────────────────────
// localStorage is not durable: browsers evict it under storage pressure. These
// give the user a file they own.
function exportData(){
  try{
    const json=DoStore.exportJSON({tasks,categories,projects,calEvents});
    const url=URL.createObjectURL(new Blob([json],{type:'application/json'}));
    const a=document.createElement('a');
    a.href=url;a.download=`do-backup-${today()}.json`;
    document.body.appendChild(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  }catch(e){alert('Could not create the backup: '+e.message);}
}
function handleImportFile(ev){
  const file=ev.target.files&&ev.target.files[0];
  ev.target.value='';                       // let the same file be picked again
  if(!file)return;
  const reader=new FileReader();
  reader.onload=()=>{
    let state;
    try{state=DoStore.parseBackup(String(reader.result));}
    catch(e){alert('Could not read that backup: '+e.message);return;}
    const msg=`Restore ${state.tasks.length} task(s), ${state.projects.length} project(s) and `
             +`${state.calEvents.length} calendar entr(ies)?\n\nThis replaces everything currently in the app.`;
    if(!confirm(msg))return;
    Store.update(()=>{tasks=state.tasks;categories=state.categories;projects=state.projects;calEvents=state.calEvents;});
  };
  reader.onerror=()=>alert('Could not read that file.');
  reader.readAsText(file);
}

function updateDate(){$('datePill').textContent=new Date().toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'});}
function initCal(){const n=new Date();calYear=n.getFullYear();calMonth=n.getMonth();}

// ── FAB MENU ─────────────────────────────────────────────────────
let fabOpen=false;
function toggleFab(){
  fabOpen=!fabOpen;
  $('fabMenu').classList.toggle('open',fabOpen);
  $('fabBtn').classList.toggle('open',fabOpen);
}
function closeFab(){fabOpen=false;$('fabMenu').classList.remove('open');$('fabBtn').classList.remove('open');}
function fabOpenTaskPanel(){closeFab();openTaskPanel();}
function fabOpenProjectPanel(){closeFab();openProjectPanel();}
function fabOpenCalPanel(){closeFab();openCalPanel(null,selectedDate||today());}
function fabBackup(){closeFab();exportData();}
function fabRestore(){closeFab();$('importFile').click();}
// ── CALENDAR DROPDOWN ───────────────────────────────────────────
function toggleCalDropdown(){
  calOpen=!calOpen;
  $('calDropdown').classList.toggle('open',calOpen);
  $('calChevron').classList.toggle('open',calOpen);
  $('calToggleBtn').classList.toggle('active',calOpen);
}

