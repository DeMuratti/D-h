/* app.panels.js — extracted from todo-app.html. Calendar-entry panel + task panel (open/close/save). */

// ── CAL PANEL ────────────────────────────────────────────────────
function setEventType(type){
  calEventType=type;
  document.querySelectorAll('.event-type-tab').forEach(t=>t.classList.toggle('active',t.dataset.etype===type));
  $('calEventFields').style.display=type==='event'?'':'none';
  $('calTaskFields').style.display=type==='task'?'':'none';
  $('calProjFields').style.display=type==='project'?'':'none';
}

function openCalPanel(id=null,forDate=null){
  editingCalId=id;
  const ev=id?calEvents.find(e=>e.id===id):null;
  $('calPanelTitle').textContent=id?'Edit Entry':'New Entry';
  const type=ev?.type||'event';calEventType=type;setEventType(type);
  $('calEvtTitle').value=ev?.title||'';
  $('calEvtNotes').value=ev?.notes||'';
  $('calEvtDate').value=ev?.date||forDate||today();
  $('calEvtStart').value=ev?.startTime||'';
  $('calEvtEnd').value=ev?.endTime||'';
  pickedEvtColor=ev?.color||PALETTE[2];renderCalEvtColor();
  $('calTaskDate').value=forDate||today();
  renderCalTaskGrid(ev?.taskId||null);
  renderCalProjGrid(ev?.projectId||null);
  $('calProjStart').value=ev?.startDate||forDate||today();
  $('calProjEnd').value=ev?.endDate||forDate||today();
  $('calNewTaskName').value='';
  $('calPanelFooter').innerHTML=id
    ?`<button class="btn btn-danger" id="delCalBtn">Delete</button><button class="btn btn-ghost" onclick="closeCalPanel()">Cancel</button><button class="btn btn-primary" onclick="saveCalEntry()">Save</button>`
    :`<button class="btn btn-ghost" onclick="closeCalPanel()">Cancel</button><button class="btn btn-primary" onclick="saveCalEntry()">Save</button>`;
  if(id)$('delCalBtn').onclick=()=>{delCalEv(id);closeCalPanel();};
  openOverlay();$('calPanel').classList.add('open');
}
function closeCalPanel(){$('calPanel').classList.remove('open');closeOverlay();editingCalId=null;}
function renderCalEvtColor(){renderSwatches($('calEvtColorPicker'),PALETTE,pickedEvtColor,c=>{pickedEvtColor=c;});}
function renderCalTaskGrid(selId){
  renderSelectGrid($('calTaskGrid'),tasks.filter(t=>!t.done),{
    selectedId:selId||null,
    itemClass:'proj-select-item',
    label:t=>esc(t.name),
  });
}
function renderCalProjGrid(selId){
  renderSelectGrid($('calProjGrid'),projects,{
    selectedId:selId||null,
    itemClass:'proj-range-item',
    label:p=>`${p.emoji||'📋'} ${esc(p.name)}`,
  });
}

function saveCalEntry(){
  const type=calEventType;
  if(type==='event'){
    const title=$('calEvtTitle').value.trim();
    if(!title){$('calEvtTitle').style.borderColor='var(--danger)';$('calEvtTitle').focus();return;}
    $('calEvtTitle').style.borderColor='';
    upsertCalEv({id:editingCalId||uid(),type:'event',title,notes:$('calEvtNotes').value.trim(),date:$('calEvtDate').value||today(),startTime:$('calEvtStart').value,endTime:$('calEvtEnd').value,color:pickedEvtColor});
  } else if(type==='task'){
    const date=$('calTaskDate').value||selectedDate||today();
    const taskId=getSelectedId($('calTaskGrid'));
    const newName=$('calNewTaskName').value.trim();
    const existing=taskId?tasks.find(t=>t.id===taskId):null;
    if(existing){Store.update(()=>{existing.scheduledDate=date;});}
    else if(newName){Store.update(()=>{tasks.unshift({id:uid(),name:newName,desc:'',catId:null,projectId:null,reps:[],done:false,scheduledDate:date,createdAt:Date.now()});});}
    closeCalPanel();return;
  } else if(type==='project'){
    const projectId=getSelectedId($('calProjGrid'));
    if(!projectId){$('calProjGrid').style.outline='2px solid var(--danger)';setTimeout(()=>$('calProjGrid').style.outline='',1500);return;}
    const proj=getProj(projectId);if(!proj)return;
    const start=$('calProjStart').value||today(),end=$('calProjEnd').value||start;
    upsertCalEv({id:editingCalId||uid(),type:'project',projectId:proj.id,startDate:start,endDate:end<start?start:end});
  }
  closeCalPanel();
}
function upsertCalEv(ev){Store.update(()=>{const i=calEvents.findIndex(e=>e.id===ev.id);if(i>=0)calEvents[i]=ev;else calEvents.push(ev);});}

