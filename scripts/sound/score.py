"""
Viora score — "Nocturno andino".

One theme, many rooms. Every bed shares the same 16-bar form in D major at
90 BPM (42.667 s = exactly 2 048 000 samples at 48 kHz), so the site can
crossfade between them on any bar line and stay in time and in key.
The footer music box is its own 3/4 waltz of the same melody, 36 s long, locked
to the footer tapestry's four 9-second chapters.

Render (Python 3 with numpy, scipy, soundfile, mido; FluidSynth + GeneralUser GS):

    FLUIDSYNTH=path/to/fluidsynth SOUNDFONT=path/to/GeneralUser-GS.sf2       python scripts/sound/score.py out [theme tacna ...]

then encode each WAV to public/assets/sound/score/<name>.ogg (libvorbis -q:a 2)
and .m4a (aac 96k). The engine is src/core/sound.js.
"""
import sys

import numpy as np

from studio import Part, impulse, n, ns, render, report, save, wind

BPM = 90
BARS = 16
BEATS = BARS * 4
OUT = sys.argv[1] if len(sys.argv) > 1 else 'out'

# ── Harmony ────────────────────────────────────────────────────────────────
# (root, bass fifth, rootless voicing) per bar; bars with two chords use a
# list of (beat, root, fifth, voicing).
H = [
    [(0, 'D2', 'A2', 'F#3 A3 C#4 E4')],  # Dmaj9
    [(0, 'B1', 'F#2', 'A3 C#4 D4 F#4')],  # Bm9
    [(0, 'E2', 'B2', 'G3 B3 D4 F#4')],  # Em9
    [(0, 'A1', 'E2', 'G3 B3 D4 F#4'), (2, 'A1', 'E2', 'G3 B3 C#4 F#4')],  # A13sus → A13
    [(0, 'F#2', 'C#3', 'A3 C#4 E4 G#4')],  # F#m9
    [(0, 'B1', 'F#2', 'A3 C4 D#4 G#4')],  # B7b9
    [(0, 'E2', 'B2', 'G3 B3 D4 F#4')],  # Em9
    [(0, 'A1', 'E2', 'G3 B3 C#4 F#4')],  # A13
    [(0, 'G2', 'D3', 'F#3 A3 B3 D4')],  # Gmaj9
    [(0, 'G2', 'D3', 'Bb3 D4 E4 A4')],  # Gm6/9
    [(0, 'F#2', 'C#3', 'E3 A3 C#4 E4')],  # F#m7
    [(0, 'B1', 'F#2', 'A3 D#4 G4 C5')],  # B7b13b9
    [(0, 'E2', 'B2', 'G3 B3 D4 F#4')],  # Em9
    [(0, 'A1', 'E2', 'G3 B3 D4 E4')],  # A13sus
    [(0, 'D2', 'A2', 'F#3 A3 C#4 E4')],  # Dmaj9
    [(0, 'A1', 'E2', 'G3 B3 D4 E4'), (2, 'A1', 'E2', 'G3 Bb3 C#4 F4')],  # A7sus → A7b9b13
]

# Minor room for the problem (cases): same grid, the theme "worries".
HM = [
    [(0, 'B1', 'F#2', 'A3 C#4 D4 F#4')],  # Bm9
    [(0, 'G2', 'D3', 'F#3 A3 B3 C#4')],  # Gmaj7#11
    [(0, 'E2', 'B2', 'G3 B3 D4 F#4')],  # Em9
    [(0, 'F#2', 'C#3', 'E3 A#3 D4 G4')],  # F#7b13b9
    [(0, 'B1', 'F#2', 'A3 C#4 D4 F#4')],  # Bm9
    [(0, 'G2', 'D3', 'F#3 A3 B3 E4')],  # Gmaj9(13)
    [(0, 'C#2', 'G2', 'B3 E4 G4')],  # C#m7b5
    [(0, 'F#2', 'C#3', 'E3 A#3 D4 G4')],  # F#7alt
    [(0, 'E2', 'B2', 'G3 B3 D4 F#4')],  # Em9
    [(0, 'A1', 'E2', 'G3 B3 C#4 F#4')],  # A13
    [(0, 'D2', 'A2', 'F#3 A3 C#4 E4')],  # Dmaj9
    [(0, 'G2', 'D3', 'F#3 A3 B3 C#4')],  # Gmaj7#11
    [(0, 'C#2', 'G2', 'B3 E4 G4')],  # C#m7b5
    [(0, 'F#2', 'C#3', 'E3 A#3 D4 G4')],  # F#7b9
    [(0, 'B1', 'F#2', 'A3 C#4 D4 F#4')],  # Bm9
    [(0, 'F#2', 'C#3', 'E3 A#3 D4 G4')],  # F#7alt
]

