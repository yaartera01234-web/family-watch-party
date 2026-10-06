/* Player-surface gestures only. Device settings never enter MQTT room state. */
(function(){'use strict';
 const surface=$f('f-picture'),hud=$f('f-gesture-hud');let active=null,serial=0,hudId=null,hideTimer=null,suppressUntil=0;
 const now=()=>performance.now();
 function hide(){clearTimeout(hideTimer);hideTimer=null;hudId=null;hud.hidden=true}
 function release(g){try{surface.releasePointerCapture(g.pointer)}catch(e){}}
 function cancel(){const g=active;active=null;if(g){if(g.started)send('gestureEnd',{id:g.id});release(g);if(g.moved)suppressUntil=now()+500}hide()}
 surface.addEventListener('pointerdown',e=>{
  if(!joined||drawerKind||seekDragging||e.isPrimary===false||(e.pointerType==='mouse'&&e.button!==0)){if(active)cancel();return}
  if(active){cancel();return}hide();suppressUntil=0;
  const r=surface.getBoundingClientRect();if(r.width<=0||r.height<=0)return;
  active={pointer:e.pointerId,id:++serial,x:e.clientX,y:e.clientY,height:r.height,kind:e.clientX-r.left<r.width/2?'brightness':'volume',started:false,moved:false,horizontal:false};
  try{surface.setPointerCapture(e.pointerId)}catch(e){}
 });
 surface.addEventListener('pointermove',e=>{
  const g=active;if(!g||e.pointerId!==g.pointer)return;if(!joined||drawerKind){cancel();return}
  const dx=e.clientX-g.x,dy=g.y-e.clientY;
  if(Math.max(Math.abs(dx),Math.abs(dy))>=12)g.moved=true;
  if(!g.started){
   if(Math.abs(dx)>12&&Math.abs(dx)>Math.abs(dy)*1.2)g.horizontal=true;
   if(g.horizontal||Math.abs(dy)<12||Math.abs(dy)<Math.abs(dx)*1.2)return;
   g.started=true;hudId=g.id;send('gestureBegin',{id:g.id,kind:g.kind});
  }
  if(e.cancelable)e.preventDefault();
  send('gestureMove',{id:g.id,delta:Math.max(-4,Math.min(4,dy/Math.max(1,g.height*.65)))});
 });
 function finish(e,canceled){
  const g=active;if(!g||g.pointer!==e.pointerId)return;active=null;
  if(g.moved){suppressUntil=now()+500;if(e.cancelable)e.preventDefault()}
  if(g.started)send('gestureEnd',{id:g.id});release(g);
  if(canceled)hide();else if(g.started){clearTimeout(hideTimer);hideTimer=setTimeout(hide,900)}
 }
 surface.addEventListener('pointerup',e=>finish(e,false));surface.addEventListener('pointercancel',e=>finish(e,true));surface.addEventListener('lostpointercapture',e=>finish(e,true));
 window.familyGestureLevel=data=>{
  if(!joined||!data||data.id!==hudId||!['brightness','volume'].includes(data.kind)||!Number.isFinite(data.percent))return;
  const pct=Math.round(Math.max(0,Math.min(100,data.percent)));hud.dataset.kind=data.kind;
  $f('f-gesture-icon').textContent=data.kind==='brightness'?'☀':pct===0?'🔇':'🔊';
  $f('f-gesture-label').textContent=data.blocked?'Volume unavailable':data.kind==='brightness'?'Brightness':muted?'Volume · muted':'Volume';
  $f('f-gesture-value').textContent=pct+'%';$f('f-gesture-fill').style.width=pct+'%';hud.hidden=false;
 };
 window.FamilyGestures={cancel,consumeTap:()=>now()<suppressUntil};
 window.addEventListener('resize',cancel);window.addEventListener('pagehide',cancel);document.addEventListener('visibilitychange',()=>{if(document.hidden)cancel()});
})();
