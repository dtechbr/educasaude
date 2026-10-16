import { auth, db, COLLECTION, baseUrl, escapeHtml, errorMessage } from "./firebase.js";
import { QUESTIONS } from "./questions.js";
import { GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { collection, doc, getDoc, getDocs, setDoc, updateDoc, onSnapshot, runTransaction, Timestamp, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

const $ = id => document.getElementById(id);
let user = null, code = null, game = null, players = [], detachGame = null, detachPlayers = null, revealing = false, working = false;
const byScore = (a,b) => (b.points||0)-(a.points||0) || a.name.localeCompare(b.name,"pt-BR");
const setError = (id,error) => { const el=$(id);el.textContent=typeof error==="string"?error:errorMessage(error);el.classList.remove("hidden"); };
const clearError = id => { $(id).classList.add("hidden"); };
const provider = new GoogleAuthProvider();
provider.setCustomParameters({prompt:"select_account"});
const isGoogle = user => !!user?.providerData?.some(p=>p.providerId==="google.com");

$("loginBtn").onclick = async () => {
  clearError("loginError");
  try { await signInWithPopup(auth,provider); } catch(e){ setError("loginError",e); }
};
$("logoutBtn").onclick = async () => {
  localStorage.removeItem("rosaQuizHostCode"); closeListeners(); game=null;code=null;
  await signOut(auth);
};
function closeListeners(){
  if(detachGame){detachGame();detachGame=null;}
  if(detachPlayers){detachPlayers();detachPlayers=null;}
}
function roomRef(){return doc(db,COLLECTION,code);}
function attach(newCode){
  closeListeners(); code=newCode;
  localStorage.setItem("rosaQuizHostCode",code);
  $("loginPanel").classList.add("hidden");
  $("createPanel").classList.add("hidden");
  $("hostPanel").classList.remove("hidden");
  $("roomCode").textContent=code;
  const join = baseUrl+"?s="+encodeURIComponent(code);
  $("joinUrl").textContent=join;
  $("qrcode").replaceChildren();
  if(typeof QRCode!=="undefined") new QRCode($("qrcode"),{text:join,width:170,height:170,correctLevel:QRCode.CorrectLevel.M});
  else $("qrcode").textContent="Compartilhe o link acima";
  detachGame=onSnapshot(roomRef(), snap=>{
    if(!snap.exists()){setError("hostError","Partida não encontrada.");return;}
    game=snap.data(); render(); 
  },e=>setError("hostError",e));
  detachPlayers=onSnapshot(collection(db,COLLECTION,code,"players"),snap=>{
    players=snap.docs.map(d=>({id:d.id,...d.data()})).sort(byScore);render();
  },e=>setError("hostError",e));
}
onAuthStateChanged(auth,async current=>{
  user=current;
  $("loginPanel").classList.toggle("hidden",isGoogle(user));
  $("createPanel").classList.toggle("hidden",!isGoogle(user));
  if(!isGoogle(user)){closeListeners();game=null;code=null;$("hostPanel").classList.add("hidden");return;}
  const saved=localStorage.getItem("rosaQuizHostCode");
  if(saved && /^\d{6}$/.test(saved)){
    try{
      const snap=await getDoc(doc(db,COLLECTION,saved));
      if(snap.exists() && snap.data().ownerId===user.uid){attach(saved);return;}
    }catch(e){setError("createError",e);}
  }
  $("createPanel").classList.remove("hidden");
});

$("createBtn").onclick = async () => {
  if(working)return;
  working=true;$("createBtn").disabled=true;clearError("createError");
  try{
    if(!isGoogle(user))throw Error("Faça login com uma conta Google para apresentar.");
    let createdCode=null;
    for(let i=0;i<12;i++){
      const bytes=new Uint32Array(1);crypto.getRandomValues(bytes);
      const candidate=String(100000+(bytes[0]%900000));
      const ref=doc(db,COLLECTION,candidate);
      if((await getDoc(ref)).exists())continue;
      await setDoc(ref,{ownerId:user.uid,ownerName:user.displayName||"Apresentador",phase:"lobby",
        questionIndex:-1,question:null,correct:null,explanation:null,deadline:null,
        createdAt:serverTimestamp(),updatedAt:serverTimestamp()});
      createdCode=candidate;break;
    }
    if(!createdCode)throw Error("Não foi possível gerar um código. Tente novamente.");
    attach(createdCode);
  }catch(e){setError("createError",e);}
  finally{working=false;$("createBtn").disabled=false;}
};

async function advance(){
  if(working||!game||!user||game.ownerId!==user.uid)return;
  const idx=game.questionIndex+1;
  if(idx>=QUESTIONS.length){await finish();return;}
  working=true;$("nextBtn").disabled=true;clearError("hostError");
  const q=QUESTIONS[idx];
  try {
    await updateDoc(roomRef(),{
      phase:"question",questionIndex:idx,question:{text:q.text,options:q.options,multi:q.correct.length>1},
      correct:null,explanation:null,deadline:Timestamp.fromMillis(Date.now()+30000),updatedAt:serverTimestamp()
    });
  }catch(e){setError("hostError",e);}finally{working=false;render();}
}
$("nextBtn").onclick=advance;

async function reveal(){
  if(revealing||!game||game.phase!=="question")return;
  revealing=true;$("revealBtn").disabled=true;clearError("hostError");
  const ref=roomRef();
  try {
    // Snapshot dos IDs, cálculo e escrita atômicos; evita somar pontos duas vezes.
    const all=await getDocs(collection(db,COLLECTION,code,"players"));
    await runTransaction(db, async tx=>{
      const session=await tx.get(ref);
      if(!session.exists() || session.data().phase!=="question")return;
      const s=session.data(),idx=s.questionIndex,q=QUESTIONS[idx];
      const ps=[];
      for(const docSnap of all.docs){ ps.push({ref:docSnap.ref,snap:await tx.get(docSnap.ref)}); }
      // Todas as leituras acima são feitas antes da primeira gravação.
      for(const item of ps){
        if(!item.snap.exists())continue;
        const p=item.snap.data();
        const choice=Array.isArray(p.answer)?[...p.answer].sort((a,b)=>a-b):[];
        const correct=[...q.correct].sort((a,b)=>a-b);
        const wasCorrect=p.answerQuestion===idx && choice.length===correct.length && choice.every((v,i)=>v===correct[i]);
        const submitted=p.answeredAt?.toMillis?.()??Infinity;
        const remaining=s.deadline?.toMillis?Math.max(0,(s.deadline.toMillis()-submitted)/1000):0;
        const valid=wasCorrect && submitted<=s.deadline.toMillis();
        const earned=valid?1000+Math.floor(remaining*20):0;
        tx.update(item.ref,{points:(p.points||0)+earned,lastCorrect:valid,lastAwardedQuestion:idx,lastEarned:earned});
      }
      tx.update(ref,{phase:"reveal",correct:q.correct,explanation:q.explanation,updatedAt:serverTimestamp()});
    });
  } catch(e){setError("hostError",e);}
  finally {revealing=false;render();}
}
$("revealBtn").onclick=reveal;

async function finish(){
  if(!game||game.phase==="finished")return;
  if(!confirm("Encerrar esta partida e mostrar a classificação final?"))return;
  clearError("hostError");
  try{
    if(game.phase==="question")await reveal();
    await updateDoc(roomRef(),{phase:"finished",updatedAt:serverTimestamp()});
  }catch(e){setError("hostError",e);}
}
$("finishBtn").onclick=finish;
$("copyBtn").onclick=async()=>{try{await navigator.clipboard.writeText(baseUrl+"?s="+code);$("copyBtn").textContent="Link copiado ✓";setTimeout(()=>$("copyBtn").textContent="Copiar link",1500);}catch(e){setError("hostError","Não foi possível copiar automaticamente. Selecione o link exibido.");}};
$("fullscreenBtn").onclick=()=>{if(!document.fullscreenElement) document.documentElement.requestFullscreen?.();else document.exitFullscreen?.();};

function render(){
  if(!game)return;
  const phase=game.phase;
  $("totalPlayers").textContent=players.length;
  $("questionNum").textContent=Math.max(0,game.questionIndex+1)+"/"+QUESTIONS.length;
  $("phaseBadge").textContent={lobby:"Aguardando participantes",question:"Respondendo",reveal:"Gabarito",finished:"Finalizada"}[phase]||phase;
  const answers=players.filter(p=>p.answerQuestion===game.questionIndex).length;
  $("answeredCount").textContent=phase==="question"||phase==="reveal"?answers+" de "+players.length+" respostas":"Participantes";
  $("nextBtn").classList.toggle("hidden",phase==="question"||phase==="finished");
  $("nextBtn").textContent=phase==="lobby"?"Começar as perguntas":game.questionIndex>=QUESTIONS.length-1?"Mostrar resultado final":"Próxima pergunta →";
  $("nextBtn").disabled=working;
  $("revealBtn").classList.toggle("hidden",phase!=="question");
  $("revealBtn").disabled=revealing;
  $("finishBtn").classList.toggle("hidden",phase==="finished");
  $("hostLeaderboard").innerHTML=players.length?players.map((p,i)=>
    '<div class="person"><div><span class="place">'+(i+1)+'</span><span class="name">'+escapeHtml(p.name)+'</span></div><span class="score">'+(p.points||0).toLocaleString("pt-BR")+' pts</span></div>'
  ).join(""):'<div class="helper">Os participantes aparecerão aqui.</div>';
  if(phase==="lobby"){
    $("questionProgress").textContent="Sala aberta";
    $("questionArea").innerHTML='<div class="bigcenter"><h2>Preparem os celulares!</h2><p>Compartilhe o código da sala para entrar no jogo.</p></div>';
  } else if(phase==="finished"){
    $("questionProgress").textContent="Partida encerrada";
    $("questionArea").innerHTML='<div class="bigcenter"><h2>🏆 Fim de jogo!</h2><p>Parabéns a todos. Confira a classificação final no ranking.</p></div>';
  } else {
    $("questionProgress").textContent="Pergunta "+(game.questionIndex+1)+" de "+QUESTIONS.length;
    const correct=Array.isArray(game.correct)?game.correct:[];
    $("questionArea").innerHTML='<div class="question">'+escapeHtml(game.question.text)+'</div>'+
      (game.question.multi?'<p class="helper">Selecione todas as alternativas corretas.</p>':'')+
      '<div class="option-list">'+game.question.options.map((opt,i)=>'<div class="option '+(phase==="reveal"&&correct.includes(i)?"correct":"")+'"><span class="letter">'+String.fromCharCode(65+i)+'</span>'+escapeHtml(opt)+'</div>').join("")+'</div>'+
      (phase==="reveal"?'<div class="message good">'+escapeHtml(game.explanation||"")+'</div>':'');
  }
  updateClock();
}
function updateClock(){
  if(!game)return;
  const remaining=game.phase==="question"&&game.deadline?.toMillis?Math.max(0,(game.deadline.toMillis()-Date.now())/1000):0;
  $("bigClock").textContent=game.phase==="question"?Math.ceil(remaining)+"s":"";
  $("timeRemaining").textContent=game.phase==="question"?Math.ceil(remaining)+"s":"—";
  $("timerBar").style.width=(game.phase==="question"?Math.min(100,remaining*100/30):game.phase==="reveal"?100:0)+"%";
  if(game.phase==="question"&&remaining<=0&&!revealing)reveal();
}
setInterval(updateClock,250);
