#!/usr/bin/env python3
"""Static scope/packaging gates; deliberately not described as Android lifecycle proof."""
from pathlib import Path
import sys, re, hashlib, xml.etree.ElementTree as ET
r=Path(__file__).resolve().parents[1]; a=r/'app/src/main'; src='\n'.join(p.read_text() for p in (a/'java').rglob('*.kt'))
g=(r/'app/build.gradle.kts').read_text();assert 'applicationId = "app.party.family"' in g;assert 'app.party.music' not in src
for bad in ['startForegroundService(', 'startService(', 'startForeground(', 'START_STICKY', 'AlarmManager', 'WorkManager', 'NotificationManager', 'MediaSessionService', 'enterPictureInPictureMode', 'BgNotifyService', 'MusicService', 'CallForegroundService', 'ReplyReceiver']:
 assert bad not in src,bad
for good in ['web.destroy()', 'resolver.shutdownNow()', 'YtAudioSource.shutdown()', 'finishAndRemoveTask()', 'killOwnProcess()', 'override fun onPause()', 'override fun onStop()', 'loadGeneration++']:
 assert good in src,good
assert 'player?.destroy()' in src and 'if (!foreground || closed)' in src
assets=a/'assets';html=(assets/'index.html').read_text();js=(assets/'family.js').read_text();room=(assets/'family-room.js').read_text()
assert 'FamilyNative' in js and 'familyNativeState' in js and "document.hidden&&joined" in js
assert 'setInterval' not in js, 'No fake preview playback clock'
assert 'no MPV engine' not in html and 'A quiet morning' not in html and 'data:image/webp' not in html
for bad in ['id="dm-', 'id="chat-messages"', 'id="wp-party-lobby"', 'id="yp-bar"', '<iframe', '<video', '<audio']:
 assert bad not in html,bad
for path in assets.glob('*'):
 if path.suffix in ['.html','.js','.css'] and path.name!='mqtt.min.js':
  s=path.read_text();assert 'github.io/watch-party' not in s and 'wp-ver.txt' not in s
for f in re.findall(r'<script[^>]+src="([^"]+)"',html):assert '://' not in f and (assets/f).is_file(),f
assert "c.end(true)" in room and 'this.generation++' in room and 'this.timers.forEach(clearInterval)' in room
assert all(x in room for x in ['wss://broker.emqx.io:8084/mqtt','wss://broker.hivemq.com:8884/mqtt','wss://mqtt.tyckr.io:8081'])
assert hashlib.sha256((a/'res/raw/ytdlp').read_bytes()).hexdigest()=='1fa6733c37ea6fb51c99ad8fe785e7b7e5f3246c9b980230329d4fb72ed8d4d6'
assert not list(r.glob('**/*.jks'))
A='{http://schemas.android.com/apk/res/android}';T='{http://schemas.android.com/tools}'
def check_manifest(p,merged=False):
 root=ET.parse(p).getroot();app=root.find('application');assert app is not None
 for tag in ['service','receiver']:
  for e in app.findall(tag):assert not merged and e.get(T+'node')=='remove',(p,tag,e.attrib)
 for perm in root.findall('uses-permission'):
  n=perm.get(A+'name','')
  if any(x in n for x in ['FOREGROUND_SERVICE','WAKE_LOCK','POST_NOTIFICATIONS','RECEIVE_BOOT_COMPLETED','RECORD_AUDIO','SYSTEM_ALERT_WINDOW']):
   assert not merged and perm.get(T+'node')=='remove',(p,n)
 acts=app.findall('activity');assert len(acts)==1,(p,len(acts));assert acts[0].get(A+'supportsPictureInPicture')=='false';assert acts[0].get(A+'excludeFromRecents')=='true'
check_manifest(a/'AndroidManifest.xml')
if '--merged' in sys.argv:
 manifests=list((r/'app/build/intermediates/merged_manifests').glob('**/AndroidManifest.xml'));assert manifests,'Merged manifests not found'
 for p in manifests:check_manifest(p,True)
 print('PASS merged manifests: zero services/receivers, no background/microphone/notification permissions, one non-PiP Activity')
print('PASS separate identity, removed feature/service sources, foreground teardown fences, local UI assets, exact extractor pin and selected towers. Static checks only.')
