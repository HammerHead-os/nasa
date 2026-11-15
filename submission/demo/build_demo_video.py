#!/usr/bin/env python3
"""Build ICEBOUND 30-second NASA Space Apps demo with burned-in English subtitles."""

from __future__ import annotations

import math
import subprocess
from pathlib import Path

from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parents[2]
WEB = ROOT / "apps" / "web" / "public"
OUT = Path(__file__).resolve().parent
FRAMES = OUT / "frames"
W, H = 1920, 1080
FPS = 30
DURATION = 29.5  # under the hard 30s limit
N_FRAMES = int(DURATION * FPS)

# NASA Horizon-ish palette
BG = (12, 14, 16)
INK = (234, 230, 223)
MUTED = (154, 150, 142)
RUST = (227, 25, 55)
ICE = (143, 184, 194)


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    candidates = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/truetype/noto/NotoSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf",
    ]
    for path in candidates:
        if Path(path).exists():
            return ImageFont.truetype(path, size)
    return ImageFont.load_default()


def load_site(path: Path) -> Image.Image:
    img = Image.open(path).convert("RGB")
    # Fit cover into stage area
    stage = (1280, 820)
    scale = max(stage[0] / img.width, stage[1] / img.height)
    nw, nh = int(img.width * scale), int(img.height * scale)
    img = img.resize((nw, nh), Image.Resampling.LANCZOS)
    x0 = (nw - stage[0]) // 2
    y0 = (nh - stage[1]) // 2
    return img.crop((x0, y0, x0 + stage[0], y0 + stage[1]))


def wipe(early: Image.Image, late: Image.Image, pct: float) -> Image.Image:
    """pct = percent of frame showing EARLY (left)."""
    pct = max(0.0, min(100.0, pct))
    cut = int(early.width * pct / 100.0)
    out = late.copy()
    if cut > 0:
        out.paste(early.crop((0, 0, cut, early.height)), (0, 0))
    # wipe line
    draw = ImageDraw.Draw(out)
    x = max(0, min(early.width - 3, cut - 1))
    draw.rectangle([x, 0, x + 3, early.height], fill=RUST)
    return out


def card_bg() -> Image.Image:
    img = Image.new("RGB", (W, H), BG)
    # subtle vignette
    overlay = Image.new("RGB", (W, H), (0, 0, 0))
    mask = Image.new("L", (W, H), 0)
    md = ImageDraw.Draw(mask)
    for i in range(40):
        a = int(180 * (i / 40) ** 2)
        md.rectangle([i * 8, i * 5, W - i * 8, H - i * 5], outline=a)
    img = Image.composite(overlay, img, mask.filter(ImageFilter.GaussianBlur(24)))
    return img


def draw_text_shadow(draw: ImageDraw.ImageDraw, xy, text, fnt, fill=INK):
    x, y = xy
    draw.text((x + 2, y + 2), text, font=fnt, fill=(0, 0, 0))
    draw.text((x, y), text, font=fnt, fill=fill)


def place_stage(frame: Image.Image, stage: Image.Image, left: int = 520, top: int = 130) -> None:
    # panel chrome
    draw = ImageDraw.Draw(frame)
    draw.rectangle([left - 8, top - 8, left + stage.width + 8, top + stage.height + 8], outline=(50, 52, 54), width=1)
    frame.paste(stage, (left, top))


def subtitle_for(t: float) -> str:
    # English subtitles (required if VO; burned in for silent playback too)
    beats = [
        (0.0, 2.2, "ICEBOUND  ·  Gitanjali Penumatsa (NUS) & Aniket Mimani (NTU)"),
        (2.2, 5.0, "NASA Space Apps 2026 — Dancing with the SARs"),
        (5.0, 9.5, "ICEBOUND — real NISAR browse, same track, two dates."),
        (9.5, 15.5, "Five footprints: freeze/thaw, wetland, fields, delta, glacier."),
        (15.5, 22.0, "Drag the wipe. Patches are detected from the preview — a browse index, not γ⁰."),
        (22.0, 26.5, "Export a change card: coordinates + granule IDs."),
        (26.5, 29.5, "ICEBOUND. NISAR surface change — claim kept the size of the data."),
    ]
    for a, b, line in beats:
        if a <= t < b:
            return line
    return ""


