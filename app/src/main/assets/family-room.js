/* Family-only namespace and foreground-scoped MQTT transport. Not compatible with the original chat/DM app. */
(function(root){'use strict';
const BROKERS=['wss://broker.emqx.io:8084/mqtt','wss://broker.hivemq.com:8884/mqtt','wss://mqtt.tyckr.io:8081'];
const MAX_ITEMS=50;const compare=(a,b)=>a[0]-b[0]||(a[1]<b[1]?-1:a[1]>b[1]?1:0);
function validEpoch(e){return Array.isArray(e)&&e.length===2&&Number.isSafeInteger(e[0])&&e[0]>=0&&e[0]<1e12&&typeof e[1]==='string'&&e[1].length<=160}
function validURL(s){if(typeof s!=='string'||s.length>8192||/[\r\n]/.test(s))return false;try{const u=new URL(s);return ['http:','https:'].includes(u.protocol)&&!!u.hostname}catch(e){return false}}
function validState(s){if(!s||!validEpoch(s.epoch)||!Array.isArray(s.queue)||s.queue.length>MAX_ITEMS||typeof s.playing!=='boolean'||!Number.isFinite(s.pos)||s.pos<0||s.pos>1e8)return false;const ids=new Set();for(const x of s.queue){if(!x||typeof x.id!=='string'||!x.id||x.id.length>160||ids.has(x.id)||!validURL(x.url)||typeof x.title!=='string'||x.title.length>160)return false;ids.add(x.id)}return s.current===null||ids.has(s.current)}
function uid(){const a=new Uint8Array(12);root.crypto.getRandomValues(a);return Array.from(a,x=>x.toString(16).padStart(2,'0')).join('')}
class FamilyRoom{
 constructor(o){this.o=o;this.client=null;this.active=false;this.generation=0;this.peers=new Map();this.id=uid();this.timers=[];this.connected=false;this.prefix='';this.tickCount=0;}
 async join(name,room,tower){this.leave();this.active=true;this.id=uid();this.name=name;this.tower=tower;const g=++this.generation;const digest=await root.crypto.subtle.digest('SHA-256',new TextEncoder().encode(room.trim().normalize('NFC')));if(!this.active||g!==this.generation)return;this.prefix='familywp/v1/'+Array.from(new Uint8Array(digest),x=>x.toString(16).padStart(2,'0')).join('');
 const c=root.mqtt.connect(BROKERS[tower]||BROKERS[0],{clientId:'family-'+this.id,clean:true,connectTimeout:12000,reconnectPeriod:2500,keepalive:25,resubscribe:false,queueQoSZero:false,timerVariant:'native',will:{topic:this.prefix+'/p/'+this.id,payload:JSON.stringify({online:false}),qos:1,retain:true}});this.client=c;
 const alive=()=>this.active&&g===this.generation&&this.client===c;
 c.on('connect',()=>{if(!alive()){c.end(true);return}this.connected=true;c.subscribe([this.prefix+'/state',this.prefix+'/events',this.prefix+'/p/+'],{qos:1},err=>{if(!alive())return;if(err){this.connected=false;this.o.status('error');return}this.o.status('connected');this.presence();this.send({type:'hello'});});});
 c.on('offline',()=>{if(!alive())return;this.connected=false;this.peers.clear();this.o.status('reconnecting');this.o.peers(0);});
 c.on('reconnect',()=>{if(alive()&&!this.connected)this.o.status('reconnecting')});
 c.on('close',()=>{if(!alive())return;this.connected=false;this.peers.clear();this.o.status('reconnecting');this.o.peers(0);});
 c.on('error',()=>{if(alive())this.o.status('error')});
 c.on('message',(topic,bytes,packet)=>{if(!alive()||bytes.length>600000)return;const part=topic.slice(this.prefix.length+1);if(part.startsWith('p/')&&bytes.length===0){this.peers.delete(part.slice(2));return}let m;try{m=JSON.parse(bytes.toString())}catch(e){return}if(part.startsWith('p/')){const id=part.slice(2);if(id.length>160)return;if(!m||m.online!==true){this.peers.delete(id);return}if(this.peers.size<64||this.peers.has(id))this.peers.set(id,{seen:Date.now(),name:String(m.name||'').slice(0,20)});return;}
 if(!m||typeof m.from!=='string'||m.from.length>160||m.from===this.id)return;
 if(part==='state'){if(validState(m.state))this.o.state(m.state,{from:m.from,retained:!!packet?.retain});return}
 if(part==='events'){if(m.type==='hello')this.o.hello();else if(m.type==='sync'&&m.packet&&m.packet.v===4)this.o.sync(m.from,m.packet);}
 });
 this.timers.push(setInterval(()=>{if(!alive())return;this.tickCount++;if(this.connected){if(this.tickCount%8===0){this.presence();this.o.heartbeat()}this.o.tick()}for(const [id,p] of this.peers)if(Date.now()-p.seen>22000)this.peers.delete(id);this.o.peers(this.connected?Math.max(1,this.peers.size):0)},1000));
 }
 presence(){if(this.connected)this.client.publish(this.prefix+'/p/'+this.id,JSON.stringify({online:true,name:this.name}),{qos:1,retain:true})}
 send(m){if(!this.active||!this.connected)return false;this.client.publish(this.prefix+'/events',JSON.stringify({...m,from:this.id}),{qos:m.type==='sync'?0:1,retain:false});return true}
 publish(state){if(!this.active||!this.connected||!validState(state))return false;this.client.publish(this.prefix+'/state',JSON.stringify({from:this.id,state}),{qos:1,retain:true});return true}
 leave(){this.active=false;this.connected=false;this.generation++;this.timers.forEach(clearInterval);this.timers=[];this.peers.clear();const c=this.client;this.client=null;if(c){try{if(c.connected)c.publish(this.prefix+'/p/'+this.id,'',{qos:0,retain:true});c.end(true)}catch(e){}}}
}
root.FamilyProtocol={BROKERS,compare,validEpoch,validURL,validState,uid,MAX_ITEMS};root.FamilyRoom=FamilyRoom;
if(typeof module==='object'&&module.exports)module.exports={compare,validEpoch,validURL,validState,MAX_ITEMS};
})(typeof window==='object'?window:globalThis);
