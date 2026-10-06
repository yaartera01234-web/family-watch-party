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
 const c={document,console,URL,performance:{now:()=>1000},setTimeout:(f,ms)=>{timers.set(++n,{f,ms});return n},clearTimeout:id=>timers.delete(id),localStorage:{getItem:()=>null,setItem(){}},FamilyProtocol:protocol,FamilyRoom:class{constructor(o){this.o=o;this.connected=false;this.id='test';this.joins=0;this.leaves=0}async join(){this.joins++;this.connected=true;this.o.status('connected')}publish(s){publications.push(JSON.parse(JSON.stringify(s)))}send(){}leave(){this.leaves++;this.connected=false}},FamilyNative:{postMessage:raw=>{const m=JSON.parse(raw);commands.push(m);if(m.action==='userPlay'&&!c.deferGrant)c.FamilySession.playGranted(m.id,true)}},addEventListener(){}};
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
 // A live room restarted since this task was suspended: do not inject a stale higher local epoch.
 const restarted=restore();await restarted.c.FamilySession.resume();restarted.run('receiveState('+JSON.stringify({...live,epoch:[2,'peer']})+',{retained:false})');restarted.settle();assert.equal(restarted.run('sync.epoch[0]'),2);assert.equal(restarted.publications.length,0);assert.equal(restarted.commands.find(x=>x.action==='load').id,'new');
 // Explicit Play in a currently paused live room uses the room's position, not cached position.
 const d=restore();await d.c.FamilySession.resume();d.run('receiveState('+JSON.stringify({...live,playing:false})+',{retained:false})');d.settle();assert.equal(d.commands.find(x=>x.action==='load').position,901);assert.equal(d.commands.find(x=>x.action==='load').playing,true);assert.equal(d.publications[0].kind,'resume');
 // A live peer's cleared queue must not resurrect a locally saved movie.
 const empty=restore();await empty.c.FamilySession.resume();empty.run('receiveState('+JSON.stringify({...live,queue:[],current:null,pos:0,playing:false})+',{retained:false})');empty.settle();assert.equal(empty.commands.filter(x=>x.action==='load').length,0);assert.equal(empty.run('model.queue.length'),0);assert.equal(empty.run('model.playing'),false);
 // Lock during process-recovery reconnect must not load behind the screen, or disconnect the room.
 const e=restore();await e.c.FamilySession.resume();e.c.FamilySession.suspend();e.settle();assert.equal(e.commands.filter(x=>x.action==='load').length,0);assert.equal(e.run('retainedHold&&room.connected'),true);e.c.familyBackground(false);e.c.FamilySession.resumeRetained();assert.equal(e.run('room.joins'),1);assert.equal(e.commands.filter(x=>x.action==='load').length,1);
 // Normal screen lock: preserve native state/load key/room; unlock alone must do nothing.
 a.c.familyNativeState({id:'movie',ready:true,pending:false,position:650,duration:7200,playing:true,title:'Movie',speed:1});
 const loads=a.commands.filter(x=>x.action==='load').length,joins=a.run('room.joins'),leaves=a.run('room.leaves'),seeks=a.commands.filter(x=>x.action==='seek').length;
 a.c.FamilySession.suspend();assert.equal(a.run('retainedHold&&room.connected'),true);assert.equal(a.run('nativeState.ready'),true);assert.equal(a.run('loadKey'),'movie');assert.equal(a.run('position()'),650);assert.equal(a.run('room.leaves'),leaves);assert.equal(a.commands.filter(x=>x.action==='remember').at(-1).snapshot.model.playing,false);
 a.c.familyBackground(false);assert.equal(a.commands.filter(x=>x.action==='load').length,loads);assert.equal(a.run('retainedHold'),true);
 a.c.FamilySession.resumeRetained();assert.equal(a.run('room.joins'),joins);assert.equal(a.commands.filter(x=>x.action==='load').length,loads);assert.equal(a.commands.filter(x=>x.action==='seek').length,seeks);assert.equal(a.commands.at(-2).action,'resume');assert.equal(a.run('retainedHold'),false);
 // Remote play/change while locked cannot auto-resume, seek, stop or replace the cached movie.
 a.c.FamilySession.suspend();const count=a.commands.length;a.run('receiveState('+JSON.stringify(live)+',{retained:false})');a.run('publishSnapshot()');assert.equal(a.run('model.current'),'movie');assert.equal(a.commands.slice(count).filter(x=>['load','resume','seek','stop'].includes(x.action)).length,0);
 a.c.familyBackground(false);a.c.FamilySession.resumeRetained();assert.equal(a.commands.filter(x=>x.action==='load').at(-1).id,'new');assert.equal(a.run('room.joins'),joins);
 a.c.FamilySession.suspend();const beforeFenced=a.commands.filter(x=>x.action==='load').length;a.c.familyBackground(false,'old-native-id');assert.equal(a.commands.filter(x=>x.action==='load').length,beforeFenced);a.c.FamilySession.resumeRetained();assert.equal(a.commands.filter(x=>x.action==='load').length,beforeFenced+1);
 // Delayed native authorization cannot revive a session after another screen lock.
 a.c.FamilySession.suspend();a.c.familyBackground(false);a.c.deferGrant=true;a.c.FamilySession.resumeRetained();const grant=a.commands.at(-1).id;a.c.FamilySession.suspend();const oldCount=a.commands.length;a.c.FamilySession.playGranted(grant,true);assert.equal(a.commands.length,oldCount);assert.equal(a.run('retainedHold'),true);
 a.run('leave()');assert.equal(a.run('joined||sessionPaused||reconnecting||retainedHold'),false);assert.equal(a.commands.at(-1).action,'leave');
 console.log('PASS process-death paused recovery; live room reconciliation; lock retains decoder state and same room; unlock no autoplay/rejoin/load; explicit solo Play has NO load/seek; deferred remote changes; terminal leave. Mock transport/native only.');
})().catch(e=>{console.error(e);process.exit(1)});
