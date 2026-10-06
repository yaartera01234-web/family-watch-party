'use strict';
const assert=require('node:assert/strict');const path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined,args:['--no-sandbox']});
 let suites=0;
 for(const [width,height] of [[344,727],[390,844],[820,390],[768,1024],[1280,800]]){
 const context=await browser.newContext({viewport:{width,height},bypassCSP:true}),p=await context.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.addInitScript(()=>{window.__commands=[];window.__n={};window.FamilyNative={postMessage:raw=>{const m=JSON.parse(raw);window.__commands.push(m);if(m.action==='load'){window.__n={id:m.id,ready:true,pending:false,position:m.position,duration:240,playing:m.playing,buffering:false,ended:false,speed:1,title:m.title,quality:m.url.includes('youtu')?m.quality:0,video:m.url.endsWith('.mp3')?0:720,artwork:false,tracks:[{id:1,label:'English · AAC',selected:true},{id:2,label:'Urdu · AAC',selected:false}]};setTimeout(()=>window.familyNativeState({...window.__n}),10)}else if(['pause','resume','seek'].includes(m.action)){if(m.action==='seek')window.__n.position=m.position;else window.__n.playing=m.action==='resume';window.familyNativeState?.({...window.__n})}}};});
 await p.goto('file://'+path.resolve(__dirname,'../app/src/main/assets/index.html'));
 await p.evaluate(()=>{window.__publications=[];window.mqtt={connect:(url,options)=>{const handlers={};const c={connected:false,on:(n,f)=>{handlers[n]=f;return c},subscribe:(topics,o,cb)=>{cb()},publish:(topic,data,o)=>{window.__publications.push({topic,data,options:o})},end:force=>{c.connected=false;c.ended=force}};window.__socket=c;window.__socketOptions=options;window.__socketURL=url;setTimeout(()=>{c.connected=true;handlers.connect()},20);return c}}});
 assert(await p.locator('#join-screen').isVisible());assert(await p.locator('#f-player').isHidden());
 await p.locator('#name-input').fill('Family QA');await p.locator('#room-input').fill('qa-only');await p.locator('#join-btn').click();await p.waitForFunction(()=>document.getElementById('f-status').dataset.state==='connected');
 assert(await p.locator('#join-screen').isHidden());const box=await p.locator('#f-player').boundingBox();assert.equal(box.width,width);assert.equal(box.height,height);assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 assert.equal(await p.locator('#chat-messages,#dm-thread,#wp-party-lobby,video,audio,iframe').count(),0);
 assert.equal(await p.locator('#f-count').textContent(),'0');assert.equal(await p.evaluate(()=>getComputedStyle(document.documentElement).backgroundColor),'rgba(0, 0, 0, 0)');
 await p.locator('#f-panel-source').click();await p.locator('#f-link-title').fill('<b>Family clip</b>');await p.locator('#f-link-url').fill('https://example.com/video.mp4');await p.locator('#f-link-form button').click();await p.waitForFunction(()=>window.__commands.some(x=>x.action==='load'));
 assert.equal(await p.locator('[data-track]').count(),1);assert.equal(await p.locator('[data-track="0"] strong').textContent(),'<b>Family clip</b>');assert.equal(await p.locator('[data-track="0"] b').count(),0);
 await p.locator('#f-add-from-list').click();await p.locator('#f-link-title').fill('Family video');await p.locator('#f-link-url').fill('https://www.youtube.com/watch?v=0123456789a');await p.locator('#f-link-form button').click();assert.equal(await p.locator('[data-track]').count(),2);
 await p.locator('[data-track="1"]').click();await p.waitForFunction(()=>window.__n.quality===144);assert(await p.locator('#f-drawer').isHidden());
 await p.locator('[data-skip="10"]').click();assert(await p.evaluate(()=>window.__commands.some(x=>x.action==='seek'&&x.position===10)));
 // Real browser pointer drag while native progress keeps reporting the old movie time.
 await p.evaluate(()=>{window.__n.duration=7200;window.familyNativeState({...window.__n})});
 const seekBox=await p.locator('#f-seek').boundingBox(),beforeSeek=await p.evaluate(()=>window.__commands.filter(x=>x.action==='seek').length);
 await p.mouse.move(seekBox.x+9,seekBox.y+seekBox.height/2);await p.mouse.down();await p.mouse.move(seekBox.x+seekBox.width*.18,seekBox.y+seekBox.height/2,{steps:8});
 const drafted=Number(await p.locator('#f-seek').inputValue());assert(drafted>600);
 await p.evaluate(()=>{for(let i=0;i<10;i++)window.familyNativeState({...window.__n,position:10+i*.1})});
 assert.equal(Number(await p.locator('#f-seek').inputValue()),drafted);await p.mouse.up();
 assert.equal(await p.evaluate(()=>window.__commands.filter(x=>x.action==='seek').length),beforeSeek+1);
 assert.equal(await p.evaluate(()=>window.__commands.filter(x=>x.action==='seek').at(-1).position),drafted);
 await p.evaluate(()=>{window.__n.position=10;window.__n.duration=240;window.familyNativeState({...window.__n})});
 await p.locator('#f-play').click();assert(await p.evaluate(()=>window.__commands.some(x=>x.action==='pause')));
 await p.locator('#f-panel-settings').click();await p.selectOption('#f-quality','1080');await p.waitForFunction(()=>window.__n.quality===1080);await p.selectOption('#f-aspect','3');assert(await p.evaluate(()=>window.__commands.some(x=>x.action==='aspect'&&x.index===3)));await p.selectOption('#f-audio-track','2');assert(await p.evaluate(()=>window.__commands.some(x=>x.action==='audio'&&x.id===2)));await p.locator('#f-close').click();
 await p.locator('#f-prev').click();await p.waitForFunction(()=>window.__n.title==='<b>Family clip</b>');assert.equal(await p.locator('#f-prev use').evaluate(e=>document.querySelector(e.getAttribute('href')).tagName),'symbol');
 await p.locator('#f-panel-playlist').click();await p.locator('[data-remove="0"]').click();assert.equal(await p.locator('[data-track]').count(),1);await p.locator('[data-remove="0"]').click();assert.equal(await p.locator('[data-track]').count(),0);assert(await p.evaluate(()=>window.__commands.some(x=>x.action==='stop')));await p.locator('#f-close').click();
 await p.evaluate(()=>{Object.defineProperty(document,'hidden',{get:()=>true,configurable:true});document.dispatchEvent(new Event('visibilitychange'))});assert(await p.locator('#join-screen').isVisible());assert(await p.evaluate(()=>window.__socket.ended));const joins=await p.evaluate(()=>window.__commands.filter(x=>x.action==='join').length);await p.evaluate(()=>{Object.defineProperty(document,'hidden',{get:()=>false,configurable:true});document.dispatchEvent(new Event('visibilitychange'))});assert.equal(await p.evaluate(()=>window.__commands.filter(x=>x.action==='join').length),joins);
 await p.locator('#wp-themebar').click();await p.locator('[data-ftheme="amoled"]').click();assert.equal(await p.locator('html').getAttribute('data-wp-theme'),'amoled');await p.locator('#f-theme-close').click();assert.deepEqual(errors,[]);await context.close();suites++;
 }
 await browser.close();console.log('PASS '+suites+' responsive suites: joining, viewport, transparent MPV layer, empty/shared queue, safe title rendering, controls, quality, aspects, audio, removal, background disconnect and no auto-rejoin. Native bridge and MQTT mocked; not handset/native-playback proof.');
})().catch(e=>{console.error(e);process.exit(1)});
