#!/usr/bin/env python3
"""Generate platform app icons and the web logo from the branding sources.

Run from apps/desktop:  python3 scripts/generate-icons.py

Inputs (checked in):
  assets/branding/Speciconlogo.jpeg  2048x2048 icon art on a fake
                                     "transparency" checkerboard (JPEG has no
                                     alpha, so the checkers are real pixels)
  assets/branding/SpecLogo.jpeg      wide logo on a dark background

Outputs (checked in; CI never needs to run this):
  apps/desktop/build/icon.icns       macOS (via iconutil, so macOS-only to run)
  apps/desktop/build/icon.ico        Windows
  apps/desktop/build/icons/NxN.png   Linux set
  assets/branding/icon-1024.png      the master tile the above derive from
  assets/branding/spec-logo-web.png  logo resized for the renderer

The checkerboard is keyed out (its two flat grays, detected from the
corners), the mask is de-speckled, and the subject is composited onto a
rounded dark tile that matches the logo background, which is what a modern
macOS Dock icon expects.
"""

import os
import subprocess
import sys
import tempfile

from PIL import Image, ImageDraw, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, "..", "..", ".."))
BRANDING = os.path.join(ROOT, "assets", "branding")
BUILD = os.path.normpath(os.path.join(HERE, "..", "build"))

ICON_SRC = os.path.join(BRANDING, "Speciconlogo.jpeg")
LOGO_SRC = os.path.join(BRANDING, "SpecLogo.jpeg")
TILE_BG = (11, 13, 18)  # sampled from the logo's dark background
TOLERANCE = 16  # max channel distance to count a pixel as checkerboard


def detect_checker_grid(img):
    """Work out the checkerboard's two grays, square size, and phase from the
    top edge (the art never reaches it)."""
    px = img.load()
    row = [px[x, 2][:3] for x in range(img.width)]
    lum = [sum(c) // 3 for c in row]
    # Square borders are where luminance steps between the two grays
    switches = [
        x for x in range(1, img.width) if abs(lum[x] - lum[x - 1]) > 6
    ]
    runs = [b - a for a, b in zip(switches, switches[1:]) if b - a > 4]
    period = sorted(runs)[len(runs) // 2]
    phase = switches[0] % period
    # The two grays, averaged away from the blurry square borders
    a_samples, b_samples = [], []
    for x in range(img.width):
        cell = (x - phase) // period
        if abs(((x - phase) % period) - period / 2) > period / 4:
            continue  # skip border-adjacent pixels
        (a_samples if cell % 2 == 0 else b_samples).append(row[x])
    avg = lambda s: tuple(sum(ch) // len(s) for ch in zip(*s))
    return avg(a_samples), avg(b_samples), period, phase


def key_out_checkerboard(img):
    """Un-composite the art from the fake-transparency checkerboard.

    The checkerboard is periodic, so the background under every pixel is
    known exactly. A pixel that matches it is transparent; one notably
    brighter (or colored) is the opaque subject; one darker is the art's
    soft shadow blended onto the checker, recovered as semi-transparent
    black with alpha = 1 - actual/background.
    """
    color_a, color_b, period, phase = detect_checker_grid(img)
    print(f"checker grays {color_a} / {color_b}, square {period}px, phase {phase}px")
    px = img.load()
    out = Image.new("RGBA", img.size)
    opx = out.load()

    for y in range(img.height):
        cy = (y - phase) // period
        for x in range(img.width):
            cx = (x - phase) // period
            bg = color_a if (cx + cy) % 2 == 0 else color_b
            c = px[x, y][:3]
            diff = max(abs(c[i] - bg[i]) for i in range(3))
            lum_c = (c[0] + c[1] + c[2]) / 3
            lum_bg = (bg[0] + bg[1] + bg[2]) / 3
            chroma = max(c) - min(c)
            if diff <= TOLERANCE:
                opx[x, y] = (0, 0, 0, 0)
            elif lum_c > lum_bg + 10 or chroma > 16:
                opx[x, y] = (c[0], c[1], c[2], 255)
            else:
                alpha = int(max(0.0, min(1.0, 1.0 - lum_c / lum_bg)) * 255)
                opx[x, y] = (0, 0, 0, alpha)

    # Feather the hard cut edge slightly so it scales cleanly
    r, g, b, a = out.split()
    a = a.filter(ImageFilter.GaussianBlur(0.8))
    out = Image.merge("RGBA", (r, g, b, a))
    return out


def rounded_tile(size, content_ratio=0.805, radius_ratio=0.225):
    """A macOS-style rounded tile centered on a transparent canvas."""
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    tile = int(size * content_ratio)
    offset = (size - tile) // 2
    radius = int(tile * radius_ratio)
    draw = ImageDraw.Draw(canvas)
    draw.rounded_rectangle(
        [offset, offset, offset + tile, offset + tile],
        radius=radius,
        fill=TILE_BG + (255,),
    )
    return canvas, tile, offset


def build_master():
    src = Image.open(ICON_SRC)
    subject = key_out_checkerboard(src)
    bbox = subject.getbbox()
    subject = subject.crop(bbox)

    master, tile, offset = rounded_tile(1024)
    target = int(tile * 0.84)
    scale = min(target / subject.width, target / subject.height)
    subject = subject.resize(
        (int(subject.width * scale), int(subject.height * scale)), Image.LANCZOS
    )
    x = offset + (tile - subject.width) // 2
    y = offset + (tile - subject.height) // 2
    master.alpha_composite(subject, (x, y))
    master.save(os.path.join(BRANDING, "icon-1024.png"))
    return master


def write_icns(master):
    sizes = [16, 32, 128, 256, 512]
    with tempfile.TemporaryDirectory() as tmp:
        iconset = os.path.join(tmp, "icon.iconset")
        os.mkdir(iconset)
        for s in sizes:
            master.resize((s, s), Image.LANCZOS).save(
                os.path.join(iconset, f"icon_{s}x{s}.png")
            )
            master.resize((s * 2, s * 2), Image.LANCZOS).save(
                os.path.join(iconset, f"icon_{s}x{s}@2x.png")
            )
        subprocess.run(
            ["iconutil", "-c", "icns", iconset, "-o", os.path.join(BUILD, "icon.icns")],
            check=True,
        )


def write_ico(master):
    master.save(
        os.path.join(BUILD, "icon.ico"),
        sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)],
    )


def write_linux_set(master):
    icons = os.path.join(BUILD, "icons")
    os.makedirs(icons, exist_ok=True)
    for s in [16, 24, 32, 48, 64, 96, 128, 256, 512]:
        master.resize((s, s), Image.LANCZOS).save(os.path.join(icons, f"{s}x{s}.png"))
    master.save(os.path.join(icons, "1024x1024.png"))


def write_web_logo():
    logo = Image.open(LOGO_SRC)
    scale = 1200 / logo.width
    logo = logo.resize((1200, int(logo.height * scale)), Image.LANCZOS)
    logo.save(os.path.join(BRANDING, "spec-logo-web.png"))


def main():
    os.makedirs(BUILD, exist_ok=True)
    master = build_master()
    write_icns(master)
    write_ico(master)
    write_linux_set(master)
    write_web_logo()
    print("done")


if __name__ == "__main__":
    sys.exit(main())
