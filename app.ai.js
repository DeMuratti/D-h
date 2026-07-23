/* app.ai.js — AI project planner: chat, clarifying-question cards, plan parsing. */

// ── AI PROJECT PLANNER ───────────────────────────────────────────
let aiChatHistory=[];

function buildAISystem(){
  const today_str=today();
  const deadline=$('projDeadlineInput')?.value||null;
  const otherProjects=projects.filter(p=>!editingProjId||p.id!==editingProjId);
  const otherCount=otherProjects.length;
  const maxPerDay=otherCount===0?2:1;
  const deadlineContext=deadline
    ? `The user has set a deadline of ${deadline}. Today is ${today_str}. That is ${DoTime.diffDays(today_str,deadline)} days from now. Urgency and task density must reflect this.`
    : `No deadline set. Today is ${today_str}.`;
  const competingContext=otherCount>0
    ? `The user has ${otherCount} other active project(s): ${otherProjects.map(p=>p.name).join(', ')}. Because of this, you may plan at most 1 task per day for this project.`
    : `This is the user's only active project. You may plan up to 2 tasks per day.`;

  return `You are a personal goal-achievement planning assistant inside a productivity app called Dō. Your job is to turn a user's goal into the most effective possible structured project plan.

TODAY: ${today_str}
${deadlineContext}
${competingContext}

CONVERSATION RULES:
1. If the goal lacks enough detail to build a high-probability plan, ask ONE focused follow-up question at a time. Gaps to cover: specific measurable outcome, timeline (if no deadline set), available days per week, current level/experience, equipment or constraints, lifestyle factors that affect scheduling.
2. Be concise and friendly. Never ask more than one question per message. ALWAYS present a clarifying question using the QUESTION OUTPUT FORMAT below — never as free prose.
3. When you have enough detail — usually 1–3 exchanges — output the plan.
4. Always aim to maximise the probability of the user achieving the goal before the deadline (if set). Be honest about probability; do not over-promise.

QUESTION OUTPUT FORMAT:
When you ask a clarifying question, you MAY write one short friendly sentence first, then output EXACTLY this block:

QUESTION_JSON_START
{
  "question": "The single question you are asking",
  "options": ["Short option 1", "Short option 2", "Short option 3"]
}
QUESTION_JSON_END

Rules for options: 2–4 options, each just a few words, mutually exclusive, covering the most likely answers. Do NOT add an "other"/"something else" option yourself — the app adds that automatically. One question per message. A message contains either a QUESTION_JSON block or a PLAN_JSON block, never both.

SUCCESS RATE CALCULATION:
Before outputting the plan, reason internally:
- How many total sessions fit between today and the deadline (or the plan end date)?
- Does the task pool cover all key areas needed to achieve the goal?
- Is the intensity/frequency sustainable given the user's level?
- Are there competing projects limiting daily capacity?
- Factor in a realistic ~15–20% dropout/missed-session rate.
Then produce a success rate (0–100%) and a one-sentence honest reason.

SUCCESS RATE THRESHOLDS:
90–100% = "Highly likely" — deadline is generous, plan is complete, intensity is right
70–89%  = "On track" — solid plan, achievable with consistency
50–69%  = "Ambitious" — tight timeline or high intensity; doable but requires discipline
30–49%  = "Challenging" — deadline may be too tight or goal too complex; be honest
<30%    = "Very difficult" — warn the user clearly, suggest extending deadline or adjusting goal

PLAN OUTPUT FORMAT:
Put your success rate summary and any friendly notes BEFORE the JSON. Then output EXACTLY:

PLAN_JSON_START
{
  "projectName": "Short project name",
  "goal": "One sentence describing the real-life outcome",
  "style": "gym|nutrition|school|business|creative|sport|health|personal|other",
  "emoji": "single emoji",
  "color": "#hexcolor",
  "deadline": "${deadline||'null'}",
  "sessionsPerWeek": 3,
  "weeks": 8,
  "preferredDays": [1,3,5],
  "successRate": 78,
  "successLabel": "On track",
  "successReason": "One honest sentence explaining the rate.",
  "tasks": [
    {"name":"Task name","intensity":3,"priority":4}
  ]
}
PLAN_JSON_END

Intensity: 1=Rest 2=Easy 3=Moderate 4=Hard 5=Max.
Priority: 1=Nice 2=Useful 3=Important 4=Key 5=Critical.
Include 4–10 varied tasks. Mix intensities so the scheduler avoids back-to-back hard sessions. If a deadline is set, set "weeks" so the plan ends on or before it. Max sessionsPerWeek = ${maxPerDay===2?'14 (up to 2/day)':'7 (1/day max — competing projects)'}.`;
}

