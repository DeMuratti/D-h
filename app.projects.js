/* app.projects.js — extracted from todo-app.html. Project panel, planner controls, schedule algorithm + preview/commit. */

// ── PROJECT PANEL ────────────────────────────────────────────────
const PROJ_STYLES=[
  {id:'gym',      label:'Gym',       icon:'🏋️', color:'#C44A4A', restGap:1},
  {id:'nutrition',label:'Nutrition', icon:'🥗', color:'#4A8A6C', restGap:0},
  {id:'school',   label:'School',    icon:'📚', color:'#5A7EB5', restGap:0},
  {id:'business', label:'Business',  icon:'💼', color:'#B5925C', restGap:0},
  {id:'creative', label:'Creative',  icon:'🎨', color:'#9B5CB5', restGap:0},
  {id:'sport',    label:'Sport',     icon:'⚽', color:'#C4754A', restGap:1},
  {id:'health',   label:'Health',    icon:'🧘', color:'#5CB5A8', restGap:0},
  {id:'personal', label:'Personal',  icon:'✨', color:'#B55C5C', restGap:0},
  {id:'other',    label:'Other',     icon:'🗂️', color:'#8A8070', restGap:0},
];
let pickedStyle=null;
let poolTasks=[]; // [{id,name,intensity,priority}]
let plannerSessions=3, plannerWeeks=6;
let plannerActiveDays=new Set([1,3,5]); // Mon,Wed,Fri default
let builtSchedule=[]; // [{date,taskId,taskName,intensity,priority}]

function renderStyleGrid(){
  const grid=$('projStyleGrid');grid.innerHTML='';
  PROJ_STYLES.forEach(s=>{
    const btn=document.createElement('button');
    btn.className='proj-style-item'+(pickedStyle===s.id?' selected':'');
    if(pickedStyle===s.id) btn.style.cssText=`border-color:${s.color};background:${s.color}18`;
    btn.innerHTML=`<span class="proj-style-icon">${s.icon}</span>${s.label}`;
    btn.onclick=()=>{
      pickedStyle=s.id;
      // Auto-set color to match style
      pickedProjColor=s.color;
      renderStyleGrid();renderProjColorPicker();
      updatePlannerVisibility();
    };
    grid.appendChild(btn);
  });
}

function updatePlannerVisibility(){
  // Show the planner build section only when there are pool tasks
  $('plannerWrap').style.display=poolTasks.length>=2?'':'none';
}

function addPoolTask(name='',intensity=3,priority=3){
  const t={id:uid(),name,intensity,priority};
  poolTasks.push(t);
  renderPoolTask(t);
  updatePlannerVisibility();
}

function renderAllPoolTasks(){
  const container=$('projTaskPool');container.innerHTML='';
  poolTasks.forEach(t=>renderPoolTask(t,false));
}

