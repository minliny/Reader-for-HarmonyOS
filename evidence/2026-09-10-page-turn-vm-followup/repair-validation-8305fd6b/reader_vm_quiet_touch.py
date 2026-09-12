import json,sys,subprocess,time,os,re
from pathlib import Path
out=Path(sys.argv[1]); label=sys.argv[2]; nonce=sys.argv[3]; direction=sys.argv[4]; mode=sys.argv[5]
assert direction in ['next','previous'] and mode in ['trace','frames'] and re.fullmatch('[a-z0-9-]+',label)
assert str(out).startswith('/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/evidence/')
lock=Path('/private/tmp/reader-harmony-target-6460677a198b.lock/owner.json')
hdc=['/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/toolchains/hdc','-t','127.0.0.1:5555']
log=out/(label+'-commands.jsonl'); assert not log.exists()
def owned():
 d=json.loads(lock.read_text());assert d['probeNonce']==nonce and d['targetRef']=='6460677a198b';os.kill(d['pid'],0)
def record(d):
 with log.open('a') as f:f.write(json.dumps(d,ensure_ascii=False)+'\n')
def check(r,args,t):
 record(dict(args=args,start=t,elapsed=time.monotonic()-t,code=r.returncode,output=r.stdout))
 if r.returncode or re.search('Connect server failed|Device not found|LIFECYCLE_TIMEOUT|SceneBoard exits 4times|kernel panic|guest reset|No devices|Error loading|Error relocating|inaccessible or not found|Permission denied|syntax error',r.stdout,re.I):raise RuntimeError('stop condition; no retry')
 return r.stdout
def run(args):
 owned();t=time.monotonic();r=subprocess.run(hdc+args,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,timeout=25);return check(r,args,t)
assert run(['shell','param','get','bootevent.boot.completed']).strip()=='true'
assert run(['shell','pidof','com.ohos.sceneboard']).strip()=='2458'
record(dict(appPid=run(['shell','pidof','io.reader.harmonyos']).strip(),mode=mode,direction=direction))
trace=None
if mode=='trace':
 ta=['shell','hitrace','-t','6','-b','32768','--trace_clock','mono','ace','app','ark','animation','graphic','multimodalinput','sched','-o','/data/local/tmp/reader-control-'+label+'-trace.ftrace'];tt=time.monotonic();trace=subprocess.Popen(hdc+ta,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True);time.sleep(.8)
x1,x2=(1000,540) if direction=='next' else (280,740)
# Freeze only the diagnostic child after its movement, never Reader or MMI.
# Its own shell resumes it on every normal/signal exit so normal UP can run.
# Only numeric, validated coordinates enter this fixed remote program.
program=f"""reader_probe_child=''
reader_probe_cleanup() {{
 if [ -n "$reader_probe_child" ]; then
  kill -CONT "$reader_probe_child" 2>/dev/null
  wait "$reader_probe_child"
  reader_probe_child=''
 fi
}}
trap reader_probe_cleanup EXIT
trap 'reader_probe_cleanup; exit 130' HUP INT TERM
uinput -T -m {x1} 1350 {x2} 1350 -k 2200 400 > /data/local/tmp/reader-control-{label}-input.log 2>&1 &
reader_probe_child=$!
reader_probe_wait=0
while ! grep -q '^smoothTimeMs:' /data/local/tmp/reader-control-{label}-input.log; do
 reader_probe_wait=$((reader_probe_wait + 1))
 if [ "$reader_probe_wait" -gt 100 ]; then exit 7; fi
 sleep 0.02
done
sleep 0.7
kill -STOP "$reader_probe_child" || exit 5
read reader_probe_time reader_probe_idle < /proc/uptime
printf 'QUIET_BEGIN uptime=%s\\n' "$reader_probe_time"
sleep 1.2
kill -CONT "$reader_probe_child" || exit 6
read reader_probe_time reader_probe_idle < /proc/uptime
printf 'QUIET_END uptime=%s\\n' "$reader_probe_time"
wait "$reader_probe_child"
reader_probe_status=$?
cat /data/local/tmp/reader-control-{label}-input.log
reader_probe_child=''
trap - EXIT HUP INT TERM
exit "$reader_probe_status"
"""
# Transfer exact reviewed bytes; HDC shell must never parse nested quoting.
script=out/(label+'-input.sh');assert not script.exists();script.write_text(program)
remoteScript='/data/local/tmp/reader-control-'+label+'-input.sh'
record(dict(scriptSha256=__import__('hashlib').sha256(script.read_bytes()).hexdigest(),localScript=str(script)))
run(['file','send',str(script),remoteScript])
a=['shell','sh',remoteScript]
owned();t=time.monotonic();gesture=subprocess.Popen(hdc+a,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True)
if mode=='frames':
 for idx,delay in enumerate([.55,1.0,1.65,3.2]):
  time.sleep(max(0,t+delay-time.monotonic()));remote='/data/local/tmp/reader-control-'+label+'-'+str(idx)+'.png';record(dict(sample=idx,requestedMs=delay*1000,triggerMs=(time.monotonic()-t)*1000));run(['shell','uitest','screenCap','-p',remote]);run(['file','recv',remote,str(out/Path(remote).name)])
s,_=gesture.communicate(timeout=15);check(subprocess.CompletedProcess(a,gesture.returncode,s),a,t)
begin=re.findall(r'^QUIET_BEGIN uptime=([0-9.]+)$',s,re.M);end=re.findall(r'^QUIET_END uptime=([0-9.]+)$',s,re.M)
assert len(begin)==len(end)==1 and float(end[0])-float(begin[0])>=1.1, 'quiet interval did not complete; stop'
record(dict(quietBeginGuestUptime=float(begin[0]),quietEndGuestUptime=float(end[0])))
if trace:
 s,_=trace.communicate(timeout=15);check(subprocess.CompletedProcess(ta,trace.returncode,s),ta,tt);run(['file','recv',ta[-1],str(out/(label+'-trace.ftrace'))])
remote='/data/local/tmp/reader-control-'+label+'-after.json';run(['shell','uitest','dumpLayout','-p',remote]);run(['file','recv',remote,str(out/Path(remote).name)])
print(json.dumps(dict(status='captured',label=label,mode=mode,log=str(log))))