function updateDeadlinePill(){
  const v=$('projDeadlineInput').value;
  const pill=$('deadlinePill');
  if(v){
    const days=DoTime.diffDays(today(),v);
    pill.textContent=days===0?'Today':days===1?'Tomorrow':`${days} days`;
    pill.className='deadline-pill set';
  } else {
    pill.textContent='Optional';
    pill.className='deadline-pill';
  }
}

function aiChatKeydown(e){if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();aiChatSend();}}

async function aiChatSend(){
  const input=$('aiChatInput');const text=input.value.trim();if(!text)return;
  if(!navigator.onLine){$('offlineWarning').style.display='flex';return;}
  input.value='';input.style.height='auto';
  appendChatMsg('user',text);
  aiChatHistory.push({role:'user',content:text});
  runPlannerTurn();
}

// Sends the current aiChatHistory to the model + handles the reply.
// Shared by aiChatSend() (free text) and answerQuestion() (tapped option).
async function runPlannerTurn(){
  if(!navigator.onLine){$('offlineWarning').style.display='flex';return;}
  $('aiChatSend').disabled=true;
  const thinkId=appendChatMsg('ai','Thinking\u2026',true);
  try{
    if(AI_PROXY_URL.includes('YOUR-WORKER')){
      removeChatMsg(thinkId);
      appendChatMsg('ai','\u26a0\ufe0f **Setup needed:** The AI proxy URL hasn\'t been configured yet. Open `index.html`, find `const AI_PROXY_URL = ...`, and set your Cloudflare Worker URL.');
      $('aiChatSend').disabled=false;
      return;
    }
    const res=await fetch(AI_PROXY_URL,{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({
        model:'claude-sonnet-4-20250514',
        max_tokens:2000,
        system:buildAISystem(),
        messages:aiChatHistory
      })
    });
    if(!res.ok){
      const errData=await res.json().catch(()=>({}));
      removeChatMsg(thinkId);
      const errMsg=errData?.error?.message||errData?.error||`HTTP ${res.status}`;
      appendChatMsg('ai',`\u26a0\ufe0f **API error (${res.status}):** ${errMsg}. ${res.status===401?'Check ANTHROPIC_API_KEY in your Worker settings.':res.status===403?'Your API key may be invalid or expired.':'Try again in a moment.'}`);
      $('aiChatSend').disabled=false;
      return;
    }
    const data=await res.json();
    const reply=data.content?.find(b=>b.type==='text')?.text||'Sorry, something went wrong.';
    removeChatMsg(thinkId);
    aiChatHistory.push({role:'assistant',content:reply});
    handlePlannerReply(reply);
  }catch(e){
    removeChatMsg(thinkId);
    const isNetworkErr=e instanceof TypeError&&e.message.includes('fetch');
    appendChatMsg('ai', isNetworkErr
      ? '\u26a0\ufe0f **Network error:** Could not reach the proxy server. Check that your Worker is deployed and AI_PROXY_URL is correct.'
      : `\u26a0\ufe0f **Unexpected error:** ${e.message}. Try again or use the manual setup below.`
    );
  }
  $('aiChatSend').disabled=false;
  $('aiChatThread').scrollTop=$('aiChatThread').scrollHeight;
}

// Routes a model reply to a question card, a plan card, or plain text.
function handlePlannerReply(reply){
  if(reply.includes('QUESTION_JSON_START')){
    const before=reply.split('QUESTION_JSON_START')[0].trim();
    const m=reply.match(/QUESTION_JSON_START\s*([\s\S]*?)\s*QUESTION_JSON_END/);
    if(before)appendChatMsg('ai',before);
    if(m){try{appendQuestionCard(JSON.parse(m[1].trim()));}
         catch(e){appendChatMsg('ai','Could you tell me a little more about that?');}}
    return;
  }
  if(reply.includes('PLAN_JSON_START')){
    const before=reply.split('PLAN_JSON_START')[0].trim();
    const jsonMatch=reply.match(/PLAN_JSON_START\s*([\s\S]*?)\s*PLAN_JSON_END/);
    if(before)appendChatMsg('ai',before);
    if(jsonMatch){try{appendPlanReadyCard(JSON.parse(jsonMatch[1].trim()));}
                 catch(e){appendChatMsg('ai','I had trouble formatting the plan \u2014 could you give me a bit more detail?');}}
    return;
  }
  appendChatMsg('ai',reply);
}

