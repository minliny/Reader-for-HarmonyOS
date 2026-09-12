import json,sys
from pathlib import Path
for name in sys.argv[1:]:
 print(Path(name).name)
 def texts(x):
  out=[]
  def visit(y):
   if isinstance(y,dict):
    a=y.get('attributes',{})
    if a.get('text'):out.append(a['text'])
    for v in y.values():visit(v)
   elif isinstance(y,list):
    for v in y:visit(v)
  visit(x);return out
 def walk(x):
  if isinstance(x,dict):
   a=x.get('attributes',{});ident=a.get('id','')
   if ident.startswith('reader-page-slot-'):
    t=texts(x);print(ident,a.get('opacity'),a.get('bounds'),t[:2],t[-2:])
   elif ident.startswith('reader-control-'):print(ident,a.get('bounds'),a.get('opacity'))
   elif a.get('text') in ['书架','仿真','滑动','设置','收起','展开']:print(a['text'],a.get('bounds'))
   for v in x.values():walk(v)
  elif isinstance(x,list):
   for v in x:walk(v)
 walk(json.load(open(name)))