# ── The theme (leitmotif): (bar, beat, length, note) ──────────────────────
MELODY = [
    (0, 0.5, 0.5, 'A4'), (0, 1, 1, 'F#5'), (0, 2, 1.5, 'E5'), (0, 3.5, 0.5, 'D5'),
    (1, 0, 2, 'C#5'), (1, 2, 0.5, 'B4'), (1, 2.5, 0.5, 'C#5'), (1, 3, 1, 'D5'),
    (2, 0, 1.5, 'F#5'), (2, 1.5, 0.5, 'E5'), (2, 2, 1, 'D5'), (2, 3, 1, 'B4'),
    (3, 0, 3, 'E5'), (3, 3.5, 0.5, 'C#5'),
    (4, 0, 1.5, 'A5'), (4, 1.5, 0.5, 'G#5'), (4, 2, 1, 'E5'), (4, 3, 1, 'C#5'),
    (5, 0, 1, 'D#5'), (5, 1, 0.5, 'E5'), (5, 1.5, 0.5, 'F#5'), (5, 2, 2, 'A5'),
    (6, 0, 1.5, 'G5'), (6, 1.5, 0.5, 'F#5'), (6, 2, 1, 'E5'), (6, 3, 1, 'D5'),
    (7, 0, 2, 'C#5'), (7, 2, 1, 'B4'), (7, 3, 1, 'A4'),
    (8, 0.5, 0.5, 'D5'), (8, 1, 1, 'B5'), (8, 2, 1.5, 'A5'), (8, 3.5, 0.5, 'F#5'),
    (9, 0, 1.5, 'Bb5'), (9, 1.5, 0.5, 'A5'), (9, 2, 2, 'E5'),
    (10, 0, 1.5, 'E5'), (10, 1.5, 0.5, 'C#5'), (10, 2, 2, 'A4'),
    (11, 0, 1, 'D#5'), (11, 1, 1, 'G5'), (11, 2, 2, 'F#5'),
    (12, 0, 1, 'B4'), (12, 1, 1, 'D5'), (12, 2, 1, 'F#5'), (12, 3, 1, 'E5'),
    (13, 0, 3, 'E5'), (13, 3, 0.5, 'D5'), (13, 3.5, 0.5, 'C#5'),
    (14, 0, 3, 'D5'), (14, 3, 0.5, 'E5'), (14, 3.5, 0.5, 'F#5'),
    (15, 0, 2, 'G5'), (15, 2, 1, 'F5'), (15, 3, 1, 'E5'),
]

# The theme in B minor, fragmented and lower: questions with no answers.
MELODY_MINOR = [
    (0, 1, 1, 'F#4'), (0, 2, 2, 'D5'),
    (1, 0, 1.5, 'C#5'), (1, 1.5, 0.5, 'B4'), (1, 2, 2, 'A4'),
    (2, 1, 1, 'G4'), (2, 2, 1.5, 'B4'), (2, 3.5, 0.5, 'A4'),
    (3, 0, 3, 'A#4'),
    (4, 1, 1, 'F#4'), (4, 2, 2, 'E5'),
    (5, 0, 1.5, 'D5'), (5, 1.5, 0.5, 'C#5'), (5, 2, 2, 'B4'),
    (6, 1, 1, 'G4'), (6, 2, 2, 'E5'),
    (7, 0, 3, 'C#5'),
    (8, 1, 1, 'B4'), (8, 2, 2, 'G5'),
    (9, 0, 1.5, 'F#5'), (9, 1.5, 0.5, 'E5'), (9, 2, 2, 'C#5'),
    (10, 0, 2, 'A4'), (10, 2, 2, 'F#5'),
    (11, 0, 3, 'C#5'),
    (12, 1, 1, 'E5'), (12, 2, 2, 'B4'),
    (13, 0, 3, 'A#4'),
    (14, 1, 1, 'F#4'), (14, 2, 2, 'D5'),
    (15, 0, 4, 'C#5'),
]


