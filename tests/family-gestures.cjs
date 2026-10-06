'use strict';
const vm=require('node:vm'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const code=fs.readFileSync(path.join(__dirname,'../app/src/main/assets/family-gestures.js'),'utf8');
function rig(width,height){const elements=new Map(),sent=[],timers=new Map(),events={};let clock=0,n=0;
class El{constructor(){this.handlers={};this.hidden=true;this.dataset={};this.style={};this.textContent=''}addEventListener(t,f){this.handlers[t]=f}getBoundingClientRect(){return {left:0,top:0,width,height}}setPointerCapture(id){this.capture=id}releasePointerCapture(id){if(this.capture===id){this.capture=null;this.handlers.lostpointercapture?.({pointerId:id})}}}
const $f=id=>{if(!elements.has(id))elements.set(id,new El());return elements.get(id)};
const c={joined:true,drawerKind:'',seekDragging:false,muted:false,$f,performance:{now:()=>clock},setTimeout:f=>{timers.set(++n,f);return n},clearTimeout:id=>timers.delete(id),send:(action,data)=>sent.push({action,...data}),addEventListener:(t,f)=>events[t]=f,document:{hidden:false,addEventListener:(t,f)=>events[t]=f}};c.window=c;vm.createContext(c);vm.runInContext(code,c);
function fire(type,x,y,extra={}){const e={pointerId:1,pointerType:'touch',isPrimary:true,button:0,clientX:x,clientY:y,cancelable:true,preventDefault(){this.prevented=true},...extra};$f('f-picture').handlers[type](e);return e}
return {c,$f,fire,sent,timers,events,tick:()=>{clock+=1000;for(const f of [...timers.values()])f()}}}
for(const [w,h] of [[820,390],[390,844]]){
 const a=rig(w,h);a.fire('pointerdown',w*.2,h*.7);a.fire('pointermove',w*.2,h*.69);assert.equal(a.sent.length,0);
 a.fire('pointermove',w*.2,h*.4);assert.equal(a.sent[0].action,'gestureBegin');assert.equal(a.sent[0].kind,'brightness');assert(a.sent[1].delta>0);const id=a.sent[0].id;
 a.c.familyGestureLevel({id,kind:'brightness',percent:75});assert.equal(a.$f('f-gesture-value').textContent,'75%');assert.equal(a.$f('f-gesture-fill').style.width,'75%');assert.equal(a.$f('f-gesture-hud').hidden,false);
 a.fire('pointerup',w*.2,h*.4);assert(a.c.FamilyGestures.consumeTap());assert.equal(a.sent.at(-1).action,'gestureEnd');assert.equal(a.$f('f-gesture-hud').hidden,false);a.tick();assert(a.$f('f-gesture-hud').hidden);
 const count=a.sent.length;a.fire('pointerdown',w*.8,h*.4);a.fire('pointerup',w*.8,h*.4);assert.equal(a.sent.length,count);assert(!a.c.FamilyGestures.consumeTap());
 a.fire('pointerdown',w*.8,h*.3);a.fire('pointermove',w*.8,h*.6);assert.equal(a.sent.at(-2).kind,'volume');assert(a.sent.at(-1).delta<0);const volumeId=a.sent.at(-1).id;
 a.c.familyGestureLevel({id:volumeId,kind:'volume',percent:30});assert.equal(a.$f('f-gesture-label').textContent,'Volume');a.c.familyGestureLevel({id,kind:'brightness',percent:99});assert.equal(a.$f('f-gesture-value').textContent,'30%');
 a.fire('pointercancel',w*.8,h*.6);assert.equal(a.$f('f-gesture-hud').hidden,true);
 const count2=a.sent.length;a.fire('pointerdown',w*.2,h*.5);a.fire('pointermove',w*.5,h*.51);a.fire('pointerup',w*.5,h*.51);assert.equal(a.sent.length,count2);assert(a.c.FamilyGestures.consumeTap());
 a.c.drawerKind='playlist';a.fire('pointerdown',w*.2,h*.8);a.fire('pointermove',w*.2,h*.3);assert.equal(a.sent.length,count2);a.c.drawerKind='';
 a.c.seekDragging=true;a.fire('pointerdown',w*.2,h*.8);a.fire('pointermove',w*.2,h*.3);assert.equal(a.sent.length,count2);a.c.seekDragging=false;
 a.fire('pointerdown',w*.8,h*.7);a.fire('pointermove',w*.8,h*.4);a.c.document.hidden=true;a.events.visibilitychange();assert.equal(a.sent.at(-1).action,'gestureEnd');assert(a.$f('f-gesture-hud').hidden);assert.equal(a.timers.size,0);
 a.c.joined=false;const count3=a.sent.length;a.fire('pointerdown',w*.2,h*.7);a.fire('pointermove',w*.2,h*.3);assert.equal(a.sent.length,count3);
 assert(a.sent.every(x=>['gestureBegin','gestureMove','gestureEnd'].includes(x.action)));
}
console.log('PASS portrait/landscape gesture routing/direction, threshold, native-ack HUD, tap vs swipe, horizontal rejection, stale acknowledgements, controls/seek exclusion, cancellation and foreground cleanup. DOM/native mocked.');
