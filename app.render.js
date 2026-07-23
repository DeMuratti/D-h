/* app.render.js — extracted from todo-app.html. View layer: all render* functions + buildCard. renderAll() relocated here from its original position for cohesion (pure fn, load order unaffected). */

// ── CALENDAR RENDER ─────────────────────────────────────────────
function renderCalendar(){
  // Update nav label in both header bar and dropdown
  const lbl=new Date(calYear,calMonth,1).toLocaleDateString('en-GB',{month:'long',year:'numeric'});
  $('calMonthLabel').textContent=lbl;

  const wdEl=$('calWeekdays');wdEl.innerHTML='';
  WEEKDAYS.forEach(d=>{const el=document.createElement('div');el.className='cal-wd';el.textContent=d;wdEl.appendChild(el);});

  const grid=$('calGrid');grid.innerHTML='';
  const firstDay=new Date(calYear,calMonth,1);
  const startDow=(firstDay.getDay()+6)%7;
  const daysInMonth=new Date(calYear,calMonth+1,0).getDate();
  const daysInPrev=new Date(calYear,calMonth,0).getDate();
  const td=today();
  const rows=Math.ceil((startDow+daysInMonth)/7);

  for(let i=0;i<rows*7;i++){
    const cell=document.createElement('div');cell.className='cal-day';
    let ds;
    if(i<startDow){
      const d=daysInPrev-startDow+i+1;ds=dateStr(new Date(calYear,calMonth-1,d));
      cell.classList.add('other-month');cell.innerHTML=`<div class="cal-day-num">${d}</div>`;
    } else if(i<startDow+daysInMonth){
      const d=i-startDow+1;ds=dateStr(new Date(calYear,calMonth,d));
      if(ds===td)cell.classList.add('today');
      if(ds===selectedDate)cell.classList.add('selected');
      const dots=[];
      calEvents.forEach(ev=>{
        if(ev.type==='event'&&ev.date===ds)dots.push(ev.color||PALETTE[2]);
        if(ev.type==='project'&&ev.startDate<=ds&&ds<=ev.endDate){const pr=getProj(ev.projectId);if(pr)dots.push(pr.color);}
      });
      tasks.forEach(t=>{if(t.scheduledDate===ds)dots.push('#4A8A6C');});
      const pBars=calEvents.filter(ev=>ev.type==='project'&&ev.startDate<=ds&&ds<=ev.endDate);
      cell.innerHTML=`<div class="cal-day-num">${d}</div><div class="cal-day-dots">${dots.slice(0,4).map(c=>`<div class="cal-dot" style="background:${c}"></div>`).join('')}</div>${pBars.slice(0,2).map(ev=>{const pr=getProj(ev.projectId);return`<div class="cal-proj-bar" style="background:${pr?.color||PALETTE[1]}66"></div>`;}).join('')}`;
      cell.onclick=()=>selectDate(ds);
    } else {
      const d=i-startDow-daysInMonth+1;ds=dateStr(new Date(calYear,calMonth+1,d));
      cell.classList.add('other-month');cell.innerHTML=`<div class="cal-day-num">${d}</div>`;
    }
    grid.appendChild(cell);
  }
}

function selectDate(ds){
  selectedDate=ds;
  // Close dropdown after picking
  calOpen=false;$('calDropdown').classList.remove('open');$('calChevron').classList.remove('open');$('calToggleBtn').classList.remove('active');
  renderCalendar();
  renderDayPanel(ds);
  renderMainTasks();
}

