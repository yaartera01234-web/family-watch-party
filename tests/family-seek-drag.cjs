'use strict';
// Real family.js callbacks; fake DOM/native bridge. No Android or decoder claim.
const vm=require('node:vm'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const source=fs.readFileSync(path.join(__dirname,'../app/src/main/assets/family.js'),'utf8');
function rig(code){const nodes=new Map(),commands=[],timers=new Map();let n=0;
class El{constructor(){this._value='0';this.hidden=false;this.disabled=false;this.classList={add(){},remove(){},toggle(){},contains(){return false}};this.dataset={};this.textContent='';this.isConnected=true}get value(){return this._value}set value(v){this._value=String(v)}setAttribute(){}focus(){}setCustomValidity(){}reportValidity(){}}
const el=id=>{if(!nodes.has(id))nodes.set(id,new El());return nodes.get(id)};
const document={getElementById:el,querySelectorAll:()=>[],addEventListener(){},body:new El(),documentElement:new El()};
const context={document,console,URL,performance:{now:()=>1000},setTimeout:f=>{timers.set(++n,f);return n},clearTimeout:id=>timers.delete(id),localStorage:{getItem:()=>null,setItem(){}},FamilyProtocol:{},FamilyRoom:class{constructor(){this.connected=true;this.id='test'}publish(){}leave(){}},WPSyncRoom:class{},FamilyNative:{postMessage:raw=>commands.push(JSON.parse(raw))},addEventListener(){}};context.window=context;vm.createContext(context);vm.runInContext(code,context);
vm.runInContext("joined=true;model={epoch:[1,'test'],queue:[{id:'movie',url:'https://example.com/movie.mp4',title:'Movie'}],current:'movie',pos:11,playing:true,kind:'select'};loadKey='movie';sync={localCommand:()=>[2,'test'],suspend(){}}",context);
const state=pos=>context.familyNativeState({id:'movie',ready:true,pending:false,position:pos,duration:7200,playing:true,buffering:false,ended:false,speed:1,title:'Movie',video:720,quality:0,tracks:[]});state(11);return{el,context,commands,state,timers,run:s=>vm.runInContext(s,context)}}
const a=rig(source),slider=a.el('f-seek');slider.onpointerdown();slider.value=611;slider.oninput({target:slider});for(let i=0;i<10;i++)a.state(11+i*.3);assert.equal(slider.value,'611');assert.equal(a.el('f-time-now').textContent,'10:11');assert.equal(a.commands.filter(c=>c.action==='seek').length,0);slider.onchange({target:slider});assert.equal(a.commands.filter(c=>c.action==='seek').at(-1).position,611);a.state(611);assert.equal(slider.value,'611');
// Reverse seek and native updates while dragging; exactly one command on release.
slider.onpointerdown();slider.value=30;slider.oninput({target:slider});a.state(612);slider.onchange({target:slider});assert.equal(a.commands.filter(c=>c.action==='seek').at(-1).position,30);
const count=a.commands.filter(c=>c.action==='seek').length;slider.onpointerdown();slider.value=1200;slider.oninput({target:slider});slider.onpointercancel();assert.equal(a.commands.filter(c=>c.action==='seek').length,count);assert.equal(a.run('seekDragging'),false);
// Keyboard input/change also commits the draft; blur cancels without seeking.
slider.value=750;slider.oninput({target:slider});a.state(613);slider.onchange({target:slider});assert.equal(a.commands.filter(c=>c.action==='seek').at(-1).position,750);slider.onpointerdown();slider.value=1000;slider.oninput({target:slider});slider.onblur();assert.equal(a.run('seekDragging'),false);
a.run('leave()');assert.equal(a.run('seekDragging'),false);assert.equal(a.run('seekDraft'),null);
// Negative control: show the old unconditional refresh would overwrite a drag.
const old=source.replace("if(!seekDragging){$f('f-seek').max=real&&s.duration||0;$f('f-seek').value=position();$f('f-seek').disabled=!real||!s.ready||!s.duration;}","$f('f-seek').max=real&&s.duration||0;$f('f-seek').value=position();$f('f-seek').disabled=!real||!s.ready||!s.duration;");assert.notEqual(old,source);const b=rig(old),s=b.el('f-seek');s.onpointerdown();s.value=611;s.oninput({target:s});b.state(12);assert.equal(s.value,'12');
console.log('PASS real UI callbacks: 10-minute drag resists 10 stale progress updates; one target command, reverse/keyboard seek, cancellation/blur/leave, and old-refresh negative control. DOM/native mocked.');
