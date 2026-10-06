/* Inert task restoration. No MQTT connection or media load until an explicit Play. */
(function(){'use strict';
 let candidateState=null,livePeer=false,settleTimer=null,serial=0,deferredState=null,backgrounded=false,playTicket=0,pendingPlay=0;
 function clearSettle(){clearTimeout(settleTimer);settleTimer=null;serial++}
 function snapshot(){return {name:$f('name-input').value.trim(),room:$f('room-input').value.trim(),tower:+$f('tower-input').value,quality,aspect,muted,duration:nativeState.duration||0,displayTitle:nativeState.title||current()?.title||'',model:{...model,pos:position(),playing:false}}}
 function remember(){if(joined&&P.validState(model))send('remember',{snapshot:snapshot()})}
 function reset(){pendingPlay=0;clearSettle();retainedHold=false;deferredState=null;backgrounded=false;sessionPaused=false;reconnecting=false;candidateState=null;livePeer=false}
 function hold(){
  if(!joined||sessionPaused||retainedHold)return;
  retainedHold=true;remember();window.FamilyGestures?.cancel();
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
  if(!room.connected){toast('Tower connect hone do. Buffer yahin hai.');return}
  pendingPlay=++playTicket;send('userPlay',{id:pendingPlay});
 }
 function playGranted(id,allowed){
  if(id!==pendingPlay)return;pendingPlay=0;
  if(!allowed||!joined||!retainedHold||document.hidden||backgrounded)return;
  const old=model.current,remote=deferredState,changed=remote&&P.compare(remote.epoch,model.epoch)>0;
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
   room.publish(model);
   if(reload)loadTrack();else{if(changed&&Math.abs(target-position())>.2)send('seek',{position:target});send('resume')}
  }
  remember();refresh();armHide();
 }
 window.familyRestore=data=>{
  if(joined||!data||!P.validState(data.model)||typeof data.name!=='string'||typeof data.room!=='string'||![0,1,2].includes(data.tower))return;
  reset();model=JSON.parse(JSON.stringify(data.model));model.playing=false;joined=true;sessionPaused=true;bootstrap=false;joinHold=false;
  quality=[144,240,360,480,720,1080].includes(data.quality)?data.quality:144;aspect=Number.isInteger(data.aspect)&&data.aspect>=0&&data.aspect<6?data.aspect:0;muted=!!data.muted;
  $f('name-input').value=data.name;$f('room-input').value=data.room;$f('tower-input').value=data.tower;$f('f-room-title').textContent=data.room;
  nativeState={id:model.current,ready:false,pending:false,position:model.pos,duration:Number.isFinite(data.duration)?data.duration:0,title:String(data.displayTitle||'')};
  waiting=false;errorFlag=false;connection='paused';peerCount=0;loadKey='';
  $f('join-screen').hidden=true;$f('f-player').hidden=false;document.body.classList.add('f-watching');document.documentElement.classList.add('f-watching');$f('f-player').classList.remove('f-controls-off');
  $f('f-mute').setAttribute('aria-pressed',String(muted));$f('f-mute').innerHTML=muted?'<span aria-hidden="true">×</span>':fi('volume');
  // Restores only layout and device-local mute preference; never joins/loads/resumes here.
  send('restore');send('mute',{muted});refresh();remember();
 };
 async function resume(){
  if(!joined||!sessionPaused||document.hidden)return;
  clearSettle();const ticket=serial;candidateState=null;livePeer=false;sessionPaused=false;reconnecting=true;connection='connecting';bootstrap=false;joinHold=false;
  send('join');refresh();
  try{const promise=room.join($f('name-input').value.trim(),$f('room-input').value.trim(),+$f('tower-input').value);sync=makeSync();await promise;if(ticket!==serial||!joined||sessionPaused)return;}
  catch(e){if(ticket!==serial)return;connection='error';refresh();toast('Tower connect nahi hua. Back karke retry karo.');}
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
   const local=JSON.parse(JSON.stringify(model)),remote=candidateState;reconnecting=false;bootstrap=false;
   const highest=remote&&P.compare(remote.epoch,local.epoch)>0?remote.epoch:local.epoch;
   // A live room is authoritative even if it restarted with a lower revision.
   // Never inject the detached local revision into its anchor probes.
   sync.remoteCommand(livePeer&&remote?remote.epoch:highest);
   if(livePeer&&remote){
    model=remote;
    if(model.playing){joinHold=true;sync.needAnchor=true;}
    else{model={...model,playing:!!model.current,kind:'resume',epoch:sync.localCommand()};joinHold=false;room.publish(model);}
   }else{
    // A solo user resumes the locally captured decoder position, not an older retained heartbeat.
    model={...local,playing:!!local.current,kind:'select',epoch:sync.localCommand()};joinHold=false;room.publish(model);
   }
   remember();if(retainedHold){refresh();return}if(current())loadTrack();else{refresh();openDrawer('source')}
  },2500);
 }
 window.FamilySession={remember,reset,suspend,resume,status,candidate,hold,defer,resumeRetained,playGranted};
})();
