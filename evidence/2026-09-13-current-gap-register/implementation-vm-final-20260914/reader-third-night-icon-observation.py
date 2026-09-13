from pathlib import Path
from PIL import Image
from collections import Counter
from datetime import datetime,timezone
import json,re,hashlib
base=Path('/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/evidence/2026-09-13-current-gap-register/implementation-vm-final-20260914')
prefix='reader-control-r9509-1789315814956-';out=Path('/private/tmp/reader-third-night-icon-observation.json')
names=['night-appearance','night-directory','night-tts','night-settings','night-home','night-book-info','night-full-directory','replace-full','replace-collapsed','inbook-search-full','inbook-search-collapsed','night-shelf','night-app-settings']
result={'recordedAt':datetime.now(timezone.utc).isoformat(),'sourcePrefix':str(base/prefix),'evidenceLayer':'VM captures observed offline; no HDC or device input','files':{},'nav':[],'quickActions':[],'directory':[],'appNav':[],'appSettingsIcons':[],'collapse':{},'bookInfoIssue':{}}
loaded={}
for name in names:
 p=base/(prefix+name+'.json');raw=p.read_bytes();tree=json.loads(raw);nodes=[]
 def walk(n,op=1,descriptions=[]):
  a=n.get('attributes',{});eff=op*float(a.get('opacity') or 1)
  if a.get('visible')=='false':eff=0
  rect=list(map(int,re.findall(r'-?\d+',a.get('bounds',''))));nodes.append({'attrs':a,'rect':rect,'effectiveOpacity':eff,'ancestorDescriptions':descriptions})
  ds=descriptions+([a['description']]if a.get('description')else[])
  for c in n.get('children',[]):walk(c,eff,ds)
 walk(tree)
 ip=base/(prefix+name+'.png');im=Image.open(ip).convert('RGB')if ip.exists()else None
 loaded[name]=(nodes,im);result['files'][name]={'jsonSha256':hashlib.sha256(raw).hexdigest(),'pngSha256':hashlib.sha256(ip.read_bytes()).hexdigest()if im else None}
def pixels(im,rect,expected):
 c=Counter(im.crop(rect).getdata());rgb=tuple(bytes.fromhex(expected.lstrip('#')))
 near=sum(n for color,n in c.items()if max(abs(a-b)for a,b in zip(color,rgb))<=1)
 return{'expectedSvg':expected,'foregroundPixelsWithin1RGB':near,'legacyTealPixels':c[(47,99,115)],'dominantColors':[{'color':'#'+''.join(f'{v:02X}'for v in k),'pixels':n}for k,n in c.most_common(4)]}
modules=['directory','tts','appearance','settings']
for name in names[:5]:
 nodes,im=loaded[name];nav=sorted([n for n in nodes if n['attrs'].get('type')=='Image'and n['effectiveOpacity']>.99 and n['rect'][1]==2488],key=lambda n:n['rect'][0]);assert len(nav)==4
 for module,n in zip(modules,nav):
  active=name=='night-'+module;expected='#1C1A18'if active else'#D2BD96';q=pixels(im,n['rect'],expected)
  result['nav'].append({'screen':name,'module':module,'active':active,'bounds':n['rect'],'effectiveOpacity':n['effectiveOpacity'],**q,'pass':q['foregroundPixelsWithin1RGB']>500 and q['legacyTealPixels']==0})
nodes,im=loaded['night-home'];quick=sorted([n for n in nodes if n['attrs'].get('type')=='Image'and n['effectiveOpacity']>.99 and n['rect'][1]==2133],key=lambda n:n['rect'][0]);assert len(quick)==3
for label,n in zip(['搜索','自动翻页','替换'],quick):
 q=pixels(im,n['rect'],'#EADFCE');result['quickActions'].append({'label':label,'bounds':n['rect'],**q,'pass':q['foregroundPixelsWithin1RGB']>300 and q['legacyTealPixels']==0})
