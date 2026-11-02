"""mix.py — foley + ambience + voice + score → out/mix.wav, and out/srt.json for the subtitles.
Disorder sounds are scattered (detuned, random pans, a different timbre per source). Cadence's sounds are one family:
felt ticks and glass taps in D Lydian, centred. Two silences: digital zero freeze→turn, near-silence before the Mac lights."""
import os, sys, json, numpy as np, soundfile as sf
from scipy.signal import resample_poly
from scipy.ndimage import uniform_filter1d
HERE = os.path.dirname(os.path.abspath(__file__)); LIB = os.environ['LIB']; sys.path.insert(0, LIB)
from core.audio.sfx import SR, t_, env_exp, bp, lp, hp, noise, norm, brown, add, compress, limit

EV = json.load(open(os.path.join(HERE, 'events.json')))['ev']
META = next(e for e in EV if e['type'] == 'meta'); K = META['K']; DUR = META['DUR']; BEAT = META['BEAT']
LINES = {l['id']: l for l in json.load(open(os.path.join(HERE, 'lines.json')))}
DURS = json.load(open(os.path.join(HERE, 'voices', 'dur.json')))
rng = np.random.default_rng(2611)
N = int(DUR * SR); tt = np.arange(N) / SR
fol = np.zeros((N, 2)); amb = np.zeros((N, 2)); vox = np.zeros((N, 2))
hz = lambda m: 440 * 2 ** ((m - 69) / 12)
LYD = [74, 76, 78, 80, 81, 83, 85, 86, 88, 90]

def sine(f, d, tau, ph=0): return np.sin(2 * np.pi * f * t_(d) + ph) * env_exp(d, tau)
def tick(v=1.0, f=2100):
    d = .03; return norm(bp(noise(d), 1500, 3400) * env_exp(d, .0025) + sine(f, d, .004) * .6) * v
def glass(f, v=1.0, d=.5, bright=1.0):
    x = sine(f, d, d * .35) + sine(2 * f, d, d * .18) * .35 * bright + sine(2.76 * f, d, d * .1) * .2 * bright + hp(noise(d), 5000) * env_exp(d, .002) * .25
    return norm(x) * v
def felt(v=1.0, f=330):
    d = .09; x = sine(f, d, .018) + lp(noise(d), 1400) * env_exp(d, .006) * .7 + sine(f * 2.01, d, .01) * .3
    return norm(x) * v
def whoosh(d=.3, lo=500, hi=4000, v=1.0, up=True):
    n = noise(d); out = np.zeros_like(n); L = len(n); step = 480
    for i in range(0, L, step):
        u = i / L; u = u if up else 1 - u; f = lo * (hi / lo) ** u; w = min(step, L - i)
        out[i:i + w] = bp(n[max(0, i - 1500):i + w], f * .75, min(f * 1.3, SR / 2 - 100))[-w:]
    return norm(out * np.sin(np.pi * t_(d) / d) ** 1.5) * v
def plop(v=1.0):
    d = .08; f = 320 * (1 - .5 * t_(d) / d)
    return norm(np.sin(2 * np.pi * np.cumsum(f) / SR) * env_exp(d, .02) + bp(noise(d), 2000, 6000) * env_exp(d, .003) * .4) * v
def pop(v=1.0, f=900):
    d = .12; fr = f * (1 + .6 * np.exp(-t_(d) / .01)); return norm(np.sin(2 * np.pi * np.cumsum(fr) / SR) * env_exp(d, .03)) * v
def thump(v=1.0, f=60, d=.4):
    x = t_(d); return norm(np.sin(2 * np.pi * f * x * (1 - .25 * x)) * env_exp(d, .09) + lp(noise(d), 260) * env_exp(d, .02) * .6) * v
def doom(v=1.0, d=2.4):
    x = t_(d); f = 40 + 15 * np.exp(-x / .35)
    sub = np.sin(2 * np.pi * np.cumsum(f) / SR) * env_exp(d, .55)
    mallet = lp(noise(d), 700) * env_exp(d, .012) * .9 + sine(147, d, .05) * .5 + sine(98, d, .12) * .5
    return norm(sub + mallet + lp(noise(d), 900) * env_exp(d, .5) * .05) * v
def shimmer(d=1.6, v=1.0):
    x = whoosh(d, 3000, 9500, 1, True) * .6
    for m, a in [(93, .25), (98, .18), (102, .12)]: x += np.sin(2 * np.pi * hz(m) * t_(d)) * np.sin(np.pi * t_(d) / d) ** 2 * a
    return norm(x) * v
def grains(d=1.0, v=1.0):
    out = np.zeros(int(d * SR) + 1); t = 0.0
    while t < d - .01:
        c = bp(noise(.006), 2500, 9000) * env_exp(.006, .001) * rng.uniform(.4, 1); s = int(t * SR); out[s:s + len(c)] += c[:len(out) - s]
        t += .045 * (1 - .8 * t / max(d, .1)) + rng.uniform(0, .01)
    return norm(out) * v
