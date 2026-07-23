/* app.wiring.js — extracted from todo-app.html. Overlay, panel-specific renderers, recurring schedule, month nav + their load-time DOM wiring. */

// ── OVERLAY ──────────────────────────────────────────────────────
function openOverlay(){$('overlay').classList.add('open');}
function closeOverlay(){$('overlay').classList.remove('open');}
$('overlay').onclick=()=>{closeTaskPanel();closeProjectPanel();closeCalPanel();closeFab();};
document.addEventListener('keydown',e=>{if(e.key==='Escape'){closeTaskPanel();closeProjectPanel();closeCalPanel();closeFab();}});

// ── PANEL RENDERERS ──────────────────────────────────────────────
// Categories keep a bespoke renderer because each option also carries its own
// border colour; the only change is data-id, so the selection can be read back
// by id instead of by DOM position.
function renderPanelCats(selId){const grid=$('catSelectGrid');grid.innerHTML='';categories.forEach(cat=>{const item=document.createElement('button');item.className='cat-select-item'+(selId===cat.id?' selected':'');item.dataset.id=cat.id;item.style.borderColor=selId===cat.id?cat.color:'';item.innerHTML=`<span class="cat-select-dot" style="background:${cat.color}"></span>${esc(cat.name)}`;item.onclick=()=>{grid.querySelectorAll('.cat-select-item').forEach(el=>{el.classList.remove('selected');el.style.borderColor='';});item.classList.add('selected');item.style.borderColor=cat.color;};grid.appendChild(item);});}
function renderPanelProjects(selProjId){
  renderSelectGrid($('taskProjGrid'),projects,{
    selectedId:selProjId||null,
    includeNone:true,
    itemClass:'proj-select-item',
    label:p=>`${p.emoji||'📋'} ${esc(p.name)}`,
  });
}
function renderColorPicker(){renderSwatches($('colorPicker'),PALETTE,pickedColor,c=>{pickedColor=c;});}
function renderEmojiRow(){const row=$('emojiRow');row.innerHTML='';PROJ_EMOJIS.forEach(em=>{const btn=document.createElement('button');btn.className='emoji-btn'+(em===pickedEmoji?' picked':'');btn.textContent=em;btn.onclick=()=>{pickedEmoji=em;row.querySelectorAll('.emoji-btn').forEach(b=>b.classList.remove('picked'));btn.classList.add('picked');};row.appendChild(btn);});}
function renderProjColorPicker(){renderSwatches($('projColorPicker'),PALETTE,pickedProjColor,c=>{pickedProjColor=c;});}

function updateRepPreview(){$('repNum').textContent=panelRepCount;$('repDotsPreview').innerHTML=Array.from({length:panelRepCount},()=>`<div class="rep-dot-preview"></div>`).join('');}
$('repPlus').onclick=()=>{if(panelRepCount<20){panelRepCount++;updateRepPreview();}};
$('repMinus').onclick=()=>{if(panelRepCount>0){panelRepCount--;updateRepPreview();}};
$('addCatBtn').onclick=()=>{const name=$('newCatName').value.trim();if(!name)return;const nc={id:uid(),name,color:pickedColor};Store.update(()=>{categories.push(nc);});$('newCatName').value='';renderPanelCats(nc.id);};
$('newCatName').addEventListener('keydown',e=>{if(e.key==='Enter')$('addCatBtn').click();});

// ── RECURRING SCHEDULE ───────────────────────────────────────────
let recurWeeks=4;
let recurActiveDays=new Set(); // 0=Sun,1=Mon,…6=Sat

function toggleRecur(){
  const on=$('recurEnabled').checked;
  $('recurFields').style.display=on?'':'none';
  if(on)updateRecurPreview();
}

// Wire day buttons
document.querySelectorAll('.recur-day-btn').forEach(btn=>{
  btn.onclick=()=>{
    const d=parseInt(btn.dataset.day);
    if(recurActiveDays.has(d)){recurActiveDays.delete(d);btn.classList.remove('active');}
    else{recurActiveDays.add(d);btn.classList.add('active');}
    updateRecurPreview();
  };
});

// Week counter
$('recurWeeksPlus').onclick=()=>{if(recurWeeks<52){recurWeeks++;$('recurWeeksNum').textContent=recurWeeks;updateRecurPreview();}};
$('recurWeeksMinus').onclick=()=>{if(recurWeeks>1){recurWeeks--;$('recurWeeksNum').textContent=recurWeeks;updateRecurPreview();}};

function getRecurDates(){
  if(!recurActiveDays.size) return [];
  const startFrom=new Date();
  startFrom.setHours(0,0,0,0);
  const endDate=new Date(startFrom);
  endDate.setDate(endDate.getDate()+recurWeeks*7);
  const dates=[];
  const cur=new Date(startFrom);
  while(cur<=endDate){
    if(recurActiveDays.has(cur.getDay())) dates.push(dateStr(new Date(cur)));
    cur.setDate(cur.getDate()+1);
  }
  return dates;
}

function updateRecurPreview(){
  const dates=getRecurDates();
  const prev=$('recurPreview');
  if(!dates.length){prev.innerHTML='<span>Select at least one day above.</span>';return;}
  const dayNames=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const daysSelected=[...recurActiveDays].sort((a,b)=>a-b).map(d=>dayNames[d]).join(', ');
  prev.innerHTML=`<strong>${dates.length} occurrences</strong> — every <strong>${daysSelected}</strong> for <strong>${recurWeeks} week${recurWeeks>1?'s':''}</strong><br>First: ${fmtDate(dates[0])} · Last: ${fmtDate(dates[dates.length-1])}`;
}

function resetRecurUI(){
  $('recurEnabled').checked=false;
  $('recurFields').style.display='none';
  recurWeeks=4;recurActiveDays=new Set();
  $('recurWeeksNum').textContent='4';
  document.querySelectorAll('.recur-day-btn').forEach(b=>b.classList.remove('active'));
  $('recurPreview').innerHTML='';
}

// Month navigation (only inside dropdown)
function calPrevMonth(){calMonth--;if(calMonth<0){calMonth=11;calYear--;}renderCalendar();}
function calNextMonth(){calMonth++;if(calMonth>11){calMonth=0;calYear++;}renderCalendar();}
$('calPrev2').onclick=calPrevMonth;$('calNext2').onclick=calNextMonth;