nodes,im=loaded['night-full-directory'];marks=[n for n in nodes if n['attrs'].get('type')=='Image'and n['effectiveOpacity']>.99 and n['rect'][0]==1074 and n['rect'][3]-n['rect'][1]==53]
for n in marks:
 q=pixels(im,n['rect'],'#BAAD9C');result['directory'].append({'state':'visible empty bookmark (muted)','bounds':n['rect'],'ancestorDescriptions':n['ancestorDescriptions'],**q,'pass':q['foregroundPixelsWithin1RGB']>100})
result['directoryBoundaries']=['This local-book capture renders empty bookmarks only.','Download/completed/cached/failed and existing-bookmark state are not established by this VM image; retain SDK-only evidence.','No-entry retained old component remains SDK-only.']
for module in ['replace','inbook-search']:
 states={}
 for form in ['full','collapsed']:
  ns,_=loaded[module+'-'+form];summary={}
  for id in ['reader-control-motion-shell','reader-control-content-host','reader-control-collapse']:
   for n in ns:
    if n['attrs'].get('id')==id:summary[id]={'bounds':n['rect'],'effectiveOpacity':n['effectiveOpacity']}
  states[form]=summary
 a=states['full']['reader-control-motion-shell']['bounds'];b=states['collapsed']['reader-control-motion-shell']['bounds'];states['pass']=a==[46,388,1235,2734]and b==[46,1579,1235,2734]
 states['scope']='Native layout transitioned Full→Quick; collapsed PNG not captured, no claim about transition frame smoothness.';result['collapse'][module]=states
for name in ['night-shelf','night-app-settings']:
 nodes,im=loaded[name];nav=sorted([n for n in nodes if n['attrs'].get('type')=='Image' and n['effectiveOpacity']>.99 and n['rect'][1]==2539],key=lambda n:n['rect'][0]);assert len(nav)==2
 for module,n in zip(['bookshelf','settings'],nav):
  active=(name=='night-shelf' and module=='bookshelf')or(name=='night-app-settings'and module=='settings');expected='#FFFAF4'if active else'#BAAD9C';q=pixels(im,n['rect'],expected)
  result['appNav'].append({'screen':name,'module':module,'active':active,'bounds':n['rect'],**q,'pass':q['foregroundPixelsWithin1RGB']>400})
nodes,im=loaded['night-app-settings']
for n in [n for n in nodes if n['attrs'].get('type')=='Image'and n['effectiveOpacity']>.99 and n['rect'][0]==134]:
 q=pixels(im,n['rect'],'#D2BD96');result['appSettingsIcons'].append({'bounds':n['rect'],**q,'pass':q['foregroundPixelsWithin1RGB']>100})
nodes,im=loaded['night-book-info'];n=next(n for n in nodes if n['attrs'].get('text')=='完整目录');q=pixels(im,n['rect'],'#7A684F')
result['bookInfoIssue']={'observedText':q,'textBounds':n['rect'],'source':'LocalBookDetail.ets:319','rootCause':'Outlined action text consumes TOK_PRIMARY_DARK for Night fill (#7A684F), while its icon consumes primary (#D2BD96).','approvedFix':'Shared TOK_PRIMARY_TEXT: Day retains #1F3528; Night uses established primary #D2BD96. 41 foreground consumers repaired; no fill/border/layout changes.','status':'CODE_FIXED_LOCAL_REGRESSION_PASS_NEW_VM_OPEN'}
result['pass']=all(x['pass']for x in result['nav']+result['quickActions']+result['directory']+result['appNav']+result['appSettingsIcons'])and all(x['pass']for x in result['collapse'].values())
out.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'pass':result['pass'],'nav':len(result['nav']),'quickActions':result['quickActions'],'visibleEmptyBookmarks':len(result['directory']),'collapse':result['collapse'],'bookInfoIssue':result['bookInfoIssue']},ensure_ascii=False,indent=2))