def chords(harmony=H):
    """Yields (bar, beat, length, root, fifth, voicing) for every chord."""
    for bar, entries in enumerate(harmony):
        for i, (beat, root, fifth, voicing) in enumerate(entries):
            end = entries[i + 1][0] if i + 1 < len(entries) else 4
            yield bar, beat, end - beat, n(root), n(fifth), ns(voicing)


def next_root(bar, harmony=H):
    return n(harmony[(bar + 1) % len(harmony)][0][1])


def melody(part, notes=MELODY, octave=0, vel=78, only=None, legato=0.96):
    for bar, beat, length, name in notes:
        if only and bar not in only:
            continue
        # a small dynamic arc per phrase
        arc = 6 * np.sin(np.pi * ((bar % 4) + beat / 4) / 4)
        part.add(bar * 4 + beat, length * legato, n(name) + 12 * octave, vel + arc)
    return part


def bossa_bass(part, harmony=H, vel=86):
    for bar, beat, length, root, fifth, _ in chords(harmony):
        start = bar * 4 + beat
        if length == 4:
            part.add(start, 1.4, root, vel)
            part.add(start + 1.5, 0.45, fifth, vel - 12)
            part.add(start + 2, 1.4, fifth if bar % 2 else root + 12, vel - 6)
            # chromatic approach into the next bar
            target = next_root(bar, harmony)
            approach = target + (1 if (bar % 3) else -1)
            part.add(start + 3.5, 0.45, approach, vel - 10)
        else:
            part.add(start, length * 0.7, root, vel)
            part.add(start + length - 0.5, 0.45, fifth, vel - 12)
    return part


