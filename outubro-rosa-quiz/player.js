import {auth, db, COLLECTION, escapeHtml, errorMessage} from "./firebase.js";
import {signInAnonymously} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import {doc, collection, getDoc, setDoc, updateDoc, onSnapshot, serverTimestamp} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
const $=id=>document.getElementById(id);
let code=null,session=null,me=null,uid=null,players=[],unsubSession=null,unsubPlayers=null,selection=new Set(),activeQuestion=-1,submitting=false;
const params=new URLSearchParams(location.search);
if(/^\d{6}$/.test(params.get("s")||"")) $("code").value=params.get("s");
if(localStorage.getItem("rosaQuizName"))$("name").value=localStorage.getItem("rosaQuizName");
function error(err){$("joinError").textContent=typeof err==="string"?err:errorMessage(err);$("joinError").classList.remove("hidden");}
function clearError(){$("joinError").classList.add("hidden");}
async function ensureAuth(){
  if(auth.currentUser)return auth.currentUser;
  return (await signInAnonymously(auth)).user;
}
$("joinForm").onsubmit=async ev=>{
  ev.preventDefault();clearError();
  const btn=$("joinForm").querySelector("button");btn.disabled=true;
  const c=$("code").value.trim(),name=$("name").value.trim().replace(/\s+/g," ");
  try{
    if(!/^\d{6}$/.test(c))throw Error("Digite o código de seis números mostrado pelo apresentador.");
    if(name.length<2||name.length>32)throw Error("Digite um nome ou apelido entre 2 e 32 caracteres.");
    const person=await ensureAuth();uid=person.uid;
    const room=doc(db,COLLECTION,c);
    const snap=await getDoc(room);
    if(!snap.exists())throw Error("Sala não encontrada. Confira o código.");
    if(snap.data().phase==="finished")throw Error("Esta partida já terminou.");
    const pRef=doc(db,COLLECTION,c,"players",uid);
    const existing=await getDoc(pRef);
    if(!existing.exists()){
      await setDoc(pRef,{name,points:0,answerQuestion:-1,answer:[],answeredAt:null,lastCorrect:false,lastAwardedQuestion:-1,lastEarned:0,joinedAt:serverTimestamp()});
    }else if(existing.data().name!==name){
      // O nome permanece o original para evitar troca de identidade no meio do jogo.
      $("name").value=existing.data().name;
    }
    localStorage.setItem("rosaQuizName",$("name").value);
    code=c;history.replaceState({}, "",location.pathname+"?s="+encodeURIComponent(code));
    $("joinPanel").classList.add("hidden");$("gamePanel").classList.remove("hidden");
    $("greeting").textContent="Olá, "+$("name").value+"!";
    if(unsubSession)unsubSession();if(unsubPlayers)unsubPlayers();
    unsubSession=onSnapshot(room,s=>{
      if(!s.exists()){showErrorInside("A sala foi removida.");return;}
      session=s.data();
      if(session.questionIndex!==activeQuestion){selection.clear();activeQuestion=session.questionIndex;}
      render();
    },e=>showErrorInside(errorMessage(e)));
    unsubPlayers=onSnapshot(collection(db,COLLECTION,code,"players"),s=>{
      players=s.docs.map(d=>({id:d.id,...d.data()}));
      me=players.find(p=>p.id===uid)||null;render();
    },e=>showErrorInside(errorMessage(e)));
  }catch(e){error(e);}finally{btn.disabled=false;}
};
function showErrorInside(text){$("gameArea").innerHTML='<div class="message">'+escapeHtml(text)+'</div>';}
const ready=()=>!!(me&&session&&me.answerQuestion===session.questionIndex);
function displayLeaderboard(){
  players.sort((a,b)=>(b.points||0)-(a.points||0)||a.name.localeCompare(b.name,"pt-BR"));
  $("playerCount").textContent=players.length+" participantes";
  $("leaderboard").innerHTML=players.map((p,i)=>'<div class="person"><div><span class="place">'+(i+1)+'</span><span class="name">'+escapeHtml(p.name)+(p.id===uid?" (você)":"")+'</span></div><span class="score">'+(p.points||0).toLocaleString("pt-BR")+' pts</span></div>').join("")||'<div class="helper">Esperando outros participantes...</div>';
}
function render(){
  if(!session)return;
  displayLeaderboard();
  $("status").textContent={lobby:"Aguardando",question:"Pergunta "+(session.questionIndex+1),reveal:"Gabarito",finished:"Finalizado"}[session.phase]||"";
  const area=$("gameArea");
  if(session.phase==="lobby"){
    area.innerHTML='<div class="bigcenter"><h2>Você entrou! 🎀</h2><p>Aguarde o apresentador iniciar a primeira pergunta.</p></div>';return;
  }
  if(session.phase==="finished"){
    const position=players.findIndex(p=>p.id===uid)+1;
    area.innerHTML='<div class="bigcenter"><h2>🏆 Quiz encerrado!</h2><p>Você terminou em '+position+'º lugar com <strong>'+(me?.points||0).toLocaleString("pt-BR")+' pontos</strong>.</p></div>';return;
  }
  if(!session.question){area.innerHTML='<p class="helper">Carregando pergunta...</p>';return;}
  const q=session.question;
  const responded=ready();
  const remaining= session.deadline?.toMillis?Math.max(0,Math.ceil((session.deadline.toMillis()-Date.now())/1000)):0;
  const expired=remaining<=0;
  const correct=Array.isArray(session.correct)?session.correct:[];
  const header='<div class="label-row"><span class="eyebrow">Questão '+(session.questionIndex+1)+' de 10</span><span class="timer-label" id="playerClock"></span></div><div class="timer"><div id="playerBar"></div></div>';
  const options='<div class="option-list">'+q.options.map((text,i)=>{
    const selected=responded?(me.answer||[]).includes(i):selection.has(i);
    const isCorrect=session.phase==="reveal"&&correct.includes(i);
    const isWrong=session.phase==="reveal"&&selected&&!correct.includes(i);
    return '<button type="button" class="option '+(isCorrect?"correct ":isWrong?"wrong ":selected?"selected ":"")+'" data-opt="'+i+'" '+(responded||expired||session.phase==="reveal"?"disabled":"")+'><span class="letter">'+String.fromCharCode(65+i)+'</span>'+escapeHtml(text)+'</button>';
  }).join("")+'</div>';
  let footer="";
  if(session.phase==="reveal"){
    footer='<div class="message good">'+escapeHtml(session.explanation||"")+'</div><p class="helper">'+(me?.lastCorrect&&me?.lastAwardedQuestion===session.questionIndex?"Acertou! +"+(me.lastEarned||0)+" pontos":responded?"Resposta registrada. Aguarde a próxima.":"Tempo encerrado. Aguarde a próxima.")+'</p>';
  }else if(responded){footer='<div class="message good">Resposta enviada! Aguarde a apresentação do resultado.</div>';}
  else if(expired){footer='<div class="message">O tempo acabou. Aguarde o gabarito.</div>';}
  else if(q.multi){footer='<button id="sendMulti" class="btn btn-primary btn-block" '+(selection.size?"":"disabled")+'>Confirmar alternativas ('+selection.size+')</button>';}
  else footer='<p class="helper">Toque em uma alternativa para responder. Você só pode responder uma vez.</p>';
  area.innerHTML=header+'<div class="question">'+escapeHtml(q.text)+'</div>'+(q.multi?'<p class="helper">Marque todas as opções que considerar corretas.</p>':'')+options+footer;
  area.querySelectorAll("[data-opt]").forEach(button=>{
    button.onclick=()=>{
      const i=Number(button.dataset.opt);
      if(q.multi){
        if(selection.has(i))selection.delete(i);else selection.add(i);
        render();
      } else { selection=new Set([i]);render();sendAnswer(); }
    };
  });
  if($("sendMulti"))$("sendMulti").onclick=sendAnswer;
  updateClock();
}
async function sendAnswer(){
  if(submitting||!session||session.phase!=="question"||ready()||selection.size===0)return;
  if(session.deadline?.toMillis && Date.now()>session.deadline.toMillis())return;
  submitting=true;
  try {
    await updateDoc(doc(db,COLLECTION,code,"players",uid),{answer:[...selection].sort((a,b)=>a-b),answerQuestion:session.questionIndex,answeredAt:serverTimestamp()});
  }catch(e){showErrorInside("Não foi possível enviar: "+errorMessage(e));}
  finally{submitting=false;}
}
function updateClock(){
  if(!session||session.phase!=="question")return;
  const remaining=session.deadline?.toMillis?Math.max(0,(session.deadline.toMillis()-Date.now())/1000):0;
  const clock=$("playerClock"),bar=$("playerBar");
  if(clock)clock.textContent=Math.ceil(remaining)+"s";
  if(bar)bar.style.width=Math.min(100,remaining*100/30)+"%";
  if(remaining<=0&&clock&&!ready()){
    areaLock();
  }
}
function areaLock(){
  $("gameArea").querySelectorAll("[data-opt],#sendMulti").forEach(b=>b.disabled=true);
}
setInterval(updateClock,250);