def crt_off(v=1.0, d=.45):
    x = t_(d); f = 900 * np.exp(-x / .12) + 120
    return norm(np.sin(2 * np.pi * np.cumsum(f) / SR) * env_exp(d, .14) * .5 + whoosh(d, 3000, 300, 1, True) * .6) * v
def pluck(f, v=1.0):        # a scattered "switch": short plucked tone of random timbre
    d = .16; k = rng.integers(3)
    if k == 0: x = sine(f, d, .03) + sine(f * 3.01, d, .01) * .4
    elif k == 1: x = np.sign(np.sin(2 * np.pi * f * t_(d))) * env_exp(d, .02) * .4
    else: x = bp(noise(d), f * .8, f * 1.3) * env_exp(d, .025) * 3
    return norm(x) * v

for e in EV:
    t, ty, pan = e['t'], e['type'], e.get('pan', 0)
    if ty == 'tick': add(fol, tick(.25), t, 1, 0)
    elif ty == 'lock': add(fol, glass(hz(LYD[(e['i'] * 3) % len(LYD)] + 12), .14, .25), t, 1, 0); add(fol, tick(.18), t, 1, 0)
    elif ty == 'grains': add(fol, grains(e['d'], .09), t, 1, 0)
    elif ty == 'open': add(fol, whoosh(.45, 400, 3000, .16), t, 1, 0)
    elif ty == 'bar_open': add(fol, thump(.22, 70, .35), t, 1, 0); add(fol, felt(.12, 220), t, 1, 0)
    elif ty == 'mem': add(fol, felt(.3, 196 + 30 * e['i']), t, 1, pan * .6); add(fol, plop(.12), t + .02, 1, pan * .6)
    elif ty == 'hatch': add(fol, whoosh(.6, 1500, 6000, .06), t, 1, 0)
    elif ty == 'sliver':
        det = 2 ** (rng.uniform(-.6, .6) / 12); f = rng.choice([523, 659, 784, 932, 1109, 1245]) * det
        add(fol, pluck(f, rng.uniform(.035, .075)), t, 1, float(np.clip(pan + rng.uniform(-.4, .4), -1, 1)))
        if e.get('chip'): add(fol, pop(.05, rng.uniform(700, 1500)), t + .01, 1, float(rng.uniform(-.9, .9)))
    elif ty == 'sheet': add(fol, whoosh(.32, 600, 4500, .2), t - .05, 1, 0); add(fol, plop(.18), t + .22, 1, 0)
    elif ty == 'caret': add(fol, tick(.1), t, 1, .2)
    elif ty == 'turn': add(fol, doom(.75), t, 1, 0)
    elif ty == 'arc': add(fol, shimmer(e['d'] + .3, .14), t, 1, 0)
    elif ty == 'shimmer': add(fol, shimmer(e['d'], .12), t, 1, 0)
    elif ty == 'word': add(fol, whoosh(.4, 800, 5000, .1), t, 1, .2)
    elif ty == 'collapse': add(fol, crt_off(.18), t, 1, -.2)
    elif ty == 'fly': add(fol, whoosh(.3, 1200, 5000, .1), t, 1, -.5)
    elif ty == 'resolve': add(fol, glass(hz(LYD[e['c']] + 12), .06, .35), t, 1, pan * .5)
    elif ty == 'land': add(fol, felt(.11, hz(LYD[e['c']] - 12)), t, 1, pan * .5)
    elif ty == 'total': add(fol, tick(.12, 2400), t, 1, .5)
    elif ty == 'dive': add(fol, whoosh(.62, 3000, 300, .22, True), t, 1, 0)
    elif ty == 'tile': add(fol, glass(hz(86), .14, .6), t, 1, 0)
    elif ty == 'rung': add(fol, whoosh(.5, 300, 2500, .14 + .03 * e['i']), t - .1, 1, 0); add(fol, thump(.12 + .05 * e['i'], 55 - 4 * e['i'], .5), t + .45, 1, 0)
    elif ty == 'sample': add(fol, tick(.03, 3000), t, 1, rng.uniform(-.3, .3))
    elif ty == 'year': add(fol, thump(.4, 46, .9), t, 1, 0)
    elif ty == 'expand': add(fol, whoosh(.3, 500, 4000, .14), t, 1, 0)
    elif ty == 'focus_start': add(fol, felt(.22, 440), t, 1, 0)
    elif ty == 'feed': add(fol, whoosh(.25, 900, 3000, .12), t, 1, .7); add(fol, pop(.12, 1180 * 2 ** (.35 / 12)), t + .22, 1, .7)
    elif ty == 'blocker': add(fol, thump(.3, 62, .4), t + .2, 1, 0); add(fol, glass(hz(81), .1, .4), t + .2, 1, 0)
    elif ty == 'press': add(fol, doom(.4, 1.2), t, 1, 0); add(fol, felt(.25, 330), t, 1, 0)
    elif ty == 'crt': add(fol, crt_off(.16), t, 1, 0)
    elif ty == 'ring_full': add(fol, shimmer(.9, .1), t, 1, 0)
    elif ty == 'bar': add(fol, felt(.16, hz(LYD[e['i']] - 12)), t, 1, -.2)
    elif ty == 'press_soft': add(fol, felt(.25, 300), t, 1, .5)
    elif ty == 'chip': add(fol, glass(hz(90), .09, .4), t, 1, .5)
    elif ty == 'check': add(fol, glass(hz(93), .12, .7), t, 1, .2)
    elif ty == 'file': add(fol, plop(.14), t, 1, -.4)
    elif ty == 'ghost': add(fol, pop(.05, 700 * 2 ** (rng.uniform(-.5, .5) / 12)), t, 1, .7)
    elif ty == 'cut': add(fol, crt_off(.2, .4), t + .08, 1, .7)
    elif ty == 'rim': add(fol, shimmer(1.4, .12), t - .3, 1, 0)
    elif ty == 'close': add(fol, whoosh(.35, 3000, 600, .14), t, 1, 0)
    elif ty == 'legend': add(fol, tick(.08, 2600), t, 1, -.3 + .1 * e['i'])
    elif ty == 'end_card': add(fol, thump(.2, 50, .8), t, 1, 0)
    elif ty == 'retract': add(fol, crt_off(.07, .3), t, 1, 0)
    elif ty == 'dot_off': add(fol, crt_off(.08, .35), t, 1, .3)

