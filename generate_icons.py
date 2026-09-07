#!/usr/bin/env python3
"""Generates simple PNG icons for the YouTube→Gemini extension."""
import struct, zlib, os

def make_png(width, height, pixels_fn):
    """pixels_fn(x, y) -> (r, g, b, a)"""
    def chunk(t, d):
        c = t + d
        return struct.pack('>I', len(d)) + c + struct.pack('>I', zlib.crc32(c) & 0xffffffff)

    sig  = b'\x89PNG\r\n\x1a\n'
    ihdr = chunk(b'IHDR', struct.pack('>IIBBBBB', width, height, 8, 6, 0, 0, 0))  # RGBA

    raw = b''
    for y in range(height):
        raw += b'\x00'  # filter: None
        for x in range(width):
            r, g, b, a = pixels_fn(x, y, width, height)
            raw += bytes([r, g, b, a])

    idat = chunk(b'IDAT', zlib.compress(raw, 9))
    iend = chunk(b'IEND', b'')
    return sig + ihdr + idat + iend


def draw_icon(x, y, w, h):
    cx, cy = w / 2, h / 2
    r_outer = w * 0.48
    r_inner = w * 0.35

    dx, dy = x - cx, y - cy
    dist = (dx**2 + dy**2) ** 0.5

    # Background: YouTube red circle
    if dist <= r_outer:
        # Anti-alias edge
        aa = max(0.0, min(1.0, r_outer - dist))
        base_a = int(255 * min(aa, 1.0))

        # Play triangle inside the circle
        # Triangle centered, pointing right
        tri_x = x - cx
        tri_y = y - cy
        size = w * 0.25
        # Simple triangle test: right-pointing
        in_tri = (tri_x > -size * 0.6 and
                  abs(tri_y) < (tri_x + size * 0.6) * 0.75 and
                  tri_x < size * 0.9)

        if in_tri and dist < r_inner:
            return (255, 255, 255, base_a)  # white play button
        else:
            return (204, 0, 0, base_a)      # YouTube red

    return (0, 0, 0, 0)  # transparent


os.makedirs('icons', exist_ok=True)
for size in [16, 32, 48, 128]:
    data = make_png(size, size, draw_icon)
    path = f'icons/icon{size}.png'
    with open(path, 'wb') as f:
        f.write(data)
    print(f'  Created {path}  ({len(data)} bytes)')