// ── PROJECT STRIP ────────────────────────────────────────────────
function renderProjStrip(){
  const strip=$('projStrip');strip.innerHTML='';
  if(projects.length===0){strip.innerHTML='<div class="proj-strip-empty">No projects yet</div>';return;}
  const td=today();
  projects.forEach(proj=>{
    const pt=tasks.filter(t=>t.projectId===proj.id);
    const total=pt.length,dc=pt.filter(t=>t.done).length;
    const pct=total>0?Math.round(dc/total*100):0;
    const allDone=total>0&&dc===total;
    // Deadline info
    let deadlineStr='';
    if(proj.deadline){
      const daysLeft=DoTime.diffDays(td,proj.deadline);
      if(allDone) deadlineStr='';
      else if(daysLeft<0) deadlineStr=`<span style="font-size:10px;color:var(--danger);font-weight:500">Overdue ${Math.abs(daysLeft)}d</span>`;
      else if(daysLeft===0) deadlineStr=`<span style="font-size:10px;color:var(--accent);font-weight:500">Due today</span>`;
      else deadlineStr=`<span style="font-size:10px;color:var(--text-muted)">🎯 ${daysLeft}d left</span>`;
    }
    // Success rate badge
    let rateStr='';
    if(proj.successRate!=null&&!allDone){
      const c=proj.successRate>=90?'#4A8A6C':proj.successRate>=70?'#5A7EB5':proj.successRate>=50?'#C4754A':'#C44A4A';
      rateStr=`<span style="font-size:10px;font-weight:600;color:${c};background:${c}18;padding:1px 6px;border-radius:5px;border:1px solid ${c}33">${proj.successRate}%</span>`;
    }
    const row=document.createElement('div');row.className='proj-bar-row';
    row.innerHTML=`
      <span class="proj-bar-icon">${proj.emoji||'📋'}</span>
      <div class="proj-bar-body">
        <div class="proj-bar-top">
          <span class="proj-bar-name">${esc(proj.name)}</span>
          <div style="display:flex;align-items:center;gap:5px;flex-shrink:0;margin-left:8px">
            ${rateStr}${deadlineStr}
            <span class="proj-bar-pct">${allDone?'✓ Done':`${dc}/${total||'–'} · ${pct}%`}</span>
          </div>
        </div>
        <div class="proj-bar-track"><div class="proj-bar-fill" style="width:${pct}%;background:linear-gradient(90deg,${proj.color},${proj.color}99)"></div></div>
      </div>
      <button class="task-edit-btn" data-ep="${proj.id}" style="flex-shrink:0">✎</button>`;
    row.querySelector('[data-ep]').onclick=e=>{e.stopPropagation();openProjectPanel(proj.id);};
    row.onclick=e=>{if(e.target.closest('[data-ep]'))return;openProjectPanel(proj.id);};
    strip.appendChild(row);
  });
}

