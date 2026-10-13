/* BenchBright Learning | MLS/MLT microbiology adaptive practice exam.
 * Item choice: Bayesian EAP theta, 1PL Rasch item-response approximation.
 * Question levels are uncalibrated editorial placeholders, not psychometric parameters.
 * This is an educational prototype, NOT an official ASCP CAT.
 */
(() => {
  'use strict';
  const EXAM_LENGTH = 20;
  const B_BY_LEVEL = {1:-1.9,2:-0.95,3:0,4:0.95,5:1.9};
  const DOMAINS = [
    'Specimens, Media & AST',
    'Enteric Gram-Negative Bacteria',
    'Nonfermenters & Fastidious Gram-Negatives',
    'Gram-Positive & Atypical Bacteria',
    'Anaerobes & Mycobacteria',
    'Mycology', 'Virology', 'Parasitology'
  ];
  const $ = id => document.getElementById(id);
  const ITEMS_BY_ID = new Map(QUESTION_BANK.map(item=>[item.id,item]));
  let state=null;
  let timerHandle=null;
  $('year').textContent = new Date().getFullYear();

  function show(screenId){
    for(const id of ['intro-screen','exam-screen','result-screen']) $(id).classList.toggle('hidden',id!==screenId);
    window.scrollTo({top:0,behavior:'instant'});
  }
  function itemById(id){return ITEMS_BY_ID.get(id);}
  function sigmoid(x){return 1/(1+Math.exp(-x));}
  // Regularize estimates with a standard-normal prior; item difficulty b is seeded, uncalibrated.
  function estimate(responses){
    const grid=[], logWeights=[];
    for(let j=0;j<=160;j++){
      const theta=-4+j*0.05;
      let logPosterior=-0.5*theta*theta;
      for(const r of responses){
        const b=B_BY_LEVEL[itemById(r.id).level];
        const p=Math.max(1e-9,Math.min(1-1e-9,sigmoid(theta-b)));
        logPosterior+=r.correct?Math.log(p):Math.log(1-p);
      }
      grid.push(theta);logWeights.push(logPosterior);
    }
    const peak=Math.max(...logWeights);
    const weights=logWeights.map(logw=>Math.exp(logw-peak));
    const sum=weights.reduce((a,b)=>a+b,0);
    const mean=grid.reduce((a,t,j)=>a+t*weights[j],0)/sum;
    const sd=Math.sqrt(grid.reduce((a,t,j)=>a+(t-mean)**2*weights[j],0)/sum);
    let cumulative=0,low=-4,high=4,foundLow=false;
    for(let j=0;j<grid.length;j++){
      cumulative+=weights[j]/sum;
      if(cumulative>=0.05&&!foundLow){low=grid[j];foundLow=true;}
      if(cumulative>=0.95){high=grid[j];break;}
    }
    return {mean,sd,low,high};
  }
  function pickNextItem(responses){
    const seenIDs=new Set(responses.map(r=>r.id));
    const seenFamilies=new Set(responses.map(r=>itemById(r.id).family));
    const candidates=QUESTION_BANK.filter(item=>!seenIDs.has(item.id)&&!seenFamilies.has(item.family));
    if(!candidates.length)return null;
    const counts=Object.fromEntries(DOMAINS.map(name=>[name,0]));
    for(const r of responses) counts[itemById(r.id).domain]++;
    const theta=estimate(responses).mean;
    const maxCount=Math.max(...Object.values(counts));
    // Favor item information near theta; provide balanced topic representation.
    // Random jitter produces distinct exams even for equal scores.
    return candidates.map(item=>{
      const p=sigmoid(theta-B_BY_LEVEL[item.level]);
      const information=p*(1-p);
      const balance=Math.max(0,maxCount-counts[item.domain]);
      const score=information+0.05*balance+Math.random()*0.045;
      return {item,score};
    }).sort((a,b)=>b.score-a.score)[0].item;
  }
  function shuffledChoices(item){
    const arr=item.choices.map((label,index)=>({label,index}));
    for(let i=arr.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[arr[i],arr[j]]=[arr[j],arr[i]];}
    return arr;
  }
  function timeString(ms){
    const total=Math.max(0,Math.floor(ms/1000));
    return `${String(Math.floor(total/60)).padStart(2,'0')}:${String(total%60).padStart(2,'0')}`;
  }
  function startTimer(){
    if(timerHandle)clearInterval(timerHandle);
    timerHandle=setInterval(()=>{
      if(state&&!state.done)$('timer-value').textContent=timeString(Date.now()-state.startedAt);
    },1000);
  }
  function begin(){
    if(QUESTION_BANK.length<EXAM_LENGTH||new Set(QUESTION_BANK.map(q=>q.family)).size<EXAM_LENGTH){
      alert('The question bank needs at least 20 distinct concept families to start.');return;
    }
    state={startedAt:Date.now(),startedISO:new Date().toISOString(),responses:[],current:null,choiceOrder:[],chosen:null,done:false};
    state.current=pickNextItem([]);
    state.choiceOrder=shuffledChoices(state.current);
    $('timer-value').textContent='00:00';
    show('exam-screen');startTimer();renderQuestion();
  }
  function renderQuestion(){
    const item=state.current;
    $('question-count').textContent=`QUESTION ${state.responses.length+1} OF ${EXAM_LENGTH}`;
    $('progress-track').setAttribute('aria-valuenow',String(state.responses.length));
    $('progress-fill').style.width=`${state.responses.length/EXAM_LENGTH*100}%`;
    $('domain-label').textContent=item.domain;
    $('question-id').textContent=item.id;
    $('question-heading').textContent=item.question;
    $('difficulty-tag').textContent='Adaptive item'; // Conceal difficulty while taking exam.
    $('answer-hint').textContent='Choose the single best answer.';
    $('submit-button').disabled=true;
    const field=$('choices');field.replaceChildren();
    state.choiceOrder.forEach((opt,displayIndex)=>{
      const label=document.createElement('label');label.className='choice';
      const input=document.createElement('input');input.type='radio';input.name='answer';input.value=String(opt.index);input.required=true;
      const letter=document.createElement('span');letter.className='choice-letter';letter.textContent='ABCD'[displayIndex];
      const desc=document.createElement('span');desc.className='choice-text';desc.textContent=opt.label;
      label.append(input,letter,desc);
      input.addEventListener('change',()=>{
        state.chosen=opt.index;
        for(const other of field.querySelectorAll('.choice'))other.classList.remove('selected');
        label.classList.add('selected');$('submit-button').disabled=false;
      });
      field.append(label);
    });
    state.chosen=null;
  }
  function submitAnswer(event){
    event.preventDefault();
    if(!state||state.done||state.chosen===null)return;
    const item=state.current;
    state.responses.push({id:item.id,chosen:state.chosen,correct:state.chosen===item.answer});
    if(state.responses.length>=EXAM_LENGTH){finish();return;}
    const next=pickNextItem(state.responses);
    if(!next){finish();return;}
    state.current=next;state.choiceOrder=shuffledChoices(next);
    renderQuestion();window.scrollTo({top:0,behavior:'smooth'});
  }
  function formatTheta(v){return `${v>=0?'+':''}${v.toFixed(2)}`;}
  function scalePos(v){return Math.min(100,Math.max(0,(v+4)/8*100));}
  function formatPercent(n,d){return d?Math.round(n/d*100)+'%':'—';}
  function addText(tag,className,textValue,parent){
    const el=document.createElement(tag);if(className)el.className=className;
    el.textContent=textValue;parent.append(el);return el;
  }
  function finish(){
    state.done=true;clearInterval(timerHandle);
    const responses=state.responses;
    const stats=estimate(responses);
    const correct=responses.filter(r=>r.correct).length;
    $('result-total').textContent=responses.length;
    $('result-accuracy').textContent=formatPercent(correct,responses.length);
    $('result-theta').textContent=formatTheta(stats.mean);
    $('result-sem').textContent=stats.sd.toFixed(2);
    let interp='Performance was most consistent with questions around the middle of this provisional difficulty range.';
    if(stats.mean>0.65)interp='Performance was most consistent with relatively challenging items in this provisional bank.';
    if(stats.mean< -0.65)interp='Consider reinforcing foundational microbiology concepts before advancing to more challenging practice.';
    $('result-interpretation').textContent=interp+' The estimate considers all 20 responses and estimated question difficulty, not just percent correct.';
    $('ability-marker').style.left=`calc(${scalePos(stats.mean)}% - 2px)`;
    $('ability-interval').style.left=`${scalePos(stats.low)}%`;
    $('ability-interval').style.width=`${scalePos(stats.high)-scalePos(stats.low)}%`;
    $('interval-text').textContent=`Approximate 90% posterior credible interval: θ ${formatTheta(stats.low)} to ${formatTheta(stats.high)}. The θ scale is provisional, not normed on ASCP candidates or comparable to an official scaled score.`;
    const topics=$('topic-results');topics.replaceChildren();
    for(const domain of DOMAINS){
      const rs=responses.filter(r=>itemById(r.id).domain===domain);
      const hits=rs.filter(r=>r.correct).length;
      const row=addText('div','topic-row','',topics);
      addText('div','topic-name',domain,row);
      const track=addText('div','topic-track','',row);
      const fill=addText('div','topic-fill','',track);
      fill.style.width=rs.length?`${100*hits/rs.length}%`:'0%';
      addText('div','topic-score',`${hits}/${rs.length} correct`,row);
    }
    const list=$('review-list');list.replaceChildren();
    responses.forEach((response,index)=>{
      const item=itemById(response.id);
      const block=addText('article','review-item','',list);
      const header=addText('div','review-meta','',block);
      addText('span','',`Q${index+1} · ${item.domain} · Level ${item.level}`,header);
      addText('span',`review-status ${response.correct?'good':'bad'}`,response.correct?'✓ Correct':'✕ Incorrect',header);
      addText('div','review-question',item.question,block);
      addText('div','review-answer',`Your answer: ${item.choices[response.chosen]}`,block);
      addText('div','review-answer',`Correct answer: ${item.choices[item.answer]}`,block);
      for(let c=0;c<4;c++){
        const badge=`${'ABCD'[c]}${c===item.answer?' · Correct answer':''}${c===response.chosen&&c!==item.answer?' · Your choice':''}`;
        const detail=addText('div','explanation-option','',block);
        addText('strong','explanation-option-title',badge,detail);
        addText('div','explanation-option-text',`${item.choices[c]} — ${item.explanations[c]}`,detail);
      }
    });
    show('result-screen');
  }
  function downloadResults(){
    if(!state||!state.done)return;
    const stats=estimate(state.responses);
    const data={
      source:'BenchBright Learning MLS/MLT Microbiology adaptive practice',
      disclaimer:'Uncalibrated educational practice CAT. Not an official ASCP score or pass/fail predictor.',
      startedAt:state.startedISO,completedAt:new Date().toISOString(),
      duration:timeString(Date.now()-state.startedAt),
      bankSize:QUESTION_BANK.length,answered:state.responses.length,
      correct:state.responses.filter(r=>r.correct).length,
      theta:Number(stats.mean.toFixed(3)),posteriorSD:Number(stats.sd.toFixed(3)),
      credibleInterval90:[Number(stats.low.toFixed(2)),Number(stats.high.toFixed(2))],
      responses:state.responses.map((r,j)=>{
        const item=itemById(r.id);
        return {number:j+1,id:item.id,domain:item.domain,category:item.category,level:item.level,
          question:item.question,selected:item.choices[r.chosen],correctAnswer:item.choices[item.answer],
          correct:r.correct,rationales:item.explanations};
      })
    };
    const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');a.href=url;a.download='BenchBright-Microbiology-CAT-results.json';
    document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  // Automated QA hook; not intended for sensitive data.
  if(location.search.includes('bb_test=1'))window.BBCAT_TEST={estimate,pickNextItem,B_BY_LEVEL,bank:QUESTION_BANK};
  $('start-button').addEventListener('click',begin);
  $('answer-form').addEventListener('submit',submitAnswer);
  $('download-button').addEventListener('click',downloadResults);
  $('print-button').addEventListener('click',()=>window.print());
  $('restart-button').addEventListener('click',begin);
})();
