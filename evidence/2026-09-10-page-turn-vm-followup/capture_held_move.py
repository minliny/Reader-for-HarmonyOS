"""Bounded public uinput gesture + public hitrace, under the existing probe lock.
No app source, lifecycle, storage, or device permissions are modified.
"""
import argparse
import datetime
import json
import subprocess
import time
from pathlib import Path

p=argparse.ArgumentParser()
p.add_argument('direction',choices=['next','previous'])
p.add_argument('label')
a=p.parse_args()
assert a.label.replace('-', '').isalnum()
root=Path(__file__).parent
lock=Path('/private/tmp/reader-harmony-target-6460677a198b.lock')
assert lock.exists(), 'Existing task probe must own the VM before running.'
hdc=['/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/toolchains/hdc','-t','127.0.0.1:5555']
remote=f'/data/local/tmp/reader-control-{a.label}.ftrace'
trace=hdc+['shell','hitrace','-t','6','-b','32768','--trace_clock','mono','ace','app','ark','animation','graphic','multimodalinput','sched','-o',remote]
xs=['900','1400','400','1400'] if a.direction=='next' else ['400','1400','900','1400']
gesture=hdc+['shell','uinput','-T','-m']+xs+['-k','500','500']
started=datetime.datetime.now(datetime.timezone.utc).isoformat()
t=subprocess.Popen(trace,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
time.sleep(1)
gstart=time.monotonic()
g=subprocess.run(gesture,capture_output=True,text=True,timeout=8)
elapsed=time.monotonic()-gstart
tout,terr=t.communicate(timeout=12)
receive=subprocess.run(hdc+['file','recv',remote,str(root/f'{a.label}-trace.ftrace')],capture_output=True,text=True,timeout=8)
result=dict(startedAt=started,traceArgs=trace,traceStatus=t.returncode,traceOut=tout,traceErr=terr,gestureArgs=gesture,gestureStatus=g.returncode,gestureElapsedMs=elapsed*1000,gestureOut=g.stdout,gestureErr=g.stderr,receiveStatus=receive.returncode,receiveOut=receive.stdout,
            caution='Command elapsed time does not prove held contact: validate DOWN/MOVE/UP in the trace. No screen capture during measurement.')
(root/f'{a.label}-capture.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(result,ensure_ascii=False))
