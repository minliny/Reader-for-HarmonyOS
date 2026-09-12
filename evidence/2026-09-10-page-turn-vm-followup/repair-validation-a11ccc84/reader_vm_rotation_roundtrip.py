exec(open('/tmp/reader_vm_long_oracle.py').read())
from PIL import Image
def cap(tag):
 remote=f'/data/local/tmp/reader-control-{label}-{tag}.png';dest=out/Path(remote).name;run(['shell','uitest','screenCap','-p',remote]);run(['file','recv',remote,str(dest)]);return list(Image.open(dest).size)
def settings(w,h):
 click(w//2,h//2);t=dump();v=visibleText(t,'设置');assert v;click(*center(max(v,key=lambda a:center(a)[1])));t=dump()
 if not visibleText(t,'横屏'):
  g=[a for a,o,_ in nodes(t) if o>.99 and a.get('id')=='reader-control-motion-grabber'];assert len(g)==1;click(*center(g[0]));t=dump()
 assert visibleText(t,'横屏');return t
def close(t,h):
 g=[a for a,o,_ in nodes(t) if o>.99 and a.get('id')=='reader-control-motion-grabber'];assert len(g)==1;x,y=center(g[0]);run(['shell','uitest','uiInput','swipe',str(x),str(y),str(x),str(min(h-5,y+350)),'1000']);time.sleep(.8);assert not visibleText(dump(),'设置')
origin=page(dump());pid=run(['shell','pidof','io.reader.harmonyos']).strip();t=settings(1280,2832)
# Direction is the upper of the two Follow System rows (the other is timeout).
system=min(visibleText(t,'跟随系统'),key=lambda a:center(a)[1]);sy=center(system)[1]
selected=[a for a,o,_ in nodes(t) if o>.99 and a.get('backgroundColor')=='#FF5C4033' and abs(center(a)[1]-sy)<45]
click(*center(visibleText(t,'横屏')[0]));time.sleep(1.5);t=dump();size=cap('landscape');assert size[0]>size[1],size
close(t,size[1]);landscape=page(dump());assert landscape['chapter']==origin['chapter'] and landscape['start']<=origin['start']<landscape['end'],('canonicalanchor lost afterrotate',origin,landscape)
t=settings(*size);system=min(visibleText(t,'跟随系统'),key=lambda a:center(a)[1]);click(*center(system));time.sleep(1.5);t=dump();restoredSize=cap('restored');assert restoredSize==[1280,2832];close(t,2832);after=page(dump());assert after['sha256']==origin['sha256'],('canonicalpage changed afterroundtrip',origin,after);assert run(['shell','pidof','io.reader.harmonyos']).strip()==pid
(out/(label+'-result.json')).write_text(json.dumps({'status':'PASS','appPid':int(pid),'origin':origin,'landscape':landscape,'restored':after,'landscapeSize':size,'restoredSize':restoredSize,'scope':'same-process portrait-followSystem toforcedlandscape andback, canonicaloldpageanchorcontained andexactoriginalbodyrestored; settings restoredfollowSystem; notmidgestureforcedSurfacefailure'},ensure_ascii=False,indent=2));print(label,'PASS',flush=True)