def walking_bass(part, harmony=H, vel=84):
    scale_steps = [0, 2, 3, 5, 7, 9, 10]
    for bar, beat, length, root, fifth, voicing in chords(harmony):
        start = bar * 4 + beat
        target = next_root(bar, harmony) if beat + length >= 4 else root
        beats = int(length)
        line = [root]
        third = voicing[0] if voicing else root + 4
        pool = [fifth, third % 12 + (root // 12) * 12 + 12, root + 12, root + 7]
        for i in range(1, beats - 1):
            line.append(pool[(bar + i) % len(pool)])
        if beats > 1:
            line.append(target + (1 if bar % 2 else -1))
        for i, pitch in enumerate(line):
            while pitch > n('D3'):
                pitch -= 12
            while pitch < n('E1'):
                pitch += 12
            part.add(start + i, 0.92, pitch, vel - (0 if i == 0 else 8))
    return part


def comp(part, harmony=H, vel=58, pattern=((0, 1.4), (2.5, 1.2)), octave=0, roll=0.0):
    for bar, beat, length, _, _, voicing in chords(harmony):
        for hit, dur in pattern:
            if hit < beat or hit >= beat + length:
                continue
            for k, pitch in enumerate(voicing):
                part.add(bar * 4 + hit + k * roll, dur, pitch + 12 * octave, vel - (4 if hit else 0))
    return part


def pads(part, harmony=H, vel=52, octave=0):
    for bar, beat, length, root, _, voicing in chords(harmony):
        part.add(bar * 4 + beat, length, [p + 12 * octave for p in voicing], vel)
    return part


def brushes(part, density=1.0, vel=52):
    # GS brush kit: 38 tap, 39 slap, 40 swirl, 44 pedal hat, 36 kick
    for bar in range(BARS):
        b = bar * 4
        part.add(b, 1.9, 40, vel)  # swirl on 1
        part.add(b + 2, 1.9, 40, vel - 6)  # swirl on 3
        part.add(b + 1, 0.3, 44, vel - 14)
        part.add(b + 3, 0.3, 44, vel - 14)
        if density > 0.5:
            part.add(b + 1, 0.3, 38, vel - 8)
            part.add(b + 3, 0.3, 38, vel - 4)
            part.add(b + 2.5, 0.2, 38, vel - 22)
        if density > 0.8:
            part.add(b, 0.4, 36, vel - 10)
            part.add(b + 2.5, 0.3, 36, vel - 20)
            if bar % 4 == 3:
                part.add(b + 3.5, 0.3, 39, vel - 6)
    return part


def ride_swing(part, vel=60):
    for bar in range(BARS):
        b = bar * 4
        for beat in range(4):
            part.add(b + beat, 0.3, 51, vel - (6 if beat % 2 == 0 else 0))
        part.add(b + 1.5, 0.2, 51, vel - 14)
        part.add(b + 3.5, 0.2, 51, vel - 14)
        part.add(b + 1, 0.2, 44, vel - 10)
        part.add(b + 3, 0.2, 44, vel - 10)
        if bar % 2 == 1:
            part.add(b + 3.5, 0.2, 38, vel - 18)
    return part


def charango(part, harmony=H, vel=58):
    """Mandolin tremolo strums in the charango's high register (upper triad)."""
    for bar, beat, length, _, _, voicing in chords(harmony):
        upper = sorted(p + 12 for p in voicing[-3:])
        start = bar * 4 + beat
        steps = int(length * 4)
        for i in range(steps):
            accent = 10 if i % 4 == 0 else (4 if i % 2 == 0 else -6)
            if i % 8 in (3, 7) and bar % 2 == 0:
                continue  # breath in the strum
            for k, pitch in enumerate(upper if i % 2 == 0 else upper[::-1]):
                part.add(start + i / 4 + k * 0.012, 0.22, pitch, vel + accent)
    return part


def birds(part, seed=11, count=10, vel=40):
    rng = np.random.default_rng(seed)
    for _ in range(count):
        beat = rng.uniform(0, BEATS)
        pitch = int(rng.choice([72, 76, 79, 84]))
        part.add(beat, rng.uniform(0.4, 1.2), pitch, vel + rng.integers(-8, 8))
    return part


# ── Beds ───────────────────────────────────────────────────────────────────
def theme():
    rhodes = comp(Part('rhodes', 4, bank=8, pan=52, gain=0.9, send=0.3, chorus=True), vel=56)
    bass = bossa_bass(Part('bass', 32, pan=64, gain=1.25, send=0.08, lowcut=40))
    guitar = melody(Part('nylon', 24, pan=78, gain=1.0, send=0.32), vel=80)
    kit = brushes(Part('brush', 40, drums=True, pan=70, gain=0.6, send=0.2), density=0.6, vel=48)
    pad = pads(Part('pad', 89, pan=64, gain=0.28, send=0.5, width=1.4), vel=46)
    return [rhodes, bass, guitar, kit, pad]


def tacna():
    rhodes = comp(Part('rhodes', 4, bank=8, pan=50, gain=0.55, send=0.3, chorus=True), vel=50)
    bass = bossa_bass(Part('bass', 32, pan=64, gain=1.15, send=0.08, lowcut=40), vel=80)
    char = charango(Part('charango', 25, bank=16, pan=40, gain=0.42, send=0.28, human=0.004), vel=52)
    quena = melody(Part('quena', 75, pan=84, gain=1.05, send=0.4), vel=84, legato=0.98)
    # bombo legüero: a soft low tom on 1 and the "and" of 2
    bombo = Part('bombo', 0, drums=True, pan=64, gain=0.55, send=0.15)
    for bar in range(BARS):
        bombo.add(bar * 4, 0.5, 41, 70)
        bombo.add(bar * 4 + 1.5, 0.4, 41, 52)
        bombo.add(bar * 4 + 2, 0.4, 43, 58)
    bird = birds(Part('birds', 123, pan=30, gain=0.3, send=0.5), count=8)
    bird2 = birds(Part('birds2', 123, bank=3, pan=100, gain=0.25, send=0.5), seed=5, count=6)
    return [rhodes, bass, char, quena, bombo, bird, bird2]


def sky():
    warm = pads(Part('warm', 89, pan=64, gain=0.55, send=0.6, width=1.5), vel=50)
    halo = pads(Part('halo', 94, pan=64, gain=0.35, send=0.7, width=1.6), vel=44, octave=1)
    arco = Part('arco', 43, pan=64, gain=0.5, send=0.4, lowcut=45)
    for bar, beat, length, root, _, _ in chords():
        arco.add(bar * 4 + beat, length, root + 12, 50)
    celeste = Part('celeste', 8, pan=90, gain=0.55, send=0.7)
    for bar, beat, length, name in MELODY:
        if beat in (0, 1) and length >= 1:
            celeste.add(bar * 4 + beat, 2, n(name) + 12, 60)
    flute = melody(Part('flute', 75, pan=40, gain=0.6, send=0.7), vel=62, only=range(8, 12), legato=1.0)
    return [warm, halo, arco, celeste, flute]


def plans():
    piano = comp(Part('piano', 0, pan=52, gain=0.7, send=0.25),
                 pattern=((0, 0.9), (1.5, 0.4), (2.5, 0.9), (3.5, 0.4)), vel=54)
    bass = walking_bass(Part('bass', 32, pan=64, gain=1.2, send=0.08, lowcut=40))
    vibes = melody(Part('vibes', 11, pan=80, gain=0.9, send=0.35), vel=82)
    guitar = comp(Part('guitar', 24, pan=36, gain=0.45, send=0.2),
                  pattern=((0, 0.45), (1, 0.4), (1.5, 0.4), (2.5, 0.45), (3, 0.4)), vel=50, roll=0.018)
    kit = brushes(Part('brush', 40, drums=True, pan=70, gain=0.75, send=0.18), density=1.0, vel=56)
    return [piano, bass, vibes, guitar, kit]


def cases():
    piano = Part('piano', 0, pan=56, gain=0.85, send=0.4)
    for bar, beat, length, root, _, voicing in chords(HM):
        start = bar * 4 + beat
        piano.add(start, 3.6, voicing, 46)
        if bar % 2:
            piano.add(start + 2.5, 1.4, voicing[-2:], 40)
    melody(piano, MELODY_MINOR, vel=64, legato=0.92)
    arco = Part('arco', 43, pan=64, gain=0.7, send=0.35, lowcut=40)
    for bar, beat, length, root, _, _ in chords(HM):
        arco.add(bar * 4 + beat, length, root + 12, 58)
    # the clock of good years and bad years: pizzicato ticks
    pizz = Part('pizz', 45, pan=88, gain=0.35, send=0.3)
    for bar, beat, length, root, fifth, _ in chords(HM):
        for b in range(4):
            pizz.add(bar * 4 + b, 0.3, (fifth if b % 2 else root) + 24, 52 if b == 0 else 40)
    clarinet = Part('clarinet', 71, pan=34, gain=0.6, send=0.45)
    for bar in (4, 5, 12, 13):
        for b, length, name in [(0.5, 0.5, 'F#4'), (1, 1, 'A4'), (2, 1.5, 'G4'), (3.5, 0.5, 'E4')]:
            clarinet.add(bar * 4 + b, length, n(name) - (0 if bar < 8 else 2), 60)
    pad = pads(Part('pad', 94, pan=64, gain=0.22, send=0.6, width=1.5), HM, vel=40)
    return [piano, arco, pizz, clarinet, pad]


def about():
    """The team's room: medium swing, muted trumpet, brass and walking bass."""
    bass = walking_bass(Part('bass', 32, pan=64, gain=1.25, send=0.08, lowcut=40), vel=90)
    kit = ride_swing(Part('ride', 32, drums=True, pan=74, gain=0.7, send=0.18, swing=1 / 6), vel=64)
    trumpet = melody(Part('trumpet', 59, pan=60, gain=0.95, send=0.3, swing=1 / 6), vel=90)
    horns = Part('horns', 61, pan=44, gain=0.45, send=0.3, swing=1 / 6)
    for bar, beat, length, _, _, voicing in chords():
        if beat == 0 and bar % 2 == 1:
            horns.add(bar * 4 + 3.5, 0.5, [p + 12 for p in voicing], 84)  # push into the next bar
        if bar % 4 == 3:
            horns.add(bar * 4 + 1.5, 0.35, [p + 12 for p in voicing], 88)
    sax = Part('sax', 66, pan=90, gain=0.4, send=0.35)
    for bar, beat, length, _, _, voicing in chords():
        sax.add(bar * 4 + beat, length, voicing[1], 58)
    piano = comp(Part('piano', 0, pan=38, gain=0.6, send=0.22, swing=1 / 6),
                 pattern=((0, 0.6), (1.5, 0.4), (3, 0.5)), vel=58)
    return [bass, kit, trumpet, horns, sax, piano]


def notturno():
    """The reserve bottle: solo piano and bass, late at night."""
    piano = Part('piano', 0, pan=58, gain=1.0, send=0.42)
    for bar, beat, length, root, fifth, voicing in chords():
        start = bar * 4 + beat
        # left hand: rolled shell, right hand fills the space the melody leaves
        piano.add(start, length * 0.95, root + 12, 50)
        for k, pitch in enumerate(voicing[:3]):
            piano.add(start + 0.06 + k * 0.05, length * 0.9, pitch, 44)
    melody(piano, octave=0, vel=66, legato=0.9)
    # an answer an octave up, every other phrase
    for bar, beat, length, name in MELODY:
        if bar in (3, 7, 13) and beat >= 3:
            piano.add(bar * 4 + beat, 1, n(name) + 12, 50)
    bass = Part('bass', 32, pan=64, gain=1.0, send=0.1, lowcut=40)
    for bar, beat, length, root, fifth, _ in chords():
        bass.add(bar * 4 + beat, min(length, 2) * 0.95, root, 74)
        if length == 4:
            bass.add(bar * 4 + 2, 1.9, fifth, 64)
    kit = Part('swirl', 40, drums=True, pan=70, gain=0.35, send=0.2)
    for bar in range(BARS):
        kit.add(bar * 4, 3.8, 40, 40)
    muted = melody(Part('muted', 59, pan=30, gain=0.45, send=0.75), vel=62, only=range(8, 12), octave=-1)
    return [piano, bass, kit, muted]


# ── Footer music box: 3/4, 80 BPM, 16 bars = 36 s, four 9 s chapters ─────
WALTZ = [
    (0, 0, 1, 'A4'), (0, 1, 2, 'F#5'),
    (1, 0, 1.5, 'E5'), (1, 1.5, 0.5, 'D5'), (1, 2, 1, 'C#5'),
    (2, 0, 1, 'B4'), (2, 1, 2, 'E5'),
    (3, 0, 2, 'C#5'), (3, 2, 1, 'A4'),
    (4, 0, 1, 'A4'), (4, 1, 2, 'A5'),
    (5, 0, 1.5, 'G5'), (5, 1.5, 0.5, 'F#5'), (5, 2, 1, 'E5'),
    (6, 0, 1, 'D5'), (6, 1, 1, 'E5'), (6, 2, 1, 'G5'),
    (7, 0, 3, 'E5'),
    (8, 0, 1, 'F#5'), (8, 1, 2, 'D5'),
    (9, 0, 1, 'C#5'), (9, 1, 2, 'A4'),
    (10, 0, 1, 'B4'), (10, 1, 1, 'D5'), (10, 2, 1, 'G5'),
    (11, 0, 3, 'F#5'),
    (12, 0, 1, 'E5'), (12, 1, 1, 'G5'), (12, 2, 1, 'B5'),
    (13, 0, 2, 'A5'), (13, 2, 1, 'G5'),
    (14, 0, 3, 'F#5'),
    (15, 0, 2, 'E5'), (15, 2, 1, 'A4'),
]
WALTZ_H = ['D3 A3 D4 F#4', 'B2 F#3 A3 D4', 'E3 B3 D4 G4', 'A2 E3 G3 C#4',
           'F#2 A3 D4 F#4', 'G2 B3 D4 G4', 'E2 B3 D4 G4', 'A2 E3 G3 C#4',
           'B2 F#3 B3 D4', 'F#2 C#4 E4 A4', 'G2 B3 D4 G4', 'F#2 A3 D4 F#4',
           'E2 B3 D4 G4', 'A2 D4 E4 G4', 'D3 A3 D4 F#4', 'A2 E3 G3 C#4']


def musicbox():
    bars = lambda chapter: range(chapter * 4, chapter * 4 + 4)
    beat_of = lambda bar, beat: bar * 3 + beat

    def tune(part, chapters, octave=0, vel=70):
        for bar, beat, length, name in WALTZ:
            if bar // 4 in chapters:
                part.add(beat_of(bar, beat), length * 1.2, n(name) + 12 * octave, vel)
        return part

    def oompah(part, chapters, vel=50, octave=0):
        for bar, voicing in enumerate(WALTZ_H):
            if bar // 4 not in chapters:
                continue
            notes = ns(voicing)
            part.add(beat_of(bar, 0), 1.0, notes[0] + 12 * octave, vel)
            part.add(beat_of(bar, 1), 0.8, [p + 12 * octave for p in notes[1:]], vel - 10)
            part.add(beat_of(bar, 2), 0.8, [p + 12 * octave for p in notes[1:]], vel - 14)
        return part

    # I · Winter: celeste in the cold, a halo of frost
    celeste = tune(Part('celeste', 8, pan=58, gain=0.8, send=0.55), [0], octave=1, vel=64)
    frost = Part('frost', 94, pan=64, gain=0.3, send=0.7, width=1.6)
    for bar in bars(0):
        frost.add(beat_of(bar, 0), 3, ns(WALTZ_H[bar])[1:], 44)
    # II · Bloom: the music box wakes, glockenspiel petals, a flute bird
    box = tune(Part('box', 10, pan=64, gain=0.9, send=0.45), [1, 2, 3], vel=72)
    oompah(box, [1], vel=46, octave=1)
    glock = Part('glock', 9, pan=90, gain=0.35, send=0.6)
    for bar in bars(1):
        glock.add(beat_of(bar, 2.5), 0.5, ns(WALTZ_H[bar])[-1] + 24, 50)
    flute = Part('flute', 73, pan=30, gain=0.4, send=0.6)
    for bar in (5, 7):
        for i, name in enumerate(['A6', 'F#6', 'A6', 'D7']):
            flute.add(beat_of(bar, 1 + i * 0.25), 0.2, n(name) - 12, 48)
    # III · Thinning: pizzicato plucks the extra fruit
    pizz = oompah(Part('pizz', 45, pan=40, gain=0.6, send=0.35), [2], vel=64)
    # IV · Harvest: warm vibes, marimba and bass at golden hour
    vibes = tune(Part('vibes', 11, pan=76, gain=0.5, send=0.45), [3], octave=-1, vel=64)
    marimba = oompah(Part('marimba', 12, pan=36, gain=0.55, send=0.3), [3], vel=58)
    bass = Part('bass', 32, pan=64, gain=0.9, send=0.1, lowcut=40)
    for bar in bars(3):
        bass.add(beat_of(bar, 0), 2.6, ns(WALTZ_H[bar])[0] - 12, 70)
    return [celeste, frost, box, glock, flute, pizz, vibes, marimba, bass]


# Mix: dB relative to the lead line (perceived loudness, see studio.render).
LEVELS = {
    'theme': {'nylon': 0, 'rhodes': -5, 'bass': -4, 'brush': -11, 'pad': -13},
    'tacna': {'quena': 0, 'charango': -6, 'rhodes': -10, 'bass': -5, 'bombo': -10,
              'birds': -16, 'birds2': -18},
    'sky': {'warm': -2, 'halo': -6, 'arco': -8, 'celeste': 0, 'flute': -3},
    'plans': {'vibes': 0, 'piano': -5, 'bass': -3, 'guitar': -8, 'brush': -8},
    'cases': {'piano': 0, 'arco': -6, 'pizz': -11, 'clarinet': -4, 'pad': -12},
    'about': {'trumpet': 0, 'horns': -4, 'sax': -9, 'piano': -7, 'bass': -3, 'ride': -8},
    'notturno': {'piano': 0, 'bass': -5, 'swirl': -16, 'muted': -6},
    'musicbox': {'celeste': 0, 'frost': -10, 'box': 0, 'glock': -9, 'flute': -8, 'pizz': -4,
                 'vibes': -4, 'marimba': -5, 'bass': -6},
}


def leveled(name, parts):
    for part in parts:
        part.level = LEVELS[name].get(part.name)
    return parts


PIECES = {
    'theme': (theme, lambda L: wind(L, seed=2, level=0.012), -0.5),
    'tacna': (tacna, lambda L: wind(L, seed=4, level=0.05, gusts=3), 0.0),
    'sky': (sky, lambda L: wind(L, seed=6, level=0.08, gusts=2, lo=140, hi=1800), 1.0),
    'plans': (plans, None, -1.0),
    'cases': (cases, lambda L: wind(L, seed=8, level=0.015), 0.0),
    'about': (about, None, -1.5),
    'notturno': (notturno, None, 0.5),
}

if __name__ == '__main__':
    wanted = sys.argv[2:] or [*PIECES, 'musicbox']
    hall = impulse(3.2)
    for name in wanted:
        if name == 'musicbox':
            loop = render(leveled('musicbox', musicbox()), 80, 48, ir=impulse(2.6, damping=0.45), send_db=0.0)
        else:
            build, extra, send_db = PIECES[name]
            loop = render(leveled(name, build()), BPM, BEATS, extra=extra, ir=hall, send_db=send_db)
        report(loop, name)
        save(loop, name, OUT)