// Renders a clarifying question as numbered tappable options + a "Something else\u2026"
// free-text slot. Tapping an option (or sending free text) answers and continues.
function appendQuestionCard(q){
  const div=document.createElement('div');div.className='chat-msg ai chat-q-card';
  const opts=Array.isArray(q.options)?q.options.slice(0,4):[];
  const btns=opts.map((o,i)=>`<button class="chat-opt-btn" data-opt="${esc(o)}"><span class="chat-opt-num">${i+1}</span><span>${esc(o)}</span></button>`).join('');
  div.innerHTML=`<div class="chat-avatar ai">\u2726</div>
    <div class="chat-bubble ai" style="flex:1">
      <div class="chat-q-text">${esc(q.question||'')}</div>
      <div class="chat-opts">${btns}
        <button class="chat-opt-btn chat-opt-other" data-other="1"><span class="chat-opt-num">+</span><span>Something else\u2026</span></button>
      </div>
      <div class="chat-opt-otherwrap" style="display:none">
        <textarea class="chat-opt-otherinput" rows="2" placeholder="Type your answer\u2026"></textarea>
        <button class="chat-opt-othersend">Send answer</button>
      </div>
    </div>`;
  div.querySelectorAll('[data-opt]').forEach(b=>{b.onclick=()=>answerQuestion(div,b.dataset.opt);});
  const otherBtn=div.querySelector('[data-other]');
  const wrap=div.querySelector('.chat-opt-otherwrap');
  const inp=div.querySelector('.chat-opt-otherinput');
  const snd=div.querySelector('.chat-opt-othersend');
  otherBtn.onclick=()=>{wrap.style.display='flex';otherBtn.style.display='none';inp.focus();};
  const submit=()=>{const v=inp.value.trim();if(v)answerQuestion(div,v);};
  snd.onclick=submit;
  inp.onkeydown=e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();submit();}};
  $('aiChatThread').appendChild(div);
  $('aiChatThread').scrollTop=$('aiChatThread').scrollHeight;
}

// Locks the answered card, echoes the choice as a user message, continues.
function answerQuestion(cardEl,text){
  if(cardEl.classList.contains('answered'))return;
  cardEl.classList.add('answered');
  const chosen=[...cardEl.querySelectorAll('[data-opt]')].find(b=>b.dataset.opt===text);
  if(chosen)chosen.classList.add('chosen');
  cardEl.querySelectorAll('button').forEach(b=>b.disabled=true);
  const wrap=cardEl.querySelector('.chat-opt-otherwrap');if(wrap)wrap.style.display='none';
  appendChatMsg('user',text);
  aiChatHistory.push({role:'user',content:text});
  runPlannerTurn();
}

let _cmId=0;
function appendChatMsg(role,text,thinking=false){
  const id='cm'+(++_cmId);
  const div=document.createElement('div');div.className='chat-msg '+role;div.id=id;
  const html=text
    .replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>')
    .replace(/^[-•] (.+)/gm,'<li>$1</li>')
    .replace(/\n/g,'<br>');
  div.innerHTML=`<div class="chat-avatar ${role}">${role==='ai'?'✦':'→'}</div><div class="chat-bubble ${role}${thinking?' thinking':''}">${html}</div>`;
  $('aiChatThread').appendChild(div);
  $('aiChatThread').scrollTop=$('aiChatThread').scrollHeight;
  return id;
}
function removeChatMsg(id){const el=document.getElementById(id);if(el)el.remove();}

function appendPlanReadyCard(plan){
  const rate=plan.successRate||0;
  const rateColor=rate>=90?'#4A8A6C':rate>=70?'#5A7EB5':rate>=50?'#C4754A':rate>=30?'#B5925C':'#C44A4A';
  const enc=encodeURIComponent(JSON.stringify(plan));
  const div=document.createElement('div');div.className='chat-msg ai';
  div.innerHTML=`<div class="chat-avatar ai">✦</div>
    <div class="chat-bubble ai" style="flex:1">
      <strong>Plan ready!</strong> ${esc(plan.projectName)} — ${plan.tasks?.length||0} tasks over ${plan.weeks||6} weeks.
      <div style="display:flex;align-items:center;gap:10px;margin:10px 0 8px;padding:10px 12px;background:var(--bg);border-radius:10px;border:1.5px solid ${rateColor}44">
        <div style="font-family:'DM Serif Display',serif;font-size:28px;color:${rateColor};line-height:1">${rate}%</div>
        <div>
          <div style="font-size:11px;font-weight:600;color:${rateColor};text-transform:uppercase;letter-spacing:0.06em">${esc(plan.successLabel||'')}</div>
          <div style="font-size:11px;font-weight:300;color:var(--text-muted);margin-top:2px">${esc(plan.successReason||'')}</div>
        </div>
      </div>
      <button class="chat-accept-btn" onclick="acceptAIPlan('${enc}')">Review &amp; build schedule →</button>
    </div>`;
  $('aiChatThread').appendChild(div);
  $('aiChatThread').scrollTop=$('aiChatThread').scrollHeight;
}