function renderPoolTask(task, append=true){
  const container=$('projTaskPool');
  const row=document.createElement('div');row.className='pool-task-row';row.dataset.pid=task.id;
  const INTENSITY_LABELS=['','Rest','Easy','Moderate','Hard','Max'];
  const PRIORITY_LABELS=['','Nice','Useful','Important','Key','Critical'];
  const INTENSITY_COLORS=['','#8A8070','#4A8A6C','#5A7EB5','#C4754A','#C44A4A'];
  const PRIORITY_COLORS=['','#8A8070','#5CB5A8','#9B5CB5','#C4754A','#C44A4A'];
  row.innerHTML=`
    <div class="pool-task-main">
      <input class="pool-task-name-input" type="text" placeholder="Task name…" value="${esc(task.name)}" maxlength="80" data-field="name">
      <div class="pool-task-ratings">
        <div class="pool-rating-group">
          <div class="pool-rating-label">🔥 Intensity <span class="pool-rating-val" id="ival_${task.id}">${INTENSITY_LABELS[task.intensity]}</span></div>
          <div class="pool-rating-track" id="itrack_${task.id}">
            ${[1,2,3,4,5].map(v=>`<button class="pool-rating-pip" data-v="${v}" data-type="intensity" style="background:${v<=task.intensity?INTENSITY_COLORS[task.intensity]:''}" title="${INTENSITY_LABELS[v]}"></button>`).join('')}
          </div>
        </div>
        <div class="pool-rating-group">
          <div class="pool-rating-label">⭐ Priority <span class="pool-rating-val" id="pval_${task.id}">${PRIORITY_LABELS[task.priority]}</span></div>
          <div class="pool-rating-track" id="ptrack_${task.id}">
            ${[1,2,3,4,5].map(v=>`<button class="pool-rating-pip" data-v="${v}" data-type="priority" style="background:${v<=task.priority?PRIORITY_COLORS[task.priority]:''}" title="${PRIORITY_LABELS[v]}"></button>`).join('')}
          </div>
        </div>
      </div>
    </div>
    <button class="pool-task-del" data-del="${task.id}">✕</button>`;

  // Name input
  row.querySelector('[data-field="name"]').oninput=e=>{
    const t=poolTasks.find(x=>x.id===task.id);if(t)t.name=e.target.value;
  };

  // Rating pips
  row.querySelectorAll('.pool-rating-pip').forEach(pip=>{
    pip.onclick=()=>{
      const t=poolTasks.find(x=>x.id===task.id);if(!t)return;
      const v=parseInt(pip.dataset.v),type=pip.dataset.type;
      if(type==='intensity'){
        t.intensity=v;
        row.querySelectorAll('[data-type="intensity"]').forEach(p=>{p.style.background=parseInt(p.dataset.v)<=v?INTENSITY_COLORS[v]:'';});
        $(`ival_${task.id}`).textContent=INTENSITY_LABELS[v];
      } else {
        t.priority=v;
        row.querySelectorAll('[data-type="priority"]').forEach(p=>{p.style.background=parseInt(p.dataset.v)<=v?PRIORITY_COLORS[v]:'';});
        $(`pval_${task.id}`).textContent=PRIORITY_LABELS[v];
      }
    };
  });

  // Delete
  row.querySelector('[data-del]').onclick=()=>{
    poolTasks=poolTasks.filter(x=>x.id!==task.id);
    row.remove();updatePlannerVisibility();
  };

  if(append) container.appendChild(row);
  else container.appendChild(row);
}

// ── PLANNER DAY BUTTONS ──────────────────────────────────────────
document.querySelectorAll('.planner-day-btn').forEach(btn=>{
  btn.onclick=()=>{
    const d=parseInt(btn.dataset.pday);
    if(plannerActiveDays.has(d)){plannerActiveDays.delete(d);btn.classList.remove('active');}
    else{plannerActiveDays.add(d);btn.classList.add('active');}
  };
});
// Set defaults active
document.querySelectorAll('.planner-day-btn').forEach(b=>{
  if(plannerActiveDays.has(parseInt(b.dataset.pday)))b.classList.add('active');
});

$('plannerSessionsPlus').onclick=()=>{if(plannerSessions<7){plannerSessions++;$('plannerSessionsNum').textContent=plannerSessions;}};
$('plannerSessionsMinus').onclick=()=>{if(plannerSessions>1){plannerSessions--;$('plannerSessionsNum').textContent=plannerSessions;}};
$('plannerWeeksPlus').onclick=()=>{if(plannerWeeks<52){plannerWeeks++;$('plannerWeeksNum').textContent=plannerWeeks;}};
$('plannerWeeksMinus').onclick=()=>{if(plannerWeeks>1){plannerWeeks--;$('plannerWeeksNum').textContent=plannerWeeks;}};

