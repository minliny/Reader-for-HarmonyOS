exec(open('/tmp/reader_vm_common.py').read())
def grab(t):
 a=[a for a,o,_ in nodes(t) if o>.99 and a.get('id')=='reader-control-motion-grabber'];assert len(a)==1;return a[0]
click(640,1350);t=dump();v=visibleText(t,'设置');click(*center(max(v,key=lambda a:center(a)[1])));t=dump();click(*center(grab(t)));t=dump();assert visibleText(t,'收起');x,full=center(grab(t));click(*center(visibleText(t,'收起')[0]));t=dump();_,quick=center(grab(t));assert quick-full>300
results=[]
for direction in ['expand']:
 for fraction in [.2,.5,.8]:
  t=dump();y=center(grab(t))[1]
  if direction=='expand' and abs(y-quick)>20:click(*center(visibleText(t,'收起')[0]));t=dump()
  if direction=='collapse' and abs(y-full)>20:click(*center(grab(t)));t=dump()
  assert abs(center(grab(t))[1]-(quick if direction=='expand' else full))<10
  startY=quick if direction=='expand' else full;endY=round(startY+(full-quick if direction=='expand' else quick-full)*fraction)
  args=['shell','uinput','-T','-m',str(x),str(startY),str(x),str(endY),'-k','10000','600'];began=time.monotonic();child=subprocess.Popen(hdc+args,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True);samples=[]
  for target in [1.2,3,7]:
   time.sleep(max(0,target-(time.monotonic()-began)));assert child.poll() is None
   before=time.monotonic()-began;held=dump();actualY=center(grab(held))[1];samples.append({'requestedAtSec':target,'dumpStartSec':before,'dumpEndSec':time.monotonic()-began,'observedY':actualY,'errorPx':actualY-endY,'stillHeld':child.poll() is None})
  s,_=child.communicate(timeout=10)
  with log.open('a') as f:f.write(json.dumps(dict(args=args,start=began,elapsed=time.monotonic()-began,code=child.returncode,output=s))+'\n')
  assert child.returncode==0 and not fatal.search(s);time.sleep(.7);after=center(grab(dump()))[1]
  entry={'direction':direction,'fraction':fraction,'requestedY':endY,'samples':samples,'settledY':after};results.append(entry);(out/(label+'-progress.json')).write_text(json.dumps(results,indent=2));print(entry,flush=True)
  assert abs(after-(full if direction=='expand' else quick))<10,('release did not settle',entry)
(out/(label+'-result.json')).write_text(json.dumps({'status':'PASS' if all(abs(s['errorPx'])<=8 for e in results for s in e['samples']) else 'FAIL','quickY':quick,'fullY':full,'cases':results},indent=2))

t=dump();click(*center(visibleText(t,'收起')[0]));t=dump();x,y=center(grab(t));run(['shell','uitest','uiInput','swipe',str(x),str(y),str(x),'2770','1000']);time.sleep(.7);assert not visibleText(dump(),'设置')
