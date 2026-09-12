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
 if r.returncode or re.search('Connect server failed|Device not found|LIFECYCLE_TIMEOUT|SceneBoard exits 4times|kernel panic|guest reset|No devices|Error loading|Error relocating',r.stdout,re.I):raise RuntimeError('stop condition; no retry')
 return r.stdout
def run(args):
 owned();t=time.monotonic();r=subprocess.run(hdc+args,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,timeout=25);return check(r,args,t)
assert run(['shell','param','get','bootevent.boot.completed']).strip()=='true'
assert run(['shell','pidof','com.ohos.sceneboard']).strip()=='2458'
record(dict(appPid=run(['shell','pidof','io.reader.harmonyos']).strip(),mode=mode,direction=direction))
trace=None
if mode=='trace':
 ta=['shell','hitrace','-t','6','-b','32768','--trace_clock','mono','ace','app','ark','animation','graphic','multimodalinput','sched','-o','/data/local/tmp/reader-control-'+label+'-trace.ftrace'];tt=time.monotonic();trace=subprocess.Popen(hdc+ta,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True);time.sleep(.8)
x1,x2=(1000,280) if direction=='next' else (280,1000)
a=['shell','uitest','uiInput','swipe',str(x1),'1350',str(x2),'1350','900' if mode=='trace' else '300'];owned();t=time.monotonic();gesture=subprocess.Popen(hdc+a,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True)
if mode=='frames':
 for idx,delay in enumerate([.35,.85,1.35,3.0]):
  time.sleep(max(0,t+delay-time.monotonic()));remote='/data/local/tmp/reader-control-'+label+'-'+str(idx)+'.png';record(dict(sample=idx,requestedMs=delay*1000,triggerMs=(time.monotonic()-t)*1000));run(['shell','uitest','screenCap','-p',remote]);run(['file','recv',remote,str(out/Path(remote).name)])
s,_=gesture.communicate(timeout=15);check(subprocess.CompletedProcess(a,gesture.returncode,s),a,t)
if trace:
 s,_=trace.communicate(timeout=15);check(subprocess.CompletedProcess(ta,trace.returncode,s),ta,tt);run(['file','recv',ta[-1],str(out/(label+'-trace.ftrace'))])
remote='/data/local/tmp/reader-control-'+label+'-after.json';run(['shell','uitest','dumpLayout','-p',remote]);run(['file','recv',remote,str(out/Path(remote).name)])
print(json.dumps(dict(status='captured',label=label,mode=mode,log=str(log))))
