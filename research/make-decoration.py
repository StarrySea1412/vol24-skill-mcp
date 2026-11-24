"""Create a small decorative loop from the article's generated illustration.

The movement is a camera push-in on one still image, not a task-state animation.
Run with the bundled Python: python research/make-decoration.py
"""
from __future__ import annotations

import hashlib
import json
import math
import sys
from datetime import datetime, timezone
from pathlib import Path

from PIL import Image, ImageSequence


PROJECT = Path(__file__).resolve().parents[1]
SOURCE = PROJECT / "assets" / "01-paths.webp"
DESTINATION = PROJECT / "assets" / "loop.gif"
RECORD = PROJECT / "research" / "decoration-generation.json"
FRAME_COUNT = 12
FRAME_DURATION_MS = 150
WIDTH = 384
MAX_ZOOM = 1.025
PALETTE_COLORS = 64


def build() -> dict:
    if not SOURCE.is_file():
        raise FileNotFoundError(f"Source illustration is not ready: {SOURCE}")
    if DESTINATION.exists() and "--replace" not in sys.argv:
        raise FileExistsError(f"Refusing to replace existing decoration: {DESTINATION}")

    with Image.open(SOURCE) as image:
        still = image.convert("RGB")
    height = round(WIDTH * still.height / still.width)
    canvas = (WIDTH, height)
    full_width, full_height = still.size
    palette = still.resize(canvas, Image.Resampling.LANCZOS).quantize(
        colors=PALETTE_COLORS, method=Image.Quantize.MEDIANCUT
    )
    frames = []
    zooms = []
    for index in range(FRAME_COUNT):
        phase = 2 * math.pi * index / FRAME_COUNT
        zoom = 1 + (MAX_ZOOM - 1) * (1 - math.cos(phase)) / 2
        zooms.append(zoom)
        visible_width = full_width / zoom
        visible_height = full_height / zoom
        left = (full_width - visible_width) / 2
        top = (full_height - visible_height) / 2
        extent = (left, top, left + visible_width, top + visible_height)
        frame = still.transform(
            canvas,
            Image.Transform.EXTENT,
            extent,
            resample=Image.Resampling.BICUBIC,
        )
        frames.append(frame.quantize(palette=palette, dither=Image.Dither.NONE))

    frames[0].save(
        DESTINATION,
        save_all=True,
        append_images=frames[1:],
        duration=FRAME_DURATION_MS,
        loop=0,
        disposal=2,
        optimize=False,
    )

    with Image.open(DESTINATION) as gif:
        actual_frames = gif.n_frames
        actual_size = gif.size
        actual_loop = gif.info.get("loop")
        durations = [frame.info.get("duration", 0) for frame in ImageSequence.Iterator(gif)]
        assert gif.format == "GIF"
        assert actual_frames >= 10, f"Too few actual GIF frames: {actual_frames}"
        assert actual_frames == FRAME_COUNT, f"Unexpected frame count: {actual_frames}"
        assert actual_loop == 0
        assert actual_size == canvas
    signature = DESTINATION.read_bytes()[:6].decode("ascii")
    assert signature in {"GIF87a", "GIF89a"}

    result = {
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "source": str(SOURCE),
        "sourceSha256": hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
        "sourceWidth": full_width,
        "sourceHeight": full_height,
        "destination": str(DESTINATION),
        "format": "GIF",
        "signature": signature,
        "actualFrames": actual_frames,
        "width": actual_size[0],
        "height": actual_size[1],
        "frameDurationsMs": durations,
        "loopDurationMs": sum(durations),
        "loop": actual_loop,
        "bytes": DESTINATION.stat().st_size,
        "method": "12-frame cosine push-in on a single GPT-generated still illustration",
        "zoomRange": [min(zooms), max(zooms)],
        "paletteColors": PALETTE_COLORS,
        "description": "Decorative loop only; it does not demonstrate actual task execution or protocol state.",
        "caption": "装饰循环：由本篇 GPT 插画合成的 12 帧轻推镜，不表示真实任务状态。",
        "verification": "Pillow decoded all 12 frames; GIF signature, canvas, infinite loop and durations verified.",
    }
    RECORD.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(result, ensure_ascii=False))
    return result


if __name__ == "__main__":
    build()
