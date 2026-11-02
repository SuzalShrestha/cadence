"""score.py — original score for "Where did the day go?" (Cadence). Reads events.json, writes out/music.wav.
Shape: holes in a marimba ostinato (a day you can't remember) → digital zero → the ring's glock arpeggio →
the ostinato returns whole as the playhead resolves the day → a ladder that adds one register per rung →
groove under the features → layers subtracted at each privacy cut → one D major 9 chord.
Key: D Lydian. 96 BPM. Samples: VCSL (CC0)."""
import os, sys, json, numpy as np, soundfile as sf
HERE = os.path.dirname(os.path.abspath(__file__)); LIB = os.environ['LIB']; sys.path.insert(0, LIB)
from core.audio import sampler as S
from core.audio.sfx import SR, t_, env_exp, lp, hp, bp, noise, add, limit

EVJ = json.load(open(os.path.join(HERE, 'events.json'))); EV = EVJ['ev']
META = next(e for e in EV if e['type'] == 'meta'); K = META['K']; BEAT = META['BEAT']; DUR = META['DUR']
S8, S16 = BEAT / 2, BEAT / 4
N = int(DUR * SR)
rng = np.random.default_rng(45)
h = lambda n: (np.sin(n * 127.1 + 311.7) * 43758.5453) % 1.0
S.seed(7)

OST = [62, 69, 76, 69, 78, 69, 76, 73]          # D4 A4 E5 A4 F#5 A4 E5 C#5
HI = [74, 81, 88, 81, 90, 81, 88, 85]            # an octave up, for the ladder's hour rung
CHORD = [62, 66, 69, 73, 76]                     # D maj9
LYD = [62, 64, 66, 68, 69, 71, 73]
notes = []                                       # sampler events
synth = np.zeros((N, 2))                         # sine pulse, shaker, sub

def n(t, inst, p, d, v, pan=0.0, **kw):
    if t < DUR - 0.05: notes.append(dict(t=float(t), inst=inst, pitch=p, dur=d, vel=float(np.clip(v, .05, 1)), pan=pan, **kw))

def ostinato(t0, t1, vel, keep=lambda t: 1.0, pat=OST, step=S8, pan=-.15, inst='marimba'):
    k = 0; t = t0
    while t < t1 - 1e-6:
        if h(t * 13.1) < keep(t): n(t, inst, pat[k % len(pat)], step * 1.6, vel * (1 if k % 2 == 0 else .82), pan)
        k += 1; t = t0 + k * step

def pulse(t0, t1, gain, step=BEAT, f=73.42):
    t = t0
    while t < t1 - 1e-6:
        d = .5; x = np.sin(2 * np.pi * f * t_(d)) * env_exp(d, .12) + .35 * np.sin(2 * np.pi * 2 * f * t_(d)) * env_exp(d, .06) + .18 * np.sin(2 * np.pi * 3 * f * t_(d)) * env_exp(d, .04)
        add(synth, x * gain, t, 1, 0); t += step

def shaker(t0, t1, gain, step):
    t = t0; k = 0
    while t < t1 - 1e-6:
        d = .06; x = bp(noise(d), 5000, 11000) * env_exp(d, .012) * (1 if k % 2 == 0 else .6)
        add(synth, x * gain, t, 1, .25); k += 1; t = t0 + k * step

# ── A. hook: low pulse, glock on the digit locks
pulse(0.3, K['tlOpen'], .10, BEAT * 2)
for t, p in zip(K['locks'], [86, 93, 90]): n(t, 'glockenspiel', p, 1.5, .45, .1)
n(1.9, 'vibraphone', 62, 3.0, .35, -.2); n(1.9, 'vibraphone', 69, 3.0, .3, .2)

