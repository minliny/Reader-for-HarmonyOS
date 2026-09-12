"""Parse public hitrace synchronous slices and guest scheduler residency.

Wall time includes nested work; residency is guest scheduled time, not host CPU
or photon timing. Deliberately do not sum nested slices into a frame total.
"""
import collections
import json
import re
from pathlib import Path

ROOT = Path(__file__).parent
APP = 23697
LINE = re.compile(r'^\s*(.+)-(\d+)\s+\(\s*(\d+|-------)\)\s+\[(\d+)\]\s+\S+\s+(\d+\.\d+):\s+(\S+):\s+(.*)$')

def analyze(path):
    stacks = collections.defaultdict(list)
    running = {}
    intervals = collections.defaultdict(list)
    slices = []
    unmatched = collections.Counter()
    raw = path.read_text()
    for line in raw.splitlines():
        m = LINE.match(line)
        if not m:
            continue
        _, tid, _, cpu, ts, kind, payload = m.groups()
        tid, cpu, ts = int(tid), int(cpu), float(ts)
        if kind == 'sched_switch':
            sw = re.search(r'prev_pid=(\d+).*next_pid=(\d+)', payload)
            if sw:
                prev, nxt = map(int, sw.groups())
                old = running.get(cpu)
                if old and old[0] == prev:
                    intervals[prev].append((old[1], ts))
                running[cpu] = (nxt, ts)
        elif kind == 'tracing_mark_write':
            fields = payload.split('|')
            if fields[0] == 'B' and len(fields) >= 3:
                stacks[tid].append((ts, fields[2]))
            elif fields[0] == 'E':
                if stacks[tid]:
                    begin, name = stacks[tid].pop()
                    if tid == APP:
                        slices.append(dict(start=begin, end=ts, wallMs=(ts-begin)*1000, name=name))
                else:
                    unmatched[tid] += 1
    for s in slices:
        s['guestScheduledMs'] = sum(max(0, min(s['end'], b)-max(s['start'], a)) for a,b in intervals[APP])*1000
        s['guestOffCpuMs'] = max(0, s['wallMs']-s['guestScheduledMs'])
        for k in ['wallMs', 'guestScheduledMs', 'guestOffCpuMs']:
            s[k] = round(s[k], 3)
    frames = sorted((s for s in slices if s['name'].startswith('H:OnVsyncEvent')), key=lambda s:s['start'])
    for s in frames:
        stamp = re.search(r'now:(\d+)', s['name'])
        if stamp:
            s['vsyncCallbackDelayMs'] = round((s['start']-int(stamp[1])/1e9)*1000, 3)
    inputs = sorted((s for s in slices if 'DispatchTouchEvent' in s['name']), key=lambda s:s['start'])
    custom = sorted((s for s in slices if 'CustomNodeUpdate' in s['name']), key=lambda s:-s['wallMs'])
    lifecycle = sorted((s for s in slices if ('CustomNodeBase:Destroy [ReadingSurface]' in s['name'] or
                         'CustomNode:BuildItem [ReadingSurface]' in s['name'])), key=lambda s:s['start'])
    gc = sorted((s for s in slices if re.search(r'GC|Garbage', s['name'])), key=lambda s:-s['wallMs'])
    first_input = inputs[0]['start'] if inputs else None
    last_input = inputs[-1]['start'] if inputs else None
    contact_frames = [s for s in frames if first_input is not None and first_input <= s['start'] <= last_input]
    return dict(file=path.name, entries=re.findall(r'entries-in-buffer/entries-written:.*', raw)[:1],
                appPid=APP, unmatchedAppEnds=unmatched[APP], unmatchedAppStarts=len(stacks[APP]),
                frames=frames, inputs=inputs, longestCustomUpdates=custom[:30],
                readingSurfaceLifecycle=lifecycle, longestGcNamedAppSlices=gc[:10],
                contactWindowPeakFrame=max(contact_frames,key=lambda s:s['wallMs']) if contact_frames else None,
                longestAppSlices=sorted(slices,key=lambda s:-s['wallMs'])[:40])

results=[]
for path in sorted(ROOT.glob('*trace.ftrace')):
    r=analyze(path)
    results.append(r)
    f=r['frames']
    print(path.name, 'inputs',len(r['inputs']), 'frames',len(f), 'maxWallMs',max((s['wallMs'] for s in f),default=0), 'topCustom', [(s['name'],s['wallMs'],s['guestScheduledMs']) for s in r['longestCustomUpdates'][:3]])
(ROOT/'trace-analysis.json').write_text(json.dumps(results,ensure_ascii=False,indent=2)+'\n')
