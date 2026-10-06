'use strict';
// Exercise production UI + session + sync policy together. DOM/transport/Android mocked.
const vm=require('node:vm'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const assets=path.resolve(__dirname,'../app/src/main/assets');
const protocol=require(path.join(assets,'family-room.js'));
function rig(){
 const nodes=new Map(),commands=[],timers=new Map(),publications=[];let n=0;
 class El{constructor(){this.value='';this.hidden=false;this.classList={add(){},remove(){},toggle(){},contains(){return false}};this.dataset={};this.isConnected=true}setAttribute(){}focus(){}setCustomValidity(){}reportValidity(){}}
 const el=id=>{if(!nodes.has(id))nodes.set(id,new El());return nodes.get(id)};
 const document={getElementById:el,querySelectorAll:()=>[],addEventListener(){},body:new El(),documentElement:new El(),hidden:false};
 const c={document,console,URL,performance:{now:()=>1000},setTimeout:(f,ms)=>{timers.set(++n,{f,ms});return n},clearTimeout:id=>timers.delete(id),localStorage:{getItem:()=>null,setItem(){}},FamilyProtocol:protocol,FamilyRoom:class{constructor(o){this.o=o;this.connected=false;this.id='test';this.joins=0;this.leaves=0}async join(){this.joins++;this.connected=true;this.o.status('connected')}publish(s){publications.push(JSON.parse(JSON.stringify(s)))}send(){}leave(){this.leaves++;this.connected=false}},FamilyNative:{postMessage:raw=>commands.push(JSON.parse(raw))},addEventListener(){}};
 c.window=c;vm.createContext(c);
 for(const f of ['sync-policy.js','sync-room.js','family.js','family-session.js'])vm.runInContext(fs.readFileSync(path.join(assets,f),'utf8'),c);
 const run=s=>vm.runInContext(s,c);
 const settle=()=>{for(const [id,t] of [...timers])if(t.ms===2500){timers.delete(id);t.f()}};
 return{c,commands,publications,timers,el,run,settle};
}
const saved={name:'Family',room:'Movie',tower:0,quality:720,aspect:3,muted:true,duration:7200,displayTitle:'Saved movie',model:{epoch:[5,'old'],queue:[{id:'movie',url:'https://example.com/movie.mp4',title:'Movie'}],current:'movie',pos:611,playing:true,kind:'select'}};
function restore(){const a=rig();a.c.familyRestore(JSON.parse(JSON.stringify(saved)));return a}
(async()=>{
 const a=restore();assert.equal(a.run('joined&&sessionPaused&&!model.playing'),true);assert.equal(a.run('room.joins'),0);assert.equal(a.commands.filter(x=>['join','load','resume'].includes(x.action)).length,0);assert.equal(a.el('f-time-now').textContent,'10:11');assert.equal(a.el('f-time-total').textContent,'2:00:00');assert.equal(a.run('quality'),720);assert.equal(a.run('aspect'),3);assert.equal(a.run('muted'),true);
 // Old retained state must not rewind a solo returning user.
 await a.c.FamilySession.resume();a.run('receiveState('+JSON.stringify({...saved.model,pos:100,playing:true})+',{retained:true})');a.settle();let load=a.commands.find(x=>x.action==='load');assert.equal(load.position,611);assert.equal(load.playing,true);assert.equal(a.publications.length,1);assert(a.publications[0].epoch[0]>5);
 // A live peer's newer movie wins over the locally saved selection. Anchor before playback.
 const b=restore();await b.c.FamilySession.resume();const live={...saved.model,epoch:[9,'peer'],queue:[{id:'new',url:'https://example.com/new.mp4',title:'New'}],current:'new',pos:901,playing:true};b.run('receiveState('+JSON.stringify(live)+',{retained:false})');b.run('publishSnapshot()');assert.equal(b.publications.length,0);b.settle();load=b.commands.find(x=>x.action==='load');assert.equal(load.id,'new');assert.equal(load.position,901);assert.equal(load.playing,false);assert.equal(b.run('joinHold&&sync.needAnchor'),true);assert.equal(b.publications.length,0);
 // Explicit Play in a currently paused live room uses the room's position, not cached position.
 const d=restore();await d.c.FamilySession.resume();d.run('receiveState('+JSON.stringify({...live,playing:false})+',{retained:false})');d.settle();assert.equal(d.commands.find(x=>x.action==='load').position,901);assert.equal(d.commands.find(x=>x.action==='load').playing,true);assert.equal(d.publications[0].kind,'resume');
 // A live peer's cleared queue must not resurrect a locally saved movie.
 const empty=restore();await empty.c.FamilySession.resume();empty.run('receiveState('+JSON.stringify({...live,queue:[],current:null,pos:0,playing:false})+',{retained:false})');empty.settle();assert.equal(empty.commands.filter(x=>x.action==='load').length,0);assert.equal(empty.run('model.queue.length'),0);assert.equal(empty.run('model.playing'),false);
 // Suspending during reconnect invalidates the pending continuation, and stale native/room events.
 const e=restore();await e.c.FamilySession.resume();const pending=[...e.timers.values()].find(t=>t.ms===2500).f;e.c.FamilySession.suspend();pending();e.settle();assert.equal(e.commands.filter(x=>x.action==='load').length,0);assert.equal(e.run('sessionPaused&&!room.connected'),true);e.run('receiveState('+JSON.stringify(live)+',{retained:false})');e.c.familyNativeState({id:'movie',ready:true,position:999,duration:7200});assert.equal(e.run('model.pos'),611);assert.equal(e.run('nativeState.position'),611);assert.equal(e.run('room.joins'),1);
 // A second manual Play works after suspension, while visibility alone never reconnects.
 await e.c.FamilySession.resume();e.settle();assert.equal(e.run('room.joins'),2);assert.equal(e.commands.filter(x=>x.action==='load').length,1);
 // Capture actual native position; explicit Leave clears UI session state.
 a.c.familyNativeState({id:'movie',ready:true,pending:false,position:650,duration:7200,playing:true,title:'Movie',speed:1});a.c.FamilySession.suspend();assert.equal(a.run('model.pos'),650);assert.equal(a.commands.filter(x=>x.action==='remember').at(-1).snapshot.model.playing,false);a.run('leave()');assert.equal(a.run('joined||sessionPaused||reconnecting'),false);assert.equal(a.commands.at(-1).action,'leave');
 console.log('PASS paused restore/no automatic join or load, solo saved position, live-room reconciliation, anchor hold, explicit paused-room resume, reconnect cancellation, stale callbacks, repeat foreground resume and explicit leave. Mock transport/native only.');
})().catch(e=>{console.error(e);process.exit(1)});