def draw_chrome(frame: Image.Image, t: float, site_name: str, region: str, process: str, early_lbl: str, late_lbl: str) -> None:
    draw = ImageDraw.Draw(frame)
    # left rail
    draw.rectangle([0, 0, 500, H], fill=(16, 18, 20))
    draw.line([(500, 0), (500, H)], fill=(40, 42, 44), width=1)

    draw_text_shadow(draw, (36, 40), "NISAR SURFACE CHANGE", font(18, True), RUST)
    draw_text_shadow(draw, (36, 78), "ICEBOUND", font(54, True), INK)
    draw.text((36, 148), "Five footprints.\nOne instrument.\nWatch the surface\nmove.", font=font(28), fill=MUTED, spacing=8)

    sites = [
        ("01", "Eight Mile Lake", "Freeze / thaw"),
        ("02", "Manchac", "Wetland"),
        ("03", "San Joaquin", "Farmland"),
        ("04", "Mekong Delta", "Floodplain"),
        ("05", "Hubbard Glacier", "Glacier"),
    ]
    y = 320
    for idx, name, proc in sites:
        on = name.split()[0].lower() in site_name.lower() or site_name.startswith(name.split()[0])
        if name == "Eight Mile Lake" and "Eight" in site_name:
            on = True
        if name == "Manchac" and "Manchac" in site_name:
            on = True
        if name == "San Joaquin" and "San" in site_name:
            on = True
        if name == "Mekong Delta" and "Mekong" in site_name:
            on = True
        if name == "Hubbard Glacier" and "Hubbard" in site_name:
            on = True
        bg = (227, 25, 55) if on else (28, 30, 32)
        draw.rectangle([36, y, 464, y + 58], fill=bg)
        draw.text((48, y + 10), idx, font=font(16, True), fill=(255, 255, 255) if on else RUST)
        draw.text((88, y + 8), name, font=font(20, True), fill=(255, 255, 255) if on else INK)
        draw.text((88, y + 32), proc, font=font(14), fill=(255, 220, 220) if on else MUTED)
        y += 68

    # honesty
    draw.text((36, H - 90), "Browse luminance index 0–100", font=font(16, True), fill=ICE)
    draw.text((36, H - 64), "Not calibrated γ⁰  ·  Not freeze-lag days", font=font(15), fill=MUTED)

    # top bar over stage
    draw.rectangle([520, 40, W - 40, 100], fill=(18, 20, 22))
    draw.text((540, 58), f"{early_lbl}  →  {late_lbl}", font=font(22, True), fill=INK)
    draw.text((1100, 58), f"{site_name}  ·  {region}  ·  {process}", font=font(18), fill=MUTED)

    # subtitle bar
    line = subtitle_for(t)
    if line:
        bar_h = 78
        draw.rectangle([0, H - bar_h, W, H], fill=(0, 0, 0))
        # measure
        fnt = font(28, True)
        bbox = draw.textbbox((0, 0), line, font=fnt)
        tw = bbox[2] - bbox[0]
        draw.text(((W - tw) / 2, H - 54), line, font=fnt, fill=(255, 255, 255))


def ease(u: float) -> float:
    u = max(0.0, min(1.0, u))
    return 0.5 - 0.5 * math.cos(math.pi * u)


