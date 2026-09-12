import json,sys,time,subprocess,os
from pathlib import Path
out=Path(sys.argv[1]);nonce=sys.argv[2];label=sys.argv[3] if len(sys.argv)>3 else 'clock-boundary-next';direction=sys.argv[4] if len(sys.argv)>4 else 'next'
lock=Path('/private/tmp/reader-harmony-target-6460677a198b.lock/owner.json');d=json.loads(lock.read_text());assert d['probeNonce']==nonce;os.kill(d['pid'],0)
h=['/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/toolchains/hdc','-t','127.0.0.1:5555']
r=subprocess.run(h+['shell','date','+%s'],capture_output=True,text=True,check=True,timeout=10);now=int(r.stdout.strip());delay=60-now%60+.35
(out/(label+'-schedule.json')).write_text(json.dumps({'guestEpochBefore':now,'delaySeconds':delay,'targetBoundaryEpoch':now-now%60+60,'scope':'first turn immediately after idle minute boundary'}))
print('Waiting for next guest minute, seconds:',delay,flush=True);time.sleep(delay)
r=subprocess.run(['python3','/tmp/reader_vm_swipe_sample.py',str(out),label,nonce,direction,'frames']);sys.exit(r.returncode)