// ── DAY PANEL ────────────────────────────────────────────────────
function renderDayPanel(ds){
  $('dayPanelDate').textContent=ds===today()?'Today':fmtDate(ds);
  $('dayPanelSub').textContent=ds===today()?'Schedule & events':fmtDate(ds)+' · schedule';
  const body=$('dayPanelBody');body.innerHTML='';

  // Project spans
  const spans=calEvents.filter(ev=>ev.type==='project'&&ev.startDate<=ds&&ds<=ev.endDate);
  spans.forEach(ev=>{
    const proj=getProj(ev.projectId);if(!proj)return;
    const el=document.createElement('div');el.className='cal-proj-span';
    el.style.cssText=`background:${proj.color}16;border:1.5px solid ${proj.color}33`;
    el.innerHTML=`<span class="cal-proj-span-icon">${proj.emoji||'📋'}</span><div class="cal-proj-span-body"><div class="cal-proj-span-name">${esc(proj.name)}</div><div class="cal-proj-span-meta" style="color:${proj.color}">${fmtDate(ev.startDate)} – ${fmtDate(ev.endDate)}</div></div><button class="cal-event-del" data-del="${ev.id}">✕</button>`;
    el.querySelector('[data-del]').onclick=e=>{e.stopPropagation();delCalEv(ev.id);};
    body.appendChild(el);
  });

  // Events
  const evts=calEvents.filter(ev=>ev.type==='event'&&ev.date===ds).sort((a,b)=>(a.startTime||'').localeCompare(b.startTime||''));
  evts.forEach(ev=>{
    const el=document.createElement('div');el.className='cal-event';
    const ts=ev.startTime?`${fmtTime(ev.startTime)}${ev.endTime?` – ${fmtTime(ev.endTime)}`:''}` :'';
    el.innerHTML=`<div class="cal-event-color" style="background:${ev.color||PALETTE[2]}"></div><div class="cal-event-body"><div class="cal-event-title">${esc(ev.title)}</div><div class="cal-event-meta"><span class="cal-event-type" style="background:${ev.color||PALETTE[2]}22;color:${ev.color||PALETTE[2]}">Event</span>${ts?`<span>${ts}</span>`:''}${ev.notes?`<span>· ${esc(ev.notes)}</span>`:''}</div></div><button class="cal-event-del" data-del="${ev.id}">✕</button>`;
    el.querySelector('[data-del]').onclick=e=>{e.stopPropagation();delCalEv(ev.id);};
    body.appendChild(el);
  });

  // Scheduled tasks
  const schTasks=tasks.filter(t=>t.scheduledDate===ds).sort((a,b)=>(a.timeStart||'99:99').localeCompare(b.timeStart||'99:99'));
  if(schTasks.length){
    const lbl=document.createElement('div');
    lbl.style.cssText='font-size:10px;font-weight:500;letter-spacing:0.1em;text-transform:uppercase;color:var(--text-muted);display:flex;align-items:center;gap:7px;margin-top:2px;';
    lbl.innerHTML=`Tasks <span style="flex:1;height:1px;background:var(--border);display:inline-block"></span>`;
    body.appendChild(lbl);
    schTasks.forEach(t=>{
      const el=document.createElement('div');el.className='cal-task-item';
      const proj=getProj(t.projectId);
      el.innerHTML=`<div class="cal-task-check${t.done?' done':''}" data-cc="${t.id}"></div><span class="cal-task-title${t.done?' done':''}">${esc(t.name)}</span>${t.timeStart?`<span class="cal-event-meta" style="font-size:10px;flex-shrink:0">${fmtTime(t.timeStart)}${t.timeEnd?`–${fmtTime(t.timeEnd)}`:''}</span>`:''}${proj?`<span class="cal-task-proj" style="background:${proj.color}22;color:${proj.color}">${esc(proj.emoji||'')} ${esc(proj.name)}</span>`:''}<button class="task-edit-btn" data-edit="${t.id}" style="flex-shrink:0;width:22px;height:22px;font-size:11px">✎</button>`;
      el.querySelector('[data-cc]').onclick=e=>{e.stopPropagation();Store.update(()=>{const tx=tasks.find(x=>x.id===t.id);tx.done=!tx.done;if(tx.done&&tx.reps.length)tx.reps=tx.reps.map(()=>true);if(!tx.done&&tx.reps.length)tx.reps=tx.reps.map(()=>false);});};
      el.querySelector('[data-edit]').onclick=e=>{e.stopPropagation();openTaskPanel(t.id);};
      body.appendChild(el);
    });
  }

  if(body.children.length===0){const emp=document.createElement('div');emp.className='day-empty';emp.textContent='Nothing yet — tap + to add something.';body.appendChild(emp);}
  const ab=document.createElement('button');ab.className='add-event-btn';ab.innerHTML=`<span style="font-size:14px;line-height:1">+</span> Add to this day`;ab.onclick=()=>openCalPanel(null,ds);body.appendChild(ab);
}

function delCalEv(id){Store.update(()=>{calEvents=calEvents.filter(e=>e.id!==id);});}

// ── MAIN TASKS RENDER ────────────────────────────────────────────
function renderMainTasks(){
  const sd=selectedDate||today();
  const dayList=$('dayTaskList'),allList=$('allTaskList'),doneList=$('doneList');
  dayList.innerHTML='';allList.innerHTML='';doneList.innerHTML='';

  // Day's scheduled tasks (shown in left column section)
  const dayTasks=tasks.filter(t=>t.scheduledDate===sd&&!t.projectId).filter(t=>filterCat==='all'||t.catId===filterCat);
  $('dayTasksLabel').textContent=sd===today()?`Today's Tasks`:`${fmtDate(sd)} Tasks`;
  const activeDayTasks=dayTasks.filter(t=>!t.done);
  $('dayTasksEmpty').style.display=activeDayTasks.length===0?'':'none';
  activeDayTasks.forEach(t=>dayList.appendChild(buildCard(t)));

  // All unscheduled + past-due tasks (no project, visible today)
  const td=today();
  const allFiltered=tasks
    .filter(t=>!t.projectId)
    .filter(t=>!t.scheduledDate||t.scheduledDate<=td)
    .filter(t=>filterCat==='all'||t.catId===filterCat);
  const active=allFiltered.filter(t=>!t.done);
  const done=allFiltered.filter(t=>t.done);
  $('allTasksEmpty').style.display=active.length===0?'':'none';
  active.forEach(t=>allList.appendChild(buildCard(t)));
  if(done.length){$('doneSection').style.display='';done.forEach(t=>doneList.appendChild(buildCard(t)));}
  else $('doneSection').style.display='none';
}