function renderSuccessRateCard(plan){
  const rate=plan.successRate;if(rate==null)return;
  const rateColor=rate>=90?'#4A8A6C':rate>=70?'#5A7EB5':rate>=50?'#C4754A':rate>=30?'#B5925C':'#C44A4A';
  const bgColor=rate>=90?'#D4EDE2':rate>=70?'#D4DFF0':rate>=50?'#F0E0D4':rate>=30?'#EDE0CC':'#F0D4D4';
  // SVG ring
  const r=26,circ=2*Math.PI*r,offset=circ*(1-rate/100);
  return `<div class="success-rate-card" style="background:${bgColor};border:1.5px solid ${rateColor}44">
    <div class="success-rate-ring-wrap">
      <svg class="success-rate-ring" width="64" height="64" viewBox="0 0 64 64">
        <circle class="success-rate-ring-bg" cx="32" cy="32" r="${r}" stroke="${rateColor}" opacity="0.2"/>
        <circle class="success-rate-ring-fill" cx="32" cy="32" r="${r}" stroke="${rateColor}"
          stroke-dasharray="${circ}" stroke-dashoffset="${offset}"/>
      </svg>
      <div class="success-rate-pct" style="color:${rateColor}">${rate}%</div>
    </div>
    <div class="success-rate-body">
      <div class="success-rate-label" style="color:${rateColor}">${esc(plan.successLabel||'')}</div>
      <div class="success-rate-reason" style="color:${rateColor}">${esc(plan.successReason||'')}</div>
    </div>
  </div>`;
}

function acceptAIPlan(enc){
  const plan=JSON.parse(decodeURIComponent(enc));
  $('projName').value=plan.projectName||'';
  $('projDesc').value=plan.goal||'';
  pickedStyle=plan.style||null;pickedProjColor=plan.color||PALETTE[1];pickedEmoji=plan.emoji||PROJ_EMOJIS[0];
  poolTasks=(plan.tasks||[]).map(t=>({id:uid(),name:t.name,intensity:Math.min(5,Math.max(1,t.intensity||3)),priority:Math.min(5,Math.max(1,t.priority||3))}));
  plannerSessions=Math.min(7,Math.max(1,plan.sessionsPerWeek||3));
  plannerWeeks=Math.min(52,Math.max(1,plan.weeks||6));
  // Deadline — use from plan or from the input
  const dl=plan.deadline&&plan.deadline!=='null'?plan.deadline:($('projDeadlineInput').value||null);
  $('projDeadlineStep2').value=dl||'';
  if(plan.preferredDays?.length){
    plannerActiveDays=new Set(plan.preferredDays);
    document.querySelectorAll('.planner-day-btn').forEach(b=>b.classList.toggle('active',plannerActiveDays.has(parseInt(b.dataset.pday))));
  }
  $('plannerSessionsNum').textContent=plannerSessions;
  $('plannerWeeksNum').textContent=plannerWeeks;
  // Summary card with success rate
  let summaryHTML=`<div class="ai-summary-card-title">${plan.emoji||'📋'} ${esc(plan.projectName)}</div><div class="ai-summary-card-sub">${esc(plan.goal||'')}`;
  if(dl) summaryHTML+=` · 🎯 ${fmtDate(dl)}`;
  summaryHTML+=`</div>`;
  $('aiSummaryCard').innerHTML=summaryHTML;
  // Inject success rate card just below summary
  if(plan.successRate!=null){
    const rateEl=document.createElement('div');
    rateEl.innerHTML=renderSuccessRateCard(plan);
    $('aiSummaryCard').insertAdjacentElement('afterend',rateEl.firstElementChild);
  }
  // Store success data on the plan object for later save
  window._pendingPlan=plan;
  $('projStep1').style.display='none';$('projStep2').style.display='flex';
  renderStyleGrid();renderEmojiRow();renderProjColorPicker();renderAllPoolTasks();
}

function backToChat(){$('projStep2').style.display='none';$('projStep1').style.display='flex';}