# ── voice
srt = []
for e in EV:
    if e['type'] != 'vo': continue
    x, sr = sf.read(os.path.join(HERE, 'voices', e['id'] + '.wav'), dtype='float32')
    if x.ndim > 1: x = x.mean(1)
    if sr != SR: x = resample_poly(x, SR, sr)
    x = compress(x / (np.abs(x).max() + 1e-9) * .9, thr=.3, ratio=3.0)
    add(vox, x * .62, e['t'], 1, 0)
    L = LINES[e['id']]; srt.append({'t0': round(e['t'], 3), 't1': round(e['t'] + max(1.8, DURS[e['id']] + .6), 3), 'text': L.get('sub', L['text'])})
json.dump(srt, open(os.path.join(HERE, 'out', 'srt.json'), 'w'), indent=1)

# ── ambience: room, plus fan and coil whine that grow through the blur (kept low: they share the voice band)
room = lp(brown(DUR), 220)[:N] * .010
fan = bp(noise(DUR), 280, 1600)[:N] * .03 * np.clip((tt - 10.0) / 6.0, 0, 1) ** 1.6
coil = np.sin(2 * np.pi * (6800 + 30 * np.sin(2 * np.pi * .7 * tt)) * tt) * .0035 * np.clip((tt - 11.0) / 6, 0, 1) ** 2
pre = (tt < K['freeze'])
mono = room + (fan + coil) * pre
amb[:, 0] += mono; amb[:, 1] += np.roll(mono, 37)
# J-cut: a faint crowd of notification pops before the day opens
for k in range(18): add(amb, pop(.012 + .02 * k / 18, rng.uniform(700, 1500)), 4.3 + (k / 18) ** .8 * .7, 1, float(rng.uniform(-.8, .8)))

mus, msr = sf.read(os.path.join(HERE, 'out', 'music.wav'), dtype='float32'); mus = np.pad(mus, ((0, max(0, N - len(mus))), (0, 0)))[:N]

# ── ducking under voice: music −8 dB, foley −4 dB
v_on = uniform_filter1d((np.abs(vox).max(1) > .01).astype(float), int(.08 * SR))
v_env = np.clip(uniform_filter1d(v_on, int(.25 * SR)) * 1.5, 0, 1)
duck_m = 10 ** (-8 * v_env / 20); duck_f = 10 ** (-4 * v_env / 20)
mix = mus * duck_m[:, None] * .85 + fol * duck_f[:, None] + amb + vox

# ── silences: digital zero freeze → turn; near silence (−60 dB room) before the rim
def fade(x, a, b, f=.008):
    g = np.ones(N); s, e = int(a * SR), int(b * SR); g[s:e] = 0; k = int(f * SR)
    g[max(0, s - k):s] = np.linspace(1, 0, min(k, s)); g[e:e + k] = np.linspace(0, 1, len(g[e:e + k])); return x * g[:, None]
mix = fade(mix, K['freeze'], K['turn'], .006)
# the turn's doom must start exactly on the turn: re-add foley/music that begin at the turn
s = int(K['turn'] * SR); mix[s:] = (mus * duck_m[:, None] * .85 + fol * duck_f[:, None] + amb + vox)[s:]
a, b = int(K['hush'] * SR), int(K['rim'] * SR)
quiet = amb[a:b] * .1 + vox[a:b]
mix[a:b] = quiet; k = int(.05 * SR); mix[a - k:a] *= np.linspace(1, .1, k)[:, None]

for c in range(2): mix[:, c] = limit(mix[:, c], .95)
sf.write(os.path.join(HERE, 'out', 'mix.wav'), mix.astype(np.float32), SR)
stem = lambda x: 20 * np.log10(np.sqrt(np.mean(x ** 2)) + 1e-9)
print(f'mix ok  voice {stem(vox):.1f} dB  music {stem(mus):.1f} dB  foley {stem(fol):.1f} dB  peak {np.abs(mix).max():.2f}')