// ── SCHEDULE ALGORITHM ────────────────────────────────────────────
function buildSchedule(){
  const validTasks=poolTasks.filter(t=>t.name.trim());
  if(!validTasks.length){alert('Add at least one named task to the pool first.');return;}
  if(!plannerActiveDays.size){alert('Select at least one preferred day.');return;}

  const style=PROJ_STYLES.find(s=>s.id===pickedStyle)||PROJ_STYLES[8];
  const restGap=style.restGap; // min rest days between high-intensity tasks (intensity>=4)
  const activeDaysArr=[...plannerActiveDays].sort((a,b)=>a-b);

  // Build a pool sorted by priority desc, then weight by priority for pick frequency
  // Weight: priority 5→5 chances, 4→3, 3→2, 2→1, 1→0.5 (rounded)
  const weightedPool=[];
  validTasks.forEach(t=>{
    const w=Math.max(1,Math.round([0,1,1,2,3,5][t.priority]||1));
    for(let i=0;i<w;i++) weightedPool.push(t);
  });

  const schedule=[];
  const startDate=new Date();startDate.setHours(0,0,0,0);
  // Hard deadline cap — slots cannot go past it
  const deadlineStr=$('projDeadlineStep2')?.value||$('projDeadlineInput')?.value||null;
  const deadlineCap=deadlineStr?new Date(deadlineStr+'T00:00:00'):null;
  // Collect all preferred day-slots for the duration
  const slots=[];
  for(let w=0;w<plannerWeeks;w++){
    for(const dow of activeDaysArr){
      // Find next occurrence of this dow from start of this week
      const weekStart=new Date(startDate);weekStart.setDate(weekStart.getDate()+w*7);
      // Align to Monday of that week
      const mondayOffset=(weekStart.getDay()+6)%7;
      weekStart.setDate(weekStart.getDate()-mondayOffset);
      const slotDate=new Date(weekStart);
      slotDate.setDate(slotDate.getDate()+((dow+6)%7)); // convert dow (0=Sun) to Mon-based offset
      if(slotDate>=startDate&&(!deadlineCap||slotDate<=deadlineCap)) slots.push(dateStr(slotDate));
    }
  }
  // Dedupe and sort
  const uniqueSlots=[...new Set(slots)].sort();
  // Limit to sessions-per-week * weeks
  const maxSlots=plannerSessions*plannerWeeks;
  const chosenSlots=uniqueSlots.slice(0,maxSlots);

  // Assign tasks respecting rest-gap rule
  let lastHighIntensityDate=null;
  let lastUsedTaskId=null;
  const taskUsageCounts={};validTasks.forEach(t=>{taskUsageCounts[t.id]=0;});

  chosenSlots.forEach(ds=>{
    // Filter out tasks that violate rest-gap
    let candidates=[...validTasks];
    if(lastHighIntensityDate&&restGap>0){
      const daysDiff=DoTime.diffDays(lastHighIntensityDate,ds);
      if(daysDiff<=restGap){
        // Exclude high-intensity tasks
        candidates=candidates.filter(t=>t.intensity<4);
        if(!candidates.length) candidates=validTasks.filter(t=>t.intensity<4);
        if(!candidates.length) candidates=validTasks; // fallback
      }
    }
    // Avoid repeating same task back-to-back
    if(candidates.length>1) candidates=candidates.filter(t=>t.id!==lastUsedTaskId);

    // Pick from weighted pool filtered to candidates
    const pool=weightedPool.filter(t=>candidates.find(c=>c.id===t.id));
    // Bias toward least-used
    pool.sort((a,b)=>(taskUsageCounts[a.id]||0)-(taskUsageCounts[b.id]||0));
    // Pick with some randomness: pick randomly from bottom third by usage
    const pickPool=pool.slice(0,Math.max(1,Math.ceil(pool.length/2)));
    const picked=pickPool[Math.floor(Math.random()*pickPool.length)];

    schedule.push({date:ds,taskId:picked.id,taskName:picked.name,intensity:picked.intensity,priority:picked.priority});
    taskUsageCounts[picked.id]=(taskUsageCounts[picked.id]||0)+1;
    lastUsedTaskId=picked.id;
    if(picked.intensity>=4) lastHighIntensityDate=ds;
  });

  builtSchedule=schedule;
  showSchedPreview(schedule);
}