def main() -> None:
    FRAMES.mkdir(parents=True, exist_ok=True)
    for old in FRAMES.glob("*.jpg"):
        old.unlink()

    pairs = [
        # name, region, process, early, late, early_lbl, late_lbl, t0, t1
        (
            "Eight Mile Lake",
            "Alaska, USA",
            "Freeze / thaw",
            WEB / "nisar/eml_2026-09-02_rgb.png",
            WEB / "nisar/eml_2026-11-01_rgb.png",
            "2 Sep 2026",
            "1 Nov 2026",
            4.8,
            11.0,
        ),
        (
            "Manchac",
            "Louisiana, USA",
            "Wetland",
            WEB / "nisar/world/manchac_2026-08-12.png",
            WEB / "nisar/world/manchac_2026-10-23.png",
            "12 Aug 2026",
            "23 Oct 2026",
            11.0,
            16.2,
        ),
        (
            "Mekong Delta",
            "Vietnam",
            "Floodplain",
            WEB / "nisar/world/mekong-delta_2026-08-11.png",
            WEB / "nisar/world/mekong-delta_2026-10-22.png",
            "11 Aug 2026",
            "22 Oct 2026",
            16.2,
            22.0,
        ),
        (
            "Hubbard Glacier",
            "Alaska, USA",
            "Glacier",
            WEB / "nisar/world/hubbard_2026-08-13.png",
            WEB / "nisar/world/hubbard_2026-10-24.png",
            "13 Aug 2026",
            "24 Oct 2026",
            22.0,
            27.2,
        ),
    ]

    loaded = []
    for p in pairs:
        loaded.append((p[0], p[1], p[2], load_site(p[3]), load_site(p[4]), p[5], p[6], p[7], p[8]))

    title_early = loaded[0][3]
    title_late = loaded[0][4]

    print(f"Rendering {N_FRAMES} frames…")
    for i in range(N_FRAMES):
        t = i / FPS
        frame = card_bg()

        if t < 4.8:
            # Opening: team + challenge over soft wipe
            pct = 15 + 70 * ease(t / 4.8)
            stage = wipe(title_early, title_late, pct)
            stage = Image.blend(stage, Image.new("RGB", stage.size, (0, 0, 0)), 0.42)
            place_stage(frame, stage)
            draw_chrome(
                frame,
                t,
                "Eight Mile Lake",
                "Alaska, USA",
                "Freeze / thaw",
                "2 Sep 2026",
                "1 Nov 2026",
            )
            draw = ImageDraw.Draw(frame)
            if t < 2.2:
                draw_text_shadow(draw, (620, 400), "ICEBOUND", font(86, True), INK)
                draw.text((620, 510), "Gitanjali Penumatsa (NUS)  ·  Aniket Mimani (NTU)", font=font(28), fill=MUTED)
            else:
                draw_text_shadow(draw, (620, 390), "Dancing with the SARs", font(52, True), INK)
                draw.text((620, 470), "NASA / ISRO NISAR L-band  ·  Space Apps 2026", font=font(26), fill=ICE)
        elif t < 27.2:
            # Active site wipe sections
            site = loaded[0]
            for cand in loaded:
                if cand[7] <= t < cand[8]:
                    site = cand
                    break
            name, region, process, early, late, el, ll, t0, t1 = site
            local = (t - t0) / max(0.01, t1 - t0)
            # ping-pong wipe
            cycle = (local * 2.2) % 2.0
            if cycle <= 1.0:
                pct = 8 + 84 * ease(cycle)
            else:
                pct = 92 - 84 * ease(cycle - 1.0)
            stage = wipe(early, late, pct)

            # fake patch boxes near end of each site beat
            if local > 0.55:
                d = ImageDraw.Draw(stage)
                boxes = [(0.58, 0.32, 0.14, 0.12), (0.28, 0.55, 0.11, 0.1), (0.70, 0.60, 0.12, 0.09)]
                for bi, (rx, ry, rw, rh) in enumerate(boxes):
                    x0 = int(rx * stage.width)
                    y0 = int(ry * stage.height)
                    x1 = int((rx + rw) * stage.width)
                    y1 = int((ry + rh) * stage.height)
                    color = ICE if bi % 2 else RUST
                    d.rectangle([x0, y0, x1, y1], outline=color, width=3)
                    d.rectangle([x0, y0, x0 + 28, y0 + 22], fill=color)
                    d.text((x0 + 6, y0 + 2), str(bi + 1), font=font(14, True), fill=(12, 14, 16))

            place_stage(frame, stage)
            draw_chrome(frame, t, name, region, process, el, ll)

            # Export callout near end of Hubbard beat
            if t >= 24.5:
                d = ImageDraw.Draw(frame)
                d.rectangle([1180, 780, 1860, 930], fill=(20, 22, 24), outline=RUST, width=2)
                d.text((1200, 800), "EXPORT  ·  ICEBOUND_change.geojson", font=font(22, True), fill=RUST)
                d.text((1200, 840), "coordinates · browse Δ · granule URs", font=font(20), fill=INK)
                d.text((1200, 880), "Primary product: change card  (not a drill certificate)", font=font(16), fill=MUTED)
        else:
            # Closing lockup
            pct = 50 + 10 * math.sin((t - 27.2) * 3)
            stage = wipe(title_early, title_late, pct)
            stage = Image.blend(stage, Image.new("RGB", stage.size, (0, 0, 0)), 0.5)
            place_stage(frame, stage)
            draw = ImageDraw.Draw(frame)
            draw_chrome(frame, t, "Eight Mile Lake", "Alaska, USA", "Freeze / thaw", "2 Sep 2026", "1 Nov 2026")
            draw_text_shadow(draw, (620, 420), "ICEBOUND", font(92, True), INK)
            draw.text((620, 530), "NISAR surface change you can export.", font=font(32), fill=ICE)

        frame.save(FRAMES / f"f_{i:04d}.jpg", quality=90, optimize=True)
        if i % 30 == 0:
            print(f"  {i}/{N_FRAMES} ({t:.1f}s)")

    mp4 = OUT / "ICEBOUND_30s_demo.mp4"
    # Also write SRT alongside for platforms that prefer softsubs
    srt = OUT / "ICEBOUND_30s_demo.en.srt"
    beats = [
        (0.0, 2.2, "ICEBOUND  ·  Gitanjali Penumatsa (NUS) & Aniket Mimani (NTU)"),
        (2.2, 5.0, "NASA Space Apps 2026 — Dancing with the SARs"),
        (5.0, 9.5, "ICEBOUND — real NISAR browse, same track, two dates."),
        (9.5, 15.5, "Five footprints: freeze/thaw, wetland, fields, delta, glacier."),
        (15.5, 22.0, "Drag the wipe. Patches are detected from the preview — a browse index, not γ⁰."),
        (22.0, 26.5, "Export a change card: coordinates + granule IDs."),
        (26.5, 29.5, "ICEBOUND. NISAR surface change — claim kept the size of the data."),
    ]

    def ts(x: float) -> str:
        h = int(x // 3600)
        m = int((x % 3600) // 60)
        s = int(x % 60)
        ms = int(round((x - int(x)) * 1000))
        return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"

    with srt.open("w", encoding="utf-8") as f:
        for i, (a, b, line) in enumerate(beats, 1):
            f.write(f"{i}\n{ts(a)} --> {ts(b)}\n{line}\n\n")

    cmd = [
        "ffmpeg",
        "-y",
        "-framerate",
        str(FPS),
        "-i",
        str(FRAMES / "f_%04d.jpg"),
        "-c:v",
        "libx264",
        "-pix_fmt",
        "yuv420p",
        "-crf",
        "18",
        "-movflags",
        "+faststart",
        "-t",
        str(DURATION),
        str(mp4),
    ]
    print("Encoding", mp4)
    subprocess.check_call(cmd)
    print("Wrote", mp4)
    print("Wrote", srt)
    print("Duration target", DURATION, "s — under 30s limit")


if __name__ == "__main__":
    main()