# ── B. the day: an ostinato with holes that grow; dissonance and density rise
ostinato(K['tlOpen'], K['freeze'], .5, keep=lambda t: 0.78 - 0.4 * np.clip((t - 5) / 12, 0, 1))
ostinato(K['slivers'], K['freeze'], .32, keep=lambda t: 0.35 + 0.3 * np.clip((t - 10) / 7, 0, 1), pat=[p + 12.3 for p in OST], step=S8, pan=.5)
pulse(K['tlOpen'], K['freeze'], .12)
shaker(7.5, K['tilt'], .05, S8); shaker(K['tilt'], K['sheet'], .06, S16); shaker(K['sheet'], K['freeze'], .07, BEAT / 6)
n(K['tilt'], 'vibraphone_bowed', 62, K['freeze'] - K['tilt'], .35, -.3, attack=2.0, release=.01)
n(K['tilt'] + 1.2, 'vibraphone_bowed', 63, K['freeze'] - K['tilt'] - 1.2, .32, .3, attack=2.0, release=.01)

# ── D. the turn: glock arpeggio while the ring draws, Lydian pad
n(K['turn'], 'vibraphone_bowed', 62, 5.6, .5, -.25, attack=.6)
for p, pan in zip([66, 69, 73, 80], [-.1, .1, .25, -.2]): n(K['turn'] + .25, 'vibraphone_bowed', p, 5.3, .38, pan, attack=1.0)
for i, p in enumerate([81, 85, 86, 88, 90, 92, 93]): n(K['turn'] + .1 + i * S16, 'glockenspiel', p, 1.2, .38 + .04 * i, .3 - .1 * i)
n(K['icon'], 'vibraphone', 74, 2.5, .5, 0); n(K['icon'], 'vibraphone', 81, 2.5, .4, 0)
n(K['word'], 'marimba', 50, 1.5, .55, 0); n(K['word'], 'vibraphone', 78, 2.0, .45, .1)

# ── E. the playhead: the ostinato comes back whole
ostinato(K['sweep0'], K['dive'], .52)
pulse(K['sweep0'], K['dive'], .13)
shaker(K['sweep0'], K['dive'], .045, S8)
for e in EV:
    if e['type'] == 'resolve': n(e['t'], 'vibraphone', [74, 76, 78, 80, 81, 83, 85][e['c']], 1.4, .5, e['pan'] * .6)
for i, p in enumerate([98, 93, 90, 88, 86, 85, 81, 78]): n(K['lanes'] + i * S16 / 2, 'glockenspiel', p, 1.0, .35, -.3 + .08 * i)
n(K['laneLand'], 'vibraphone_bowed', 62, 2.2, .35, 0, attack=.3); n(K['laneLand'], 'vibraphone_bowed', 69, 2.2, .3, 0, attack=.3)

# ── F. the ladder: one register per rung
r1, r2, r3, r4 = K['rungs']
n(K['dive'], 'vibraphone_bowed', 66, 2.0, .35, 0, attack=.2)
n(K['tile'], 'glockenspiel', 86, 2.4, .55, 0)
pulse(K['tile'], r4, .08, BEAT * 2)
ostinato(K['hour'], r4 + BEAT * 2, .3, pat=HI, step=S16, pan=.2, keep=lambda t: 1.0)
for b in np.arange(r1, r4, BEAT): n(b, 'vibraphone', 66 if int(round((b - r1) / BEAT)) % 2 == 0 else 69, 1.2, .42, -.2); n(b, 'vibraphone', 73, 1.2, .35, .2)
for b in np.arange(r2, r4, BEAT / 2): n(b, 'marimba', 50, .6, .55, 0)
pulse(r2, r4, .16, BEAT / 2, f=73.42)
for p in CHORD: n(r3, 'vibraphone_bowed', p, (K['focus'] - r3) + .3, .42, (p - 68) / 12, attack=.5)
for p, v in [(50, .7), (62, .6), (74, .5)]: n(r4, 'marimba', p, 2.5, v, 0)
for p in [78, 81, 85, 88]: n(r4, 'vibraphone', p, 3.0, .5, (p - 82) / 10)
n(r4, 'glockenspiel', 98, 3.0, .5, 0)
for i in range(8): n(K['yearSweep'] + i * S16, 'glockenspiel', [86, 88, 90, 93, 98, 93, 90, 88][i], 1.0, .25, -.6 + i * .17)
ostinato(r4 + BEAT * 2, K['focus'], .3, step=S8)

