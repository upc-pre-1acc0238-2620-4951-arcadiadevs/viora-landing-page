"""Encode ImageGen's original PNG layers as WebP; retain their native alpha.

This only encodes files. Composition/registration is handled by CSS, so original
generated PNGs remain available for future art direction without destructive edits.
Requires Pillow: python scripts/optimize-hero-assets.py
"""
from pathlib import Path
from PIL import Image

directory = Path(__file__).resolve().parents[1] / 'public/assets/images/hero/generated'
for source in sorted(directory.glob('*.png')):
    image = Image.open(source)
    image.save(source.with_suffix('.webp'), quality=94, method=6, exact=True)
    print(source.name, '->', source.with_suffix('.webp').stat().st_size, 'bytes', image.mode)
