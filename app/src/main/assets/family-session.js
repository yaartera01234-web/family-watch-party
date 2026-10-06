/* Inert task restoration. No MQTT connection or media load until an explicit Play. */
(function(){'use strict';
 let candidateState=null,livePeer=false,settleTimer=null,serial=0,deferredState=null,backgrounded=false,playTicket=0,pendingPlay=0,resumeForOffline=false;
 function clearSettle(){clearTimeout(settleTimer);settleTimer=null;serial++}
 function snapshot(){return {name:$f('name-input').value.trim(),room:$f('room-input').value.trim(),tower:+$f('tower-input').value,quality,aspect,muted,independent:!!independentMode,duration:nativeState.duration||0,displayTitle:nativeState.title||current()?.title||'',model:{...model,pos:position(),playing:false}}}
 function remember(){if(joined&&P.validState(model)){window.familyPersistLocalState?.();send('remember',{snapshot:snapshot()})}}
 function reset(){pendingPlay=0;resumeForOffline=false;clearSettle();retainedHold=false;deferredState=null;backgrounded=false;sessionPaused=false;reconnecting=false;candidateState=null;livePeer=false}
 function hold(){
  if(!joined||sessionPaused||retainedHold)return;
  retainedHold=true;resumeForOffline=false;remember();window.FamilyGestures?.cancel();
  seekDragging=false;seekDraft=null;joinHold=false;sync?.suspend();
  clearTimeout(hideTimer);clearTimeout(toastTimer);closeDrawer();
  send('background');$f('f-player').classList.remove('f-controls-off');refresh();
 }
 function suspend(){pendingPlay=0;backgrounded=true;hold()}
 window.familyBackground=(hidden,nativeId)=>{backgrounded=!!hidden;if(hidden){pendingPlay=0;hold();}else{
  // A foreground load command may have been fenced by a simultaneous native onPause.
  // Recover only on the next explicit Play, never resume the wrong retained decoder.
  if(joined&&typeof nativeId==='string'&&nativeId!==model.current)loadKey='';
  refresh();
 }};
 function defer(state){if(!deferredState||P.compare(state.epoch,deferredState.epoch)>=0)deferredState=JSON.parse(JSON.stringify(state))}
 function resumeRetained(){
  if(!joined||!retainedHold||document.hidden||backgrounded)return;
  if(!room.connected&&!independentMode){toast('Tower connect hone do. Buffer yahin hai.');return}
  pendingPlay=++playTicket;send('userPlay',{id:pendingPlay});
 }
 function playGranted(id,allowed){
  if(id!==pendingPlay)return;pendingPlay=0;
  if(!allowed||!joined||!retainedHold||document.hidden||backgrounded)return;
  if(!sync)sync=makeSync();const old=model.current,remote=deferredState,changed=remote&&P.compare(remote.epoch,model.epoch)>0;
  retainedHold=false;deferredState=null;
  if(changed){model=remote;sync.remoteCommand(model.epoch)}
  const t=current();if(!t){refresh();openDrawer('source');return}
  const reload=old!==model.current||loadKey!==model.current||errorFlag||(nativeState.quality>0&&quality!==nativeState.quality);
  if(model.playing&&peerCount>1){
   // Reuse the live decoder/cache. A real peer anchor can seek only after this explicit Play.
   sync.barrier(true);joinHold=true;
   if(reload)loadTrack();else send('pause');
  }else{
   joinHold=false;
   const target=changed?model.pos:position();
   model={...model,pos:target,playing:true,kind:'resume',epoch:sync.localCommand()};
   if(room.connected&&!independentMode)room.publish(model);
   if(reload)loadTrack();else{if(changed&&Math.abs(target-position())>.2)send('seek',{position:target});send('resume')}
  }
  remember();refresh();armHide();
 }
 window.familyRestore=data=>{
  if(joined||!data||!P.validState(data.model)||typeof data.name!=='string'||typeof data.room!=='string'||![0,1,2].includes(data.tower))return;
  reset();model=JSON.parse(JSON.stringify(data.model));model.playing=false;joined=true;sessionPaused=true;independentMode=!!data.independent;roomEverConnected=false;bootstrap=false;joinHold=false;sync=makeSync();
  quality=[144,240,360,480,720,1080].includes(data.quality)?data.quality:144;aspect=Number.isInteger(data.aspect)&&data.aspect>=0&&data.aspect<6?data.aspect:0;muted=!!data.muted;
  $f('name-input').value=data.name;$f('room-input').value=data.room;$f('tower-input').value=data.tower;$f('f-room-title').textContent=data.room;
  nativeState={id:model.current,ready:false,pending:false,position:model.pos,duration:Number.isFinite(data.duration)?data.duration:0,title:String(data.displayTitle||'')};
  waiting=false;errorFlag=false;connection=independentMode?'independent':'paused';peerCount=0;loadKey='';
  $f('join-screen').hidden=true;$f('f-player').hidden=false;document.body.classList.add('f-watching');document.documentElement.classList.add('f-watching');$f('f-player').classList.remove('f-controls-off');
  $f('f-mute').setAttribute('aria-pressed',String(muted));$f('f-mute').innerHTML=muted?'<span aria-hidden="true">×</span>':fi('volume');
  // Restores only layout and device-local mute preference; never joins/loads/resumes here.
  send('restore');send('mute',{muted});refresh();remember();
 };
 async function resume(){
  if(!joined||!sessionPaused||document.hidden)return;
  clearSettle();candidateState=null;livePeer=false;sessionPaused=false;reconnecting=true;connection='connecting';bootstrap=false;joinHold=false;
  send('join');refresh();
  if(independentMode){
   reconnecting=false;if(!sync)sync=makeSync();
   if(current()){model={...model,pos:model.pos,playing:true,kind:'resume',epoch:sync.localCommand()};loadKey='';loadTrack();}
   else{refresh();openDrawer('source')}
   remember();return;
  }
  resumeForOffline=true;
  try{await window.familyStartTowerConnect({reconcile:true,restoreCache:true});}
  catch(_){if(!joined)return;window.familyEnterIndependent?.('tower-unavailable',true);}
 }
 function beginReconnect(){pendingPlay=0;candidateState=null;livePeer=false;reconnecting=true;sessionPaused=false}
 function offline(){
  clearSettle();candidateState=null;livePeer=false;reconnecting=false;
  const shouldResume=resumeForOffline;resumeForOffline=false;
  if(shouldResume&&joined&&!sessionPaused){
   if(!sync)sync=makeSync();
   if(current()){model={...model,pos:position(),playing:true,kind:'resume',epoch:sync.localCommand()};loadKey='';loadTrack();}
   else{refresh();openDrawer('source')}
  }else refresh();
 }

 function candidate(state,meta){
  if(!reconnecting||sessionPaused)return;
  if(!candidateState||P.compare(state.epoch,candidateState.epoch)>0)candidateState=JSON.parse(JSON.stringify(state));
  if(meta&&meta.retained===false)livePeer=true;
 }
 function status(state){
  if(!reconnecting)return;
  clearTimeout(settleTimer);settleTimer=null;
  if(state!=='connected')return;
  const ticket=serial;
  settleTimer=setTimeout(()=>{
   settleTimer=null;if(ticket!==serial||!joined||sessionPaused||!reconnecting||!room.connected)return;
   const oldId=model.current,decoderReady=nativeState.id===model.current&&nativeState.ready&&loadKey===model.current;
   const local={...JSON.parse(JSON.stringify(model)),pos:position()},remote=candidateState,recovering=resumeForOffline;
   resumeForOffline=false;reconnecting=false;bootstrap=false;
   const highest=remote&&P.compare(remote.epoch,local.epoch)>0?remote.epoch:local.epoch;
   // A live peer is authoritative even if its room restarted at a lower revision.
   // Otherwise keep this device's latest independent queue, position and play state.
   if(livePeer&&remote)sync.epoch=remote.epoch.slice();
   sync.remoteCommand(livePeer&&remote?remote.epoch:highest);
   if(livePeer&&remote){
    model=remote;
    if(recovering&&model.current&&!model.playing){model={...model,playing:true,kind:'resume',epoch:sync.localCommand()};room.publish(model);joinHold=false;sync.needAnchor=false;}
    else if(model.playing){joinHold=oldId!==model.current||!decoderReady;sync.needAnchor=joinHold;}
    else{joinHold=false;model={...model,kind:'resume'};room.publish(model);}
   }else{
    model={...local,playing:recovering?!!local.current:local.playing,kind:recovering?'select':'resume',epoch:sync.localCommand()};joinHold=false;room.publish(model);
   }
   remember();if(retainedHold){refresh();return}
   if(current()){
    const readySame=nativeState.id===model.current&&nativeState.ready&&loadKey===model.current;
    if(!readySame)loadTrack();
    else if(livePeer){if(!model.playing)send('pause');refresh();armHide()}
    else{if(!!nativeState.playing!==!!model.playing)send(model.playing?'resume':'pause');refresh();armHide()}
   }else{refresh();openDrawer('source')}
  },2500);
 }

 window.FamilySession={remember,reset,suspend,resume,status,candidate,hold,defer,resumeRetained,playGranted,beginReconnect,offline};
})();
