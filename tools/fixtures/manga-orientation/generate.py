"""Fixed real codec fixtures and independent EXIF goldens; Pillow 11.3.0.
Run from this directory. Reader production never imports this test generator.
"""
from PIL import Image, ImageOps
from pathlib import Path
import json, hashlib, base64
root=Path(__file__).parent
out={'generator':'Pillow 11.3.0 ImageOps.exif_transpose; test-only, HPND','cases':[]}
for ext,fmt in [('png','PNG'),('jpg','JPEG'),('webp','WEBP')]:
 for orientation in range(1,9):
  im=Image.new('RGB',(3,2));im.putdata([(241,3,20),(3,242,31),(4,18,240),(232,214,15),(214,9,201),(13,224,216)])
  exif=Image.Exif();exif[274]=orientation
  p=root/f'orientation-{orientation}.{ext}'
  im.save(p,format=fmt,exif=exif,**({'lossless':True} if fmt=='WEBP' else {'quality':100,'subsampling':0} if fmt=='JPEG' else {}))
  decoded=Image.open(p);expected=ImageOps.exif_transpose(decoded).convert('RGBA');raw=decoded.convert('RGBA')
  out['cases'].append({'file':p.name,'orientation':orientation,'mimeType':'image/jpeg' if ext=='jpg' else 'image/'+ext,'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'width':raw.width,'height':raw.height,'rgba':base64.b64encode(raw.tobytes()).decode(),'outputWidth':expected.width,'outputHeight':expected.height,'outputSha256':hashlib.sha256(expected.tobytes()).hexdigest()})
for orientation in range(1,9):
 size=(17,4111) if orientation<5 else (4111,17)
 im=Image.new('RGB',size);im.putdata([((x*13+y*3)%256,(x*7+y*19)%256,(x*23+y*29)%256) for y in range(size[1]) for x in range(size[0])])
 exif=Image.Exif();exif[274]=orientation;p=root/f'long-{orientation}.png';im.save(p,exif=exif)
 decoded=Image.open(p);expected=ImageOps.exif_transpose(decoded).convert('RGBA');raw=decoded.convert('RGBA')
 out['cases'].append({'file':p.name,'orientation':orientation,'mimeType':'image/png','sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'width':raw.width,'height':raw.height,'rgba':base64.b64encode(raw.tobytes()).decode(),'outputWidth':expected.width,'outputHeight':expected.height,'outputSha256':hashlib.sha256(expected.tobytes()).hexdigest()})
for case in out['cases']:
 if case['file'].startswith('long-') and case['orientation'] not in (1,5):
  case['rgbaFrom']='long-1.png' if case['orientation']<5 else 'long-5.png'
  del case['rgba']
(root/'goldens.json').write_text(json.dumps(out,separators=(',',':'))+'\n')
