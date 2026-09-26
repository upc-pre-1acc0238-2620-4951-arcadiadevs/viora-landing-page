"""
Tiny studio: notes -> MIDI -> FluidSynth stems -> numpy mix -> seamless loop.

Every piece is written as a list of Parts (instrument + note events in beats).
A loop is rendered as two cycles plus a tail; the second cycle is kept, so the
end of the loop already rings into its own start (sustains and reverb wrap).
"""
import os
import subprocess
import tempfile

import mido
import numpy as np
import soundfile as sf
from scipy import signal

# FluidSynth (github.com/FluidSynth/fluidsynth/releases) and the GeneralUser GS
# SoundFont (schristiancollins.com, free for music creation, commercial too).
FS = os.environ.get('FLUIDSYNTH', 'fluidsynth')
SF2 = os.environ.get('SOUNDFONT', 'GeneralUser-GS.sf2')
SR = 48000
TPB = 960

NAMES = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}


def n(name):
    """'F#4' -> 66, 'Bb3' -> 58."""
    letter, rest = name[0], name[1:]
    shift = 0
    while rest and rest[0] in '#b':
        shift += 1 if rest[0] == '#' else -1
        rest = rest[1:]
    return 12 * (int(rest) + 1) + NAMES[letter] + shift


def ns(text):
    return [n(x) for x in text.split()]


class Part:
    def __init__(self, name, program, bank=0, drums=False, pan=64, gain=1.0, send=0.25,
                 swing=0.0, human=0.008, chorus=False, lowcut=0, highcut=0, width=1.0):
        self.name = name
        self.program = program
        self.bank = bank
        self.drums = drums
        self.pan = pan
        self.gain = gain
        self.send = send
        self.swing = swing
        self.human = human
        self.chorus = chorus
        self.lowcut = lowcut
        self.highcut = highcut
        self.width = width
        self.level = None  # dB relative to the lead; set by the arrangement
        self.notes = []  # (beat, length, pitch, velocity)
        self.ccs = []  # (beat, controller, value)

    def add(self, beat, length, pitch, vel=80):
        if isinstance(pitch, (list, tuple)):
            for p in pitch:
                self.notes.append((beat, length, p, vel))
        else:
            self.notes.append((beat, length, pitch, vel))
        return self

    def cc(self, beat, controller, value):
        self.ccs.append((beat, controller, value))
        return self


def swung(beat, amount):
    """Delays off-beat eighths: 0 = straight, 1/6 ≈ triplet swing."""
    if not amount:
        return beat
    whole = np.floor(beat)
    frac = beat - whole
    if abs(frac - 0.5) < 1e-6:
        return whole + 0.5 + amount
    return beat


def write_midi(part, bpm, cycles, cycle_beats, path, seed):
    rng = np.random.default_rng(seed)
    mid = mido.MidiFile(ticks_per_beat=TPB)
    track = mido.MidiTrack()
    mid.tracks.append(track)
    channel = 9 if part.drums else 0
    events = [(0, mido.MetaMessage('set_tempo', tempo=mido.bpm2tempo(bpm)))]
    if not part.drums:
        events.append((0, mido.Message('control_change', channel=channel, control=0, value=part.bank)))
    events.append((0, mido.Message('program_change', channel=channel, program=part.program)))
    events.append((0, mido.Message('control_change', channel=channel, control=10, value=part.pan)))
    events.append((0, mido.Message('control_change', channel=channel, control=7, value=110)))
    # Humanise once and repeat it exactly: identical cycles make the kept
    # cycle's tails match its own start, so the loop seam is inaudible.
    feel = [(rng.normal(0, part.human) * bpm / 60 if part.human else 0, rng.normal(0, 4))
            for _ in part.notes]
    # Ticks are computed once per note and shifted by whole cycles, so float
    # rounding can never move a note by a tick between cycles.
    timed = []
    for (beat, length, pitch, vel), (jitter, push) in zip(part.notes, feel):
        start = swung(beat, part.swing)
        on = int(round((start + jitter) * TPB))
        off = max(on + 1, int(round((start + length + jitter) * TPB)) - 2)
        timed.append((on, off, pitch, int(np.clip(vel + push, 1, 127))))
    for cycle in range(cycles):
        shift = cycle * cycle_beats * TPB
        for beat, controller, value in part.ccs:
            events.append((shift + int(round(beat * TPB)), mido.Message(
                'control_change', channel=channel, control=controller, value=int(value))))
        for on, off, pitch, velocity in timed:
            on, off = max(0, on + shift), max(1, off + shift)
            events.append((on, mido.Message('note_on', channel=channel, note=int(pitch), velocity=velocity)))
            events.append((off, mido.Message('note_off', channel=channel, note=int(pitch), velocity=0)))
    # note_off before note_on at the same tick, so repeated notes retrigger
    events.sort(key=lambda e: (e[0], 0 if e[1].type == 'note_off' else 1))
    now = 0
    for tick, message in events:
        message.time = tick - now
        now = tick
        track.append(message)
    mid.save(path)


