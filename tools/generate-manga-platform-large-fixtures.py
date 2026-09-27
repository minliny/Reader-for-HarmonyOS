from pathlib import Path
from PIL import Image, ImageDraw
import hashlib, json, struct, zlib
ROOT=Path(__file__).resolve().parents[1]
root=ROOT/'entry/src/main/resources/rawfile/manga-platform-probe-v1'
root.mkdir(parents=True,exist_ok=True)
width,height=1024,32768
# Fixed synthetic bars, independent from every Reader transform/codec path.
palette=[(232,214,15),(241,3,20),(214,9,201),(3,242,31),(13,224,216),(4,18,240)]
im=Image.new('RGB',(width,height))
d=ImageDraw.Draw(im)
for band in range(32):
    y=band*1024
    d.rectangle((0,y,1023,y+1023), fill=palette[band%6])
    d.rectangle((0,y,255,y+1023), fill=palette[(band+1)%6])
    d.rectangle((768,y,1023,y+1023), fill=palette[(band+3)%6])
    d.rectangle((256,y+480,767,y+543), fill=palette[(band+4)%6])
    d.rectangle((0,y,1023,y+15), fill=(band*7+9,band*5+31,band*3+71))
exif=Image.Exif();exif[274]=1
out=root/'large-long-1024x32768.png'
im.save(out,format='PNG',compress_level=9,exif=exif)
encoded=out.read_bytes()
assert encoded[28]==0, 'must be non-interlaced'
assert len(encoded)<1024*1024
assert struct.unpack('>II',encoded[16:24])==(width,height)
rois=[]
for name,y,position in [('first',0,0),('middle',16384,0.5),('last',31744,1)]:
    crop=im.crop((0,y,width,y+1024)).convert('RGBA')
    pixels=crop.tobytes()
    oracle=ROOT/'tools/fixtures/manga-platform-large'
    oracle.mkdir(parents=True,exist_ok=True)
    (oracle/(name+'.rgba.deflate')).write_bytes(zlib.compress(pixels,9))
    samples=[{'x':x,'y':local_y,'rgba':list(crop.getpixel((x,local_y)))} for x,local_y in [(128,8),(128,128),(512,128),(896,128),(512,512),(512,896)]]
    rois.append(dict(id=name,position=position,regionY=y,width=width,height=1024,rgbaBytes=len(pixels),sha256=hashlib.sha256(pixels).hexdigest(),samples=samples))
control=root/'control-long-1024x2048.png'
im.crop((0,0,1024,2048)).save(control,format='PNG',compress_level=9,exif=exif)
control_bytes=control.read_bytes()
manifest=dict(schemaVersion=1,generator='Pillow '+Image.__version__+' RGB fixed color bars + independent crop RGBA SHA256',
 file=out.name,width=width,height=height,orientation=1,interlaced=False,colorType=encoded[25],encodedBytes=len(encoded),sha256=hashlib.sha256(encoded).hexdigest(),
 fullRgbaBytes=width*height*4,roiRgbaBytes=1024*1024*4,rois=rois,
 control=dict(file=control.name,width=1024,height=2048,encodedBytes=len(control_bytes),sha256=hashlib.sha256(control_bytes).hexdigest(),firstRoiSha256=rois[0]['sha256']),
 evidence='Fixture geometry/oracles only; no platform decoder, peak memory, or display evidence')
(root/'large-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
print(json.dumps(manifest,indent=2))

region_keys=['id','position','regionY','width','height','sha256']
large_ts = """// Fixed DEBUG-only non-interlaced PNG; independently generated Pillow ROI digests.
export interface MangaPlatformLargeRegion { id: string; position: number; regionY: number; width: number; height: number; sha256: string; }
export interface MangaPlatformLargeFixture { id: string; file: string; sha256: string; width: number; height: number; orientation: number; rois: MangaPlatformLargeRegion[]; }
export const MANGA_PLATFORM_LARGE_FIXTURE: MangaPlatformLargeFixture = """+json.dumps(dict(id='large-long',file=manifest['file'],sha256=manifest['sha256'],width=width,height=height,orientation=1,rois=[{k:r[k] for k in region_keys} for r in rois]),indent=2)+';\n'
large_ts += 'export const MANGA_PLATFORM_LARGE_CONTROL: MangaPlatformLargeFixture = '+json.dumps(dict(id='large-control',file=control.name,sha256=manifest['control']['sha256'],width=1024,height=2048,orientation=1,rois=[{k:rois[0][k] for k in region_keys}]),indent=2)+';\n'
(ROOT/'entry/src/main/ets/app/MangaPlatformLargeFixture.ts').write_text(large_ts)