function switchToManual(){
  poolTasks=[];$('projName').value='';$('projDesc').value='';pickedStyle=null;pickedProjColor=PALETTE[1];pickedEmoji=PROJ_EMOJIS[0];
  plannerSessions=3;plannerWeeks=6;$('plannerSessionsNum').textContent=3;$('plannerWeeksNum').textContent=6;
  $('aiSummaryCard').innerHTML='';
  $('projStep1').style.display='none';$('projStep2').style.display='flex';
  renderStyleGrid();renderEmojiRow();renderProjColorPicker();renderAllPoolTasks();
}

$('aiChatInput').addEventListener('input',function(){this.style.height='auto';this.style.height=Math.min(this.scrollHeight,120)+'px';});

function openProjectPanel(id=null){
  editingProjId=id;const proj=id?getProj(id):null;
  $('projPanelTitle').textContent=id?'Edit Project':'New Project';
  aiChatHistory=[];window._pendingPlan={};
  $('aiChatThread').innerHTML='';
  $('projDeadlineInput').value=proj?.deadline||'';
  updateDeadlinePill();
  appendChatMsg('ai',"Hi! Tell me about your goal — what do you want to achieve? The more detail the better: your timeline, how often you can work on it, your current level, and any constraints. If you have a hard deadline, set it at the top before we start. I'll ask if I need more.");
  if(id&&proj){
    $('projName').value=proj.name||'';$('projDesc').value=proj.desc||'';
    pickedStyle=proj.style||null;pickedProjColor=proj.color||PALETTE[1];pickedEmoji=proj.emoji||PROJ_EMOJIS[0];
    poolTasks=proj.pool?JSON.parse(JSON.stringify(proj.pool)):[];
    plannerSessions=3;plannerWeeks=6;$('plannerSessionsNum').textContent=3;$('plannerWeeksNum').textContent=6;
    $('projDeadlineStep2').value=proj.deadline||'';
    let summaryHTML=proj.desc?`<div class="ai-summary-card-title">${proj.emoji||'📋'} ${esc(proj.name)}</div><div class="ai-summary-card-sub">${esc(proj.desc)}${proj.deadline?` · 🎯 ${fmtDate(proj.deadline)}`:''}</div>`:'';
    $('aiSummaryCard').innerHTML=summaryHTML;
    // Re-render success rate card if present
    const existingRate=document.querySelector('.success-rate-card');if(existingRate)existingRate.remove();
    if(proj.successRate!=null){const rateEl=document.createElement('div');rateEl.innerHTML=renderSuccessRateCard(proj);$('aiSummaryCard').insertAdjacentElement('afterend',rateEl.firstElementChild);}
    $('projStep1').style.display='none';$('projStep2').style.display='flex';
    renderStyleGrid();renderEmojiRow();renderProjColorPicker();renderAllPoolTasks();
  } else {
    $('projStep1').style.display='flex';$('projStep2').style.display='none';
    $('offlineWarning').style.display=navigator.onLine?'none':'flex';
    $('aiSummaryCard').innerHTML='';
  }
  document.querySelectorAll('.planner-day-btn').forEach(b=>b.classList.toggle('active',plannerActiveDays.has(parseInt(b.dataset.pday))));
  openOverlay();$('projectPanel').classList.add('open');
  setTimeout(()=>$('aiChatInput').focus(),400);
}
function closeProjectPanel(){$('projectPanel').classList.remove('open');closeOverlay();editingProjId=null;}
function saveProject(){
  const name=$('projName').value.trim();
  if(!name){if($('projStep2').style.display==='none')switchToManual();$('projName').style.borderColor='var(--danger)';$('projName').focus();return;}
  $('projName').style.borderColor='';
  const desc=$('projDesc').value.trim();
  const deadline=$('projDeadlineStep2').value||$('projDeadlineInput')?.value||null;
  const plan=window._pendingPlan||{};
  const successRate=plan.successRate??null;
  const successLabel=plan.successLabel||null;
  Store.update(()=>{
    if(editingProjId){
      const p=getProj(editingProjId);
      p.name=name;p.desc=desc;p.emoji=pickedEmoji;p.color=pickedProjColor;p.style=pickedStyle;p.pool=poolTasks;p.deadline=deadline;p.successRate=successRate;p.successLabel=successLabel;
    } else {
      projects.push({id:uid(),name,desc,emoji:pickedEmoji,color:pickedProjColor,style:pickedStyle,pool:poolTasks,deadline,successRate,successLabel,createdAt:Date.now()});
    }
  });
  closeProjectPanel();
}
function deleteProject(id){Store.update(()=>{tasks.forEach(t=>{if(t.projectId===id)t.projectId=null;});calEvents=calEvents.filter(e=>e.projectId!==id);projects=projects.filter(p=>p.id!==id);});}
async function aiSuggestTasks(){} // legacy no-op