# ── G. focus: the groove; it thins under the blocker
grooveA = lambda t: 0.45 if K['blocker'] <= t < K['squash'] else 1.0
ostinato(K['focus'], K['privacy'] + 0.0, .42, keep=lambda t: (1.0 if t < K['cuts'][1] else 0.0) * grooveA(t))
pulse(K['focus'], K['cuts'][2], .13)
shaker(K['focusRun'], K['cuts'][0], .04, S16)
for p in [62, 66, 69, 73, 76]: n(K['ringFull'], 'vibraphone', p, 2.5, .48, (p - 68) / 14)
n(K['ringFull'], 'glockenspiel', 93, 2.0, .45, 0)

# ── H. reports: one note per bar, a chord for the total
for i, b in enumerate(K['bars']): n(b, 'vibraphone', [74, 78, 81, 85, 88][i], 1.2, .45, -.3 + .15 * i)
for p in [62, 69, 73, 78]: n(K['sheetLocks'][5], 'vibraphone', p, 2.0, .45, 0)

# ── I. privacy: subtract one layer per cut; near silence; one note when the Mac lights
for p in [62, 69, 73]: n(K['privacy'], 'vibraphone_bowed', p, K['hush'] - K['privacy'], .3, 0, attack=.4, release=.01)
ostinato(K['privacy'], K['cuts'][1], .4)
n(K['rim'], 'vibraphone', 74, 3.0, .55, 0); n(K['rim'], 'glockenspiel', 93, 2.5, .35, 0)
for p in [62, 69, 76]: n(K['rim'] + .1, 'vibraphone_bowed', p, K['ending'] - K['rim'] + .4, .28, 0, attack=1.2)

# ── J. ending: echo of the hook, then one chord rings out
for t, p in zip([K['ending'] + .3125, K['ending'] + .46875, K['ending'] + .625], [86, 93, 90]): n(t, 'glockenspiel', p, 1.5, .45, .1)
for i in range(7): n(K['legend'] + i * S16, 'marimba', [74, 76, 78, 80, 81, 83, 85][i], 1.0, .45, -.3 + .1 * i)
pulse(K['ending'], K['endCard'], .08, BEAT * 2)
ec = K['endCard']
for p, v in [(38 + 12, .6), (62, .55)]: n(ec, 'marimba', p, 3.0, v, 0)
for p in [66, 69, 73, 76]: n(ec, 'vibraphone', p, 5.0, .5, (p - 70) / 12)
for p in CHORD: n(ec, 'vibraphone_bowed', p, DUR - ec - .6, .4, (p - 68) / 12, attack=.25, release=1.2)
for i, p in enumerate([86, 90, 93, 98]): n(ec + .1 + i * S16 / 2, 'glockenspiel', p, 2.5, .4, -.3 + .2 * i)
for i, p in enumerate([93, 90, 88, 86, 81]): n(K['outro'] + i * BEAT / 2, 'glockenspiel', p, 1.0, .22, .2 - .1 * i)
n(K['dotOff'], 'glockenspiel', 98, 1.5, .2, 0)

# sub under the low notes: a sine an octave below each marimba D3 hit
for e in list(notes):
    if e['inst'] == 'marimba' and e['pitch'] == 50:
        d = 1.0; x = np.sin(2 * np.pi * 73.42 * t_(d)) * env_exp(d, .25); add(synth, x * .12 * e['vel'], e['t'], 1, 0)

mus = S.render(notes, dur=DUR)[:N]
mus = S.room(mus, size=.42, mix=.16)
mix = mus + synth[:len(mus)] if len(mus) <= N else mus[:N] + synth
out = np.zeros((N, 2)); out[:len(mix)] = mix[:N]
# digital zero: freeze → turn
a, b = int(K['freeze'] * SR), int(K['turn'] * SR); out[a:b] = 0
os.makedirs(os.path.join(HERE, 'out'), exist_ok=True)
sf.write(os.path.join(HERE, 'out', 'music.wav'), out.astype(np.float32), SR)
json.dump(sorted({e['inst'] for e in notes}), open(os.path.join(HERE, 'out', 'instruments.json'), 'w'))
print('music', out.shape, 'peak', float(np.abs(out).max()), 'notes', len(notes))
