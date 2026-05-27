/* loading-init.js — 加载动画与 token 状态检查（从 index.html 内联块提取） */
(function(){
'use strict';

var cur = 0;
var animPhase = 0;
var halfReady = false;
var fullReady = false;
var finished = false;

function setDot(n, state){
  for(var i=1;i<=8;i++){
    var el=document.getElementById('lstep'+i);
    if(!el)continue;
    if(i<n){
      el.className='loading-step done';
    }else if(i===n){
      el.className='loading-step '+(state==='active'?'active':'done');
    }else{
      el.className='loading-step';
    }
  }
}

function setProgress(v){
  cur=v;
  var b=document.getElementById('loadingProgressBar');
  if(b)b.style.width=v+'%';
  var p=document.getElementById('loadingProgressPct');
  if(p)p.textContent=Math.round(v)+'%';
}

function tryAdvance(){
  if(finished)return;
  if(animPhase===0 && halfReady){
    animPhase=1;
    setProgress(82);
    setDot(7,'active');
  }
  if(animPhase>=1 && fullReady){
    finished=true;
    setProgress(93);
    setDot(8,'active');
    setTimeout(function(){ setProgress(100); },200);
  }
}

window.__onHalfReady = function(){
  halfReady=true;
  tryAdvance();
};

window.__onFullReady = function(){
  fullReady=true;
  tryAdvance();
};

window.__updateLoadingProgress = function(){};

(function runDots(){
  var dots=[1,2,3,4,5,6];
  var total=900;
  var perDot=total/dots.length;
  var progressPerDot=82/dots.length;
  dots.forEach(function(dot,idx){
    setTimeout(function(){
      if(finished)return;
      setProgress(Math.round(progressPerDot*(idx+1)));
      setDot(dot,'active');
      if(dot===6){
        setTimeout(function(){
          if(!finished){ animPhase=0; tryAdvance(); }
        },perDot);
      }
    },perDot*(idx+1));
  });
})();

/* Token 状态检查：若 token 已过期则清除会话状态 */
try{
  var ok=false,i,k,d;
  for(i=0;i<localStorage.length;i++){
    k=localStorage.key(i);
    if(k&&k.startsWith('sb-')&&k.endsWith('-auth-token')){
      try{d=JSON.parse(localStorage.getItem(k));if(d&&d.expires_at&&new Date(d.expires_at*1000)>new Date())ok=true;}catch(e){}
      break;
    }
  }
  if(!ok){
    ['jf_current_state','jf_last_state','jf_current_page','jf_current_filter',
     'jf_current_order_id','jf_current_customer_id','jf_last_page','jf_last_filter',
     'jf_last_order_id','jf_last_customer_id'].forEach(function(k){
      sessionStorage.removeItem(k);localStorage.removeItem(k);
    });
  }
}catch(e){}
})();