// ── TASK PANEL ───────────────────────────────────────────────────
function openTaskPanel(id=null,forProjId=null){
  editingTaskId=id;taskPanelProjectId=forProjId;
  const task=id?tasks.find(t=>t.id===id):null;
  $('taskPanelTitle').textContent=id?'Edit Task':'New Task';
  $('taskName').value=task?.name||'';$('taskDesc').value=task?.desc||'';
  $('taskDate').value=task?.scheduledDate||selectedDate||'';
  $('taskTimeStart').value=task?.timeStart||'';
  $('taskTimeEnd').value=task?.timeEnd||'';
  $('taskReadinessMin').value=task?.readinessMin||0;
  updateReadinessSlider();
  panelRepCount=task?.reps?.length||0;
  resetRecurUI();
  renderPanelCats(task?.catId||null);renderPanelProjects(task?.projectId||forProjId||null);
  renderColorPicker();updateRepPreview();
  $('taskPanelFooter').innerHTML=id
    ?`<button class="btn btn-danger" id="delTaskBtn">Delete</button><button class="btn btn-ghost" onclick="closeTaskPanel()">Cancel</button><button class="btn btn-primary" onclick="saveTask()">Save</button>`
    :`<button class="btn btn-ghost" onclick="closeTaskPanel()">Cancel</button><button class="btn btn-primary" onclick="saveTask()">Save Task</button>`;
  if(id)$('delTaskBtn').onclick=()=>{deleteTask(id);closeTaskPanel();};
  openOverlay();$('taskPanel').classList.add('open');setTimeout(()=>$('taskName').focus(),350);
}
function closeTaskPanel(){$('taskPanel').classList.remove('open');closeOverlay();editingTaskId=null;taskPanelProjectId=null;}
function saveTask(){
  const name=$('taskName').value.trim();if(!name){$('taskName').style.borderColor='var(--danger)';$('taskName').focus();return;}$('taskName').style.borderColor='';
  const desc=$('taskDesc').value.trim();
  const scheduledDate=$('taskDate').value||null;
  const timeStart=$('taskTimeStart').value||null;
  const timeEnd=$('taskTimeEnd').value||null;
  const readinessMin=parseInt($('taskReadinessMin').value)||0;
  const catId=getSelectedId($('catSelectGrid'));
  const projectId=getSelectedId($('taskProjGrid'));   // the "None" option reads back as null

  // Recurring — create one task per occurrence
  if($('recurEnabled').checked&&!editingTaskId){
    const dates=getRecurDates();
    if(!dates.length){$('recurPreview').style.outline='2px solid var(--danger)';setTimeout(()=>$('recurPreview').style.outline='',1500);return;}
    Store.update(()=>{
      dates.forEach(d=>{
        tasks.unshift({id:uid(),name,desc,catId,projectId,scheduledDate:d,timeStart,timeEnd,readinessMin,reps:Array(panelRepCount).fill(false),done:false,recurring:true,createdAt:Date.now()});
      });
    });
    closeTaskPanel();
    return;
  }

  Store.update(()=>{
    if(editingTaskId){
      const t=tasks.find(x=>x.id===editingTaskId);
      if(panelRepCount!==t.reps.length){const old=t.reps;t.reps=Array.from({length:panelRepCount},(_,i)=>old[i]??false);}
      t.name=name;t.desc=desc;t.catId=catId;t.projectId=projectId;t.scheduledDate=scheduledDate;t.timeStart=timeStart;t.timeEnd=timeEnd;t.readinessMin=readinessMin;
      t.done=t.reps.length>0?t.reps.every(Boolean):t.done;
    } else {
      tasks.unshift({id:uid(),name,desc,catId,projectId,scheduledDate,timeStart,timeEnd,readinessMin,reps:Array(panelRepCount).fill(false),done:false,createdAt:Date.now()});
    }
  });
  closeTaskPanel();
}
function deleteTask(id){Store.update(()=>{tasks=tasks.filter(t=>t.id!==id);});}

