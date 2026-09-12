exec(open('/tmp/reader_vm_common.py').read())
def grab(t):
 a=[a for a,o,_ in nodes(t) if o>.99 and a.get('id')=='reader-control-motion-grabber'];assert len(a)==1;return a[0]
t=dump();assert visibleText(t,'收起');x,full=center(grab(t));click(*center(visibleText(t,'收起')[0]));t=dump();_,quick=center(grab(t));span=quick-full;contact=round(quick-span*.18);results=[]
for i in range(rounds):
 assert abs(center(grab(t))[1]-quick)<10
 args=['shell','uinput','-T','-d',str(x),str(quick),'-i','20','-u',str(x),str(quick),'-i','50','-d',str(x),str(contact),'-i','4000','-u',str(x),str(contact+35)]
 began=time.monotonic();child=subprocess.Popen(hdc+args,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True);poses=[]
 for target in [1.2,2.5]:
  time.sleep(max(0,target-(time.monotonic()-began)));assert child.poll() is None;held=dump();poses.append(center(grab(held))[1])
 s,_=child.communicate(timeout=10)
 with log.open('a') as f:f.write(json.dumps(dict(args=args,start=began,elapsed=time.monotonic()-began,code=child.returncode,output=s))+'\n')
 assert child.returncode==0 and not fatal.search(s) and 'wrong' not in s.lower();time.sleep(.5);t=dump();endY=center(grab(t))[1]
 entry={'round':i+1,'requestedContactY':contact,'heldY':poses,'heldProgress':[(quick-y)/span for y in poses],'settledY':endY};results.append(entry);(out/(label+'-progress.json')).write_text(json.dumps(results,indent=2));print(entry,flush=True)
 assert 0.015<(quick-poses[0])/span<.35 and abs(poses[1]-poses[0])<=2,('automatic motion not paused at intermediatepose',entry)
 assert abs(endY-quick)<10,('sparse reversedUPdidnotsettleQuick',entry)
x,y=center(grab(t));run(['shell','uitest','uiInput','swipe',str(x),str(y),str(x),'2770','1000']);time.sleep(.6);assert not visibleText(dump(),'设置')
(out/(label+'-result.json')).write_text(json.dumps({'status':'PASS','rounds':results,'scope':'single public uinput command tap starts autoexpand, secondDOWN requested50mslater pauses intermediatepose4s; finalUP35pxdown reverses toQuick; notcontinuousMOVEregrab orprecisephysical latency'},ensure_ascii=False,indent=2))
