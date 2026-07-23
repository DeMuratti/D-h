/* app.config.js — extracted from todo-app.html. Constants + mutable app state (shared globally). */

// ── CONSTANTS ───────────────────────────────────────────────────
const PALETTE=['#C4754A','#4A8A6C','#5A7EB5','#9B5CB5','#B5925C','#B55C5C','#5CB5A8'];
const PROJ_EMOJIS=['📋','🎯','💡','🚀','📚','🎨','💼','🔧','🌱','⚡','🏆','📝','🔬','🎵','🏗️'];
const WEEKDAYS=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

// ▶▶ PASTE YOUR CLOUDFLARE WORKER URL HERE after deploying worker.js ◀◀
const AI_PROXY_URL = 'https://do-app-proxy.timo-deliere.workers.dev';

// ── STATE ───────────────────────────────────────────────────────
let categories=[{id:'work',name:'Work',color:'#5A7EB5'},{id:'personal',name:'Personal',color:'#4A8A6C'},{id:'health',name:'Health',color:'#C4754A'}];
let projects=[],tasks=[],calEvents=[];
let filterCat='all';
let calYear,calMonth,selectedDate=null;
let calOpen=false;
let editingTaskId=null,editingProjId=null,editingCalId=null;
let panelRepCount=0;
let pickedColor=PALETTE[0],pickedProjColor=PALETTE[1],pickedEvtColor=PALETTE[2];
let pickedEmoji=PROJ_EMOJIS[0];
let taskPanelProjectId=null,calEventType='event';

