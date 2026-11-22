"""Generate three original tangent-space normal maps using only the Python stdlib."""
import math
import struct
import zlib
from pathlib import Path

SIZE = 64
TYPES = ("woven", "smooth", "grain")
OUT = Path(__file__).resolve().parents[1] / "src/footwear/textures"


def sample(kind, x, y):
    u = (x + 0.5) / SIZE
    v = (y + 0.5) / SIZE
    if kind == "woven":
        dx = 0.24 * math.cos(u * math.tau * 8) + 0.07 * math.cos(v * math.tau * 12)
        dy = 0.24 * math.cos(v * math.tau * 8) - 0.07 * math.cos(u * math.tau * 12)
    elif kind == "grain":
        dx = 0.15 * math.sin(u * math.tau * 11 + v * math.tau * 7)
        dy = 0.15 * math.sin(v * math.tau * 13 - u * math.tau * 5)
    else:
        dx = 0.015 * math.sin(u * math.tau * 4)
        dy = 0.015 * math.sin(v * math.tau * 4)
    norm = (dx * dx + dy * dy + 1.0) ** 0.5
    vec = (dx / norm, dy / norm, 1 / norm)
    return bytes(max(0, min(255, round(127.5 * (component + 1)))) for component in vec)


def chunk(tag, data):
    body = tag + data
    return struct.pack(">I", len(data)) + body + struct.pack(">I", zlib.crc32(body) & 0xFFFFFFFF)


def generate(kind):
    pixels = b"".join(b"\0" + b"".join(sample(kind, x, y) for x in range(SIZE)) for y in range(SIZE))
    ihdr = struct.pack(">IIBBBBB", SIZE, SIZE, 8, 2, 0, 0, 0)
    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr) + chunk(b"IDAT", zlib.compress(pixels, 9)) + chunk(b"IEND", b"")


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for kind in TYPES:
        (OUT / f"{kind}_normal.png").write_bytes(generate(kind))


if __name__ == "__main__":
    main()