def render_part(part, bpm, cycle_beats, cycles, total, seed):
    with tempfile.TemporaryDirectory() as tmp:
        mid_path = os.path.join(tmp, 'p.mid')
        wav_path = os.path.join(tmp, 'p.wav')
        write_midi(part, bpm, cycles, cycle_beats, mid_path, seed)
        subprocess.run([FS, '-ni', '-q', '-R', '0', '-C', '1' if part.chorus else '0', '-g', '0.5',
                        '-r', str(SR), '-o', 'synth.polyphony=512', '-F', wav_path, SF2, mid_path],
                       check=True, capture_output=True)
        audio, rate = sf.read(wav_path, dtype='float32', always_2d=True)
    assert rate == SR
    out = np.zeros((total, 2), dtype=np.float32)
    count = min(total, len(audio))
    out[:count] = audio[:count]
    return out


def butter(audio, cutoff, kind):
    sos = signal.butter(2, cutoff, btype=kind, fs=SR, output='sos')
    return signal.sosfilt(sos, audio, axis=0).astype(np.float32)


def widen(audio, width):
    mid = (audio[:, 0] + audio[:, 1]) / 2
    side = (audio[:, 0] - audio[:, 1]) / 2 * width
    return np.stack([mid + side, mid - side], axis=1)


def impulse(seconds=3.2, predelay=0.024, damping=0.55, seed=7):
    """Stereo hall: decorrelated noise, exponential decay, darker as it fades."""
    rng = np.random.default_rng(seed)
    length = int(seconds * SR)
    t = np.arange(length) / SR
    ir = rng.standard_normal((length, 2)).astype(np.float32)
    ir *= np.exp(-6.9 * t / (seconds * 0.8))[:, None]
    # progressive damping: blend towards a low-passed copy over time
    dark = butter(ir, 2400, 'low')
    mix = np.clip(t / (seconds * damping), 0, 1)[:, None]
    ir = ir * (1 - mix) + dark * mix
    ir[: int(0.004 * SR)] *= np.linspace(0, 1, int(0.004 * SR))[:, None]
    pad = np.zeros((int(predelay * SR), 2), dtype=np.float32)
    ir = np.concatenate([pad, ir])
    return ir / np.sqrt((ir ** 2).sum() / 2)


def reverb(audio, ir):
    wet = np.stack([signal.fftconvolve(audio[:, c], ir[:, c])[: len(audio)] for c in range(2)], axis=1)
    return butter(wet, 180, 'high').astype(np.float32)


def periodic_noise(length, seed, lo, hi, tilt=-1.0):
    """Band-limited noise that loops perfectly (built in the frequency domain)."""
    rng = np.random.default_rng(seed)
    bins = length // 2 + 1
    freqs = np.fft.rfftfreq(length, 1 / SR)
    shape = np.where((freqs >= lo) & (freqs <= hi), 1.0, 0.0)
    shape[1:] *= (freqs[1:] / max(lo, 1)) ** (tilt / 2)
    # smooth band edges
    shape = np.convolve(shape, np.hanning(401) / np.hanning(401).sum(), mode='same')
    out = []
    for _ in range(2):
        spectrum = shape * np.exp(2j * np.pi * rng.random(bins))
        out.append(np.fft.irfft(spectrum, n=length))
    noise = np.stack(out, axis=1).astype(np.float32)
    return noise / (np.abs(noise).max() + 1e-9)


def wind(length, seed=3, level=0.5, gusts=4, lo=180, hi=1400):
    """Loopable wind: two noise bands whose loudness breathes in whole cycles."""
    t = np.arange(length) / length
    low = periodic_noise(length, seed, lo, hi * 0.5, tilt=-1.4)
    high = periodic_noise(length, seed + 1, hi * 0.4, hi * 2.4, tilt=-1.8)
    rng = np.random.default_rng(seed)
    phase = rng.random(4) * 2 * np.pi
    env_low = 0.55 + 0.45 * np.sin(2 * np.pi * gusts * t + phase[0]) * np.sin(2 * np.pi * (gusts + 1) * t + phase[1])
    env_high = np.clip(0.2 + 0.8 * np.sin(2 * np.pi * (gusts + 2) * t + phase[2]) ** 3, 0, 1)
    out = low * env_low[:, None] + 0.35 * high * env_high[:, None]
    return (out / np.abs(out).max() * level).astype(np.float32)