// ── TASK CARD ────────────────────────────────────────────────────
function buildCard(task,compact=false){
  const card=document.createElement('div');
  card.className='task-card'+(task.done?' done':'');
  const cat=getCat(task.catId);
  const rd=task.reps.filter(Boolean).length,rt=task.reps.length;
  card.innerHTML=`<div class="task-card-inner">
    <button class="check-btn ${task.done?'checked':''}" data-check="${task.id}"></button>
    <div class="task-body">
      <div class="task-top">
        <span class="task-name">${esc(task.name)}</span>
        ${cat?`<span class="task-cat-badge" style="background:${cat.color}22;color:${cat.color};border:1px solid ${cat.color}44">${esc(cat.name)}</span>`:''}
      </div>
      ${task.desc&&!compact?`<div class="task-desc">${esc(task.desc)}</div>`:''}
      ${(task.timeStart||task.scheduledDate)&&!compact?`<div class="task-sched-tag">${task.scheduledDate?`📅 ${fmtDate(task.scheduledDate)}`:''}${task.timeStart?` · ${fmtTime(task.timeStart)}${task.timeEnd?` – ${fmtTime(task.timeEnd)}`:''}`:''}${task.recurring?` · 🔁`:''}</div>`:''}
      ${!compact?getReadinessFlagHTML(task):''}
      ${rt>0?`<div class="progress-row"><button class="prog-adj-btn" data-plus="${task.id}">+</button><div class="progress-track"><div class="progress-fill" style="width:${Math.round(rd/rt*100)}%"></div></div><span class="progress-label">${rd}/${rt}</span><button class="prog-adj-btn" data-minus="${task.id}">−</button></div>`:''}
    </div>
    <button class="task-edit-btn" data-edit="${task.id}">✎</button>
  </div>`;
  card.querySelector('[data-check]').onclick=e=>{e.stopPropagation();Store.update(()=>{const t=tasks.find(x=>x.id===task.id);t.done=!t.done;if(t.done&&t.reps.length)t.reps=t.reps.map(()=>true);if(!t.done&&t.reps.length)t.reps=t.reps.map(()=>false);});};
  card.querySelector('[data-edit]').onclick=e=>{e.stopPropagation();openTaskPanel(task.id);};
  const pb=card.querySelector('[data-plus]');if(pb)pb.onclick=e=>{e.stopPropagation();Store.update(()=>{const t=tasks.find(x=>x.id===task.id);const i=t.reps.indexOf(false);if(i!==-1)t.reps[i]=true;t.done=t.reps.every(Boolean);});};
  const mb=card.querySelector('[data-minus]');if(mb)mb.onclick=e=>{e.stopPropagation();Store.update(()=>{const t=tasks.find(x=>x.id===task.id);const i=t.reps.lastIndexOf(true);if(i!==-1)t.reps[i]=false;t.done=false;});};
  return card;
}

// ── CATEGORY BAR ─────────────────────────────────────────────────
function renderCategoryBar(){
  const bar=$('categoryBar');bar.innerHTML='';
  const a=document.createElement('button');a.className='cat-chip'+(filterCat==='all'?' active':'');a.textContent='All';a.onclick=()=>{filterCat='all';renderAll();};bar.appendChild(a);
  categories.forEach(cat=>{const chip=document.createElement('button');chip.className='cat-chip'+(filterCat===cat.id?' active':'');chip.innerHTML=`<span class="dot" style="background:${cat.color}"></span>${esc(cat.name)}`;chip.onclick=()=>{filterCat=cat.id;renderAll();};bar.appendChild(chip);});
}

// ── RENDER ALL ───────────────────────────────────────────────────
function renderAll(){
  renderCategoryBar();
  renderProjStrip();
  renderCalendar();
  renderMainTasks();
  if(selectedDate)renderDayPanel(selectedDate);
}

