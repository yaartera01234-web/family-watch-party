/* Main-looper timers keep MQTT heartbeats independent of hidden WebView timer throttling.
 * Only the bundled Android bridge opts in; browsers/mocks use their ordinary timers. */
(function(){'use strict';
 if(!window.FamilyNative||typeof FamilyNative.timerSupport!=='function'||!FamilyNative.timerSupport())return;
 const pending=new Map();let serial=0;
 function start(fn,delay,repeat,args){
  if(typeof fn!=='function')throw new TypeError('Timer callback must be a function');
  const id=++serial;pending.set(id,{fn,args,repeat});
  FamilyNative.postMessage(JSON.stringify({action:'timerStart',id,delay:Math.max(1,Math.min(86400000,Number(delay)||1)),repeat}));return id;
 }
 function cancel(id){pending.delete(Number(id));FamilyNative.postMessage(JSON.stringify({action:'timerCancel',id:Number(id)}))}
 window.setTimeout=(fn,delay,...args)=>start(fn,delay,false,args);
 window.setInterval=(fn,delay,...args)=>start(fn,delay,true,args);
 window.clearTimeout=window.clearInterval=cancel;
 window.FamilyTimers={fire(id){const t=pending.get(id);if(!t)return;if(!t.repeat)pending.delete(id);t.fn(...t.args)}};
})();
