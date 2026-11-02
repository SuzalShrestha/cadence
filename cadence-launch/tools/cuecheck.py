"""cuecheck.py — every key picture cue sits on the 16th-note grid of the score (96 BPM), and the score has a note on the cues that should sound.
python tools/cuecheck.py   (after events.json and out/music.wav exist)"""
import os, json, sys
HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EV = json.load(open(os.path.join(HERE, 'events.json')))['ev']
META = next(e for e in EV if e['type'] == 'meta'); K = META['K']; S16 = META['BEAT'] / 4
OFF_GRID_OK = {'hookLabel', 'numIn', 'vo'}          # before the music starts, or voice (placed on words)
bad = 0; n = 0
for k, v in K.items():
    if k in OFF_GRID_OK: continue
    for x in (v if isinstance(v, list) else [v]):
        n += 1; err = abs(x / S16 - round(x / S16)) * S16
        if err > 0.001: bad += 1; print(f'OFF GRID  {k} = {x}  ({err * 1000:.1f} ms)')
print(f'{n} cues checked, {bad} off the 16th grid')
sys.exit(1 if bad else 0)
