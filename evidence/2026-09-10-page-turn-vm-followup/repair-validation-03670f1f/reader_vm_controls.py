exec(open('/tmp/reader_vm_common.py').read())
# Starts from reading with controls closed; records real UI transitions only.
modules=['目录','外观','朗读','自动翻页','替换','搜索','设置']
module=sys.argv[6];assert module in modules

def cap(suffix):
 r=f'/data/local/tmp/reader-control-{label}-{suffix}.png';run(['shell','uitest','screenCap','-p',r]);run(['file','recv',r,str(out/Path(r).name)])
def trace_action(suffix,args):
 a=['shell','hitrace','-t','5','-b','32768','--trace_clock','mono','ace','app','ark','animation','graphic','multimodalinput','sched','-o',f'/data/local/tmp/reader-control-{label}-{suffix}-trace.ftrace']
 t=time.monotonic();tr=subprocess.Popen(hdc+a,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True);time.sleep(.65)
 run(args);s,_=tr.communicate(timeout=15);assert tr.returncode==0 and not fatal.search(s)
 with log.open('a') as f:f.write(json.dumps(dict(args=a,start=t,elapsed=time.monotonic()-t,code=tr.returncode,output=s))+'\n')
 run(['file','recv',a[-1],str(out/(label+'-'+suffix+'-trace.ftrace'))])
print('app pid:',run(['shell','pidof','io.reader.harmonyos']).strip(),flush=True)
tree=dump();assert not visibleText(tree,'设置'),'must begin with controls closed'
trace_action('open',['shell','uitest','uiInput','click','640','1350']);tree=dump()
choice=visibleText(tree,'界面' if module=='外观' else module);assert choice, f'module {module} unavailable'
click(*center(max(choice,key=lambda a:center(a)[1])));tree=dump();cap('quick')
g=[a for a,o,_ in nodes(tree) if o>.99 and a.get('id')=='reader-control-motion-grabber'];assert len(g)==1
x,y=center(g[0]);quickY=y
trace_action('expand',['shell','uitest','uiInput','swipe',str(x),str(y),str(x),'350','1000']);tree=dump();cap('full')
g=[a for a,o,_ in nodes(tree) if o>.99 and a.get('id')=='reader-control-motion-grabber'];assert len(g)==1
x,y=center(g[0]);assert y<quickY-300, 'full panel did not expand'
# Tap the actual visible collapse action; this captures its automatic timeline.
collapse=visibleText(tree,'收起') or [g[0]]
x,y=center(collapse[0]);trace_action('collapse',['shell','uitest','uiInput','click',str(x),str(y)]);tree=dump();cap('collapsed')
g=[a for a,o,_ in nodes(tree) if o>.99 and a.get('id')=='reader-control-motion-grabber'];assert len(g)==1
x,y=center(g[0]);assert abs(y-quickY)<20,'did not return to quick endpoint'
# A real grabber tap exercises automatic expansion, unlike the prior drag.
trace_action('auto-expand',['shell','uitest','uiInput','click',str(x),str(y)]);tree=dump()
g=[a for a,o,_ in nodes(tree) if o>.99 and a.get('id')=='reader-control-motion-grabber'];assert len(g)==1
assert center(g[0])[1] < quickY-300, 'grabber tap did not automatically expand'
collapse=visibleText(tree,'收起') or [g[0]]
click(*center(collapse[0]));tree=dump()
g=[a for a,o,_ in nodes(tree) if o>.99 and a.get('id')=='reader-control-motion-grabber'];assert len(g)==1
x,y=center(g[0]);assert abs(y-quickY)<20
trace_action('close',['shell','uitest','uiInput','swipe',str(x),str(y),str(x),'2770','1000']);tree=dump();assert not visibleText(tree,'设置');cap('closed')
(out/(label+'-result.json')).write_text(json.dumps(dict(status='PASS',module=module,scope='open, drag expand, automatic collapse, drag close; endpoint geometry only; trace performance separate'),ensure_ascii=False,indent=2));print(module,'PASS',flush=True)
