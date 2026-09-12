import json,sys,subprocess,time,os,re,hashlib
from pathlib import Path
out=Path(sys.argv[1]);nonce=sys.argv[2];mode=sys.argv[3];rounds=int(sys.argv[4]);label=sys.argv[5]
assert mode in ['滑动','覆盖','仿真','无动画','滚动'] and 1<=rounds<=100 and re.fullmatch('[a-z0-9-]+',label)
assert str(out).startswith('/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/evidence/')
lock=Path('/private/tmp/reader-harmony-target-6460677a198b.lock/owner.json');hdc=['/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/toolchains/hdc','-t','127.0.0.1:5555'];log=out/(label+'-commands.jsonl');assert not log.exists();seq=0
fatal=re.compile('Connect server failed|Device not found|LIFECYCLE_TIMEOUT|SceneBoard exits 4times|kernel panic|guest reset|No devices|Error loading|Error relocating',re.I)
def run(args):
 d=json.loads(lock.read_text());assert d['probeNonce']==nonce;os.kill(d['pid'],0);t=time.monotonic();r=subprocess.run(hdc+args,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,timeout=25)
 with log.open('a') as f:f.write(json.dumps(dict(args=args,start=t,elapsed=time.monotonic()-t,code=r.returncode,output=r.stdout),ensure_ascii=False)+'\n')
 assert r.returncode==0 and not fatal.search(r.stdout),'device command stop condition; no retries'
 return r.stdout
assert run(['shell','param','get','bootevent.boot.completed']).strip()=='true';assert run(['shell','pidof','com.ohos.sceneboard']).strip()=='2458'
def dump():
 global seq
 seq+=1;r=f'/data/local/tmp/reader-control-{label}-{seq}.json';p=out/Path(r).name;run(['shell','uitest','dumpLayout','-p',r]);run(['file','recv',r,str(p)]);return json.loads(p.read_text())
def nodes(tree):
 result=[]
 def walk(x,opacity=1):
  if isinstance(x,dict):
   a=x.get('attributes',{});opacity*=float(a.get('opacity') or '1')
   if a.get('visible')=='false':opacity=0
   if a:result.append((a,opacity,x))
   for k,v in x.items():
    if k!='attributes':walk(v,opacity)
  elif isinstance(x,list):
   for v in x:walk(v,opacity)
 walk(tree);return result

def center(a):
 n=list(map(int,re.findall(r'-?\d+',a['bounds'])));return [(n[0]+n[2])//2,(n[1]+n[3])//2]
def click(x,y):run(['shell','uitest','uiInput','click',str(x),str(y)]);time.sleep(.5)
def visibleText(tree,text):return [a for a,o,_ in nodes(tree) if o>.99 and a.get('text')==text]
def page(tree):
 slots=[(a,x) for a,o,x in nodes(tree) if o>.99 and a.get('id','').startswith('reader-page-slot-')];assert len(slots)==1,'must expose exactly one settled physical page'
 a,x=slots[0];ts=[b['text'] for b,o,_ in nodes(x) if o>.99 and b.get('text')];book=[t for t in ts if t.startswith('ReaderIndentCRLF')];assert book==['ReaderIndentCRLF20260910'],'wrong book, stop'
 stable=[t for t in ts if not re.fullmatch(r'\d\d:\d\d',t)];assert len(stable)>5
 return dict(slot=a['id'],sha256=hashlib.sha256(json.dumps(stable,ensure_ascii=False).encode()).hexdigest(),first=stable[:2],footer=stable[-2:])

pid=run(['shell','pidof','io.reader.harmonyos']).strip();assert pid.isdigit()
for name,args in [('status',['shell','cat','/proc/'+pid+'/status']),('memory',['shell','hidumper','--mem',pid])]:
 text=run(args);(out/(label+'-'+name+'.txt')).write_text(text)
 print(name,text[:350],flush=True)