// ── SCHEDULE PREVIEW ─────────────────────────────────────────────
function showSchedPreview(schedule){
  const proj=editingProjId?getProj(editingProjId):{name:$('projName').value||'Project',color:pickedProjColor,emoji:pickedEmoji};
  $('schedModalTitle').textContent=`${proj.emoji||'📋'} ${esc(proj.name)} — Schedule`;
  $('schedModalSub').textContent=`${schedule.length} sessions · ${plannerWeeks} weeks`;

  const body=$('schedModalBody');body.innerHTML='';
  const INTENSITY_LABELS=['','Rest','Easy','Moderate','Hard','Max'];
  const PRIORITY_LABELS=['','Nice','Useful','Important','Key','Critical'];
  const DAY_SHORT=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

  // Group by week
  const weeks={};
  schedule.forEach((s,i)=>{
    const d=new Date(s.date+'T00:00:00');
    const weekNum=Math.floor(i/plannerSessions)+1;
    // Use actual ISO week for grouping
    const monday=new Date(d);monday.setDate(d.getDate()-((d.getDay()+6)%7));
    const wk=dateStr(monday);
    if(!weeks[wk])weeks[wk]=[];
    weeks[wk].push({...s,idx:i});
  });

  Object.entries(weeks).forEach(([wk,days],wi)=>{
    const block=document.createElement('div');block.className='sched-week';
    const monday=new Date(wk+'T00:00:00');
    block.innerHTML=`<div class="sched-week-label">Week ${wi+1} — ${monday.toLocaleDateString('en-GB',{day:'numeric',month:'short'})}</div>`;
    days.forEach(s=>{
      const d=new Date(s.date+'T00:00:00');
      const row=document.createElement('div');row.className='sched-day-row';
      const iColor=['','#8A8070','#4A8A6C','#5A7EB5','#C4754A','#C44A4A'][s.intensity];
      row.innerHTML=`
        <div class="sched-day-dot" style="background:${proj.color||iColor}"></div>
        <span class="sched-day-name">${DAY_SHORT[d.getDay()]}</span>
        <span class="sched-day-task">${esc(s.taskName)}</span>
        <div class="sched-day-badges">
          <span class="sched-badge sched-badge-intensity">${INTENSITY_LABELS[s.intensity]}</span>
          <span class="sched-badge sched-badge-priority">${PRIORITY_LABELS[s.priority]}</span>
        </div>
        <button class="sched-swap-btn" data-sidx="${s.idx}" title="Swap task">⇄</button>`;
      row.querySelector('[data-sidx]').onclick=()=>swapScheduleTask(s.idx);
      block.appendChild(row);
    });
    body.appendChild(block);
  });

  $('schedModal').style.display='flex';
}

function swapScheduleTask(idx){
  const s=builtSchedule[idx];
  const validTasks=poolTasks.filter(t=>t.name.trim());
  if(validTasks.length<2)return;
  // Pick a different task
  const others=validTasks.filter(t=>t.id!==s.taskId);
  const next=others[Math.floor(Math.random()*others.length)];
  builtSchedule[idx]={...s,taskId:next.id,taskName:next.name,intensity:next.intensity,priority:next.priority};
  showSchedPreview(builtSchedule);
}

function closeSchedModal(){$('schedModal').style.display='none';}

function commitSchedule(){
  const name=$('projName').value.trim();
  if(!name){closeSchedModal();$('projName').style.borderColor='var(--danger)';$('projName').focus();return;}
  const deadline=$('projDeadlineStep2').value||$('projDeadlineInput')?.value||null;
  const plan=window._pendingPlan||{};
  let projId=editingProjId;
  if(!projId){
    projId=uid();
    projects.push({id:projId,name,desc:$('projDesc').value.trim(),emoji:pickedEmoji,color:pickedProjColor,style:pickedStyle,pool:poolTasks,deadline,successRate:plan.successRate??null,successLabel:plan.successLabel||null,createdAt:Date.now()});
  } else {
    const p=getProj(projId);
    p.name=name;p.desc=$('projDesc').value.trim();p.emoji=pickedEmoji;p.color=pickedProjColor;p.style=pickedStyle;p.pool=poolTasks;p.deadline=deadline;p.successRate=plan.successRate??null;p.successLabel=plan.successLabel||null;
  }
  Store.update(()=>{
    builtSchedule.forEach(s=>{
      tasks.unshift({id:uid(),name:s.taskName,desc:'',catId:null,projectId:projId,scheduledDate:s.date,timeStart:null,timeEnd:null,reps:[],done:false,createdAt:Date.now(),fromPlanner:true});
    });
  });
  closeSchedModal();closeProjectPanel();
}