def circular_filter(audio, cutoff, kind):
    """IIR on a loop: run over two passes and keep the second (settled) one."""
    twice = np.concatenate([audio, audio])
    return butter(twice, cutoff, kind)[len(audio):]


def master(mix, target_rms_db=-21.0, ceiling_db=-1.5):
    mix = circular_filter(mix, 32, 'high')
    rms = np.sqrt((mix ** 2).mean())
    mix = mix * (10 ** (target_rms_db / 20) / (rms + 1e-9))
    # gentle tape-style saturation only above the ceiling
    ceiling = 10 ** (ceiling_db / 20)
    peak = np.abs(mix).max()
    if peak > ceiling:
        mix = np.tanh(mix / ceiling) * ceiling
        rms = np.sqrt((mix ** 2).mean())
        mix = mix * (10 ** (target_rms_db / 20) / (rms + 1e-9))
        mix = np.clip(mix, -ceiling, ceiling)
    return mix.astype(np.float32)


def wrap(audio, length):
    """Folds everything past the loop end back onto its start: a note or tail
    that rings over the seam keeps ringing at the top of the next pass."""
    out = audio[:length].copy()
    rest = audio[length:]
    while len(rest):
        chunk = rest[:length]
        out[: len(chunk)] += chunk
        rest = rest[length:]
    return out


def circular_reverb(audio, ir):
    """Convolution on the loop's circle, so the reverb tail wraps too."""
    length = len(audio)
    spectrum_ir = np.fft.rfft(ir, n=length, axis=0)
    wet = np.fft.irfft(np.fft.rfft(audio, axis=0) * spectrum_ir, n=length, axis=0)
    return circular_filter(wet.astype(np.float32), 180, 'high')


def render(parts, bpm, beats, extra=None, ir=None, send_db=0.0, target_rms_db=-21.0, seed=1,
           tail=6.0):
    """Mixes the parts into one seamless loop of `beats` beats. Each stem is a
    single pass plus its tail, wrapped onto itself. `extra(length)` may return
    a loop-length layer (wind, etc.) added dry."""
    length = int(round(beats * 60 / bpm * SR))
    total = length + int(tail * SR)
    ir = impulse() if ir is None else ir
    dry = np.zeros((length, 2), dtype=np.float32)
    send = np.zeros((length, 2), dtype=np.float32)
    for index, part in enumerate(parts):
        stem = render_part(part, bpm, beats, 1, total, seed + index)
        if part.lowcut:
            stem = butter(stem, part.lowcut, 'high')
        if part.highcut:
            stem = butter(stem, part.highcut, 'low')
        stem = wrap(stem, length)
        if part.width != 1.0:
            stem = widen(stem, part.width)
        if part.level is not None:
            # balance by perceived loudness (low end discounted), lead at -30 dB
            body = butter(stem, 110, 'high')
            measured = 20 * np.log10(np.sqrt((body ** 2).mean()) + 1e-12)
            stem *= 10 ** ((-30 + part.level - measured) / 20)
        else:
            stem *= part.gain
        if os.environ.get('STEMS'):
            print(f'   {part.name:10s} rms {20 * np.log10(np.sqrt((stem ** 2).mean()) + 1e-9):6.1f} dB')
        dry += stem
        send += stem * part.send
    loop = dry + circular_reverb(send, ir) * (10 ** (send_db / 20))
    if extra is not None:
        loop += extra(length)
    return master(loop, target_rms_db)


def save(loop, name, out_dir):
    os.makedirs(out_dir, exist_ok=True)
    path = os.path.join(out_dir, f'{name}.wav')
    sf.write(path, loop, SR, subtype='PCM_16')
    return path


def report(loop, name):
    rms = 20 * np.log10(np.sqrt((loop ** 2).mean()) + 1e-9)
    peak = 20 * np.log10(np.abs(loop).max() + 1e-9)
    steps = np.abs(np.diff(loop, axis=0)).max(axis=1)
    seam = np.abs(loop[0] - loop[-1]).max() / (np.percentile(steps, 99.9) + 1e-9)
    spec = np.abs(np.fft.rfft(loop.mean(axis=1)))
    freqs = np.fft.rfftfreq(len(loop), 1 / SR)
    bands = [(20, 120), (120, 500), (500, 2000), (2000, 6000), (6000, 16000)]
    energy = [spec[(freqs >= a) & (freqs < b)].__pow__(2).sum() for a, b in bands]
    total = sum(energy)
    shares = ' '.join(f'{a}-{b}:{e / total * 100:4.1f}%' for (a, b), e in zip(bands, energy))
    print(f'{name:10s} {len(loop) / SR:6.2f}s rms {rms:6.1f} dB peak {peak:5.1f} dB seam {seam:.2f}x | {shares}')
