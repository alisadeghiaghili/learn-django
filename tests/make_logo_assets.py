"""Extract and emit Django logo assets for the LearnDjango UI."""

from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "assets"


def paths_and_fills(svg: str) -> tuple[list[str], list[str]]:
    d = re.findall(r'<path[^>]*?\sd="([^"]+)"', svg, flags=re.S)
    fills = re.findall(r'<path[^>]*?\sfill="([^"]+)"', svg, flags=re.S)
    return d, fills


def main() -> None:
    pos = (ASSETS / "django-logo.svg").read_text(encoding="utf-8")
    neg = (ASSETS / "django-logo-negative.svg").read_text(encoding="utf-8")
    pos_d, pos_fills = paths_and_fills(pos)
    neg_d, neg_fills = paths_and_fills(neg)
    print("positive", len(pos_d), pos_fills[:8])
    print("negative", len(neg_d), neg_fills[:8])

    # White wordmark on transparent (for dark chrome)
    word_paths = "\n".join(
        f'  <path fill="#E6EFEA" d="{d}"/>' for d in pos_d
    )
    light = f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 436.505 152.503" width="436.505" height="152.503" role="img" aria-label="Django">
{word_paths}
</svg>
"""
    (ASSETS / "django-logo-light.svg").write_text(light, encoding="utf-8")

    # Compact brand badge: deep green pill + white wordmark (official negative lockup, cleaned)
    # Use negative SVG paths: first path is the rounded rect, rest are white letterforms.
    badge_parts = []
    for d, fill in zip(neg_d, neg_fills):
        color = "#0C4B33" if fill.upper() in {"#092E20", "#092E20"} else "#FFFFFF"
        if fill.upper() == "#092E20":
            color = "#0C4B33"
        elif fill.upper() == "#FFFFFF":
            color = "#FFFFFF"
        else:
            color = fill
        badge_parts.append(f'  <path fill="{color}" d="{d}"/>')
    # negative viewBox is 504.09 x 215.994
    badge = f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 504.09 215.994" role="img" aria-label="Django">
{chr(10).join(badge_parts)}
</svg>
"""
    (ASSETS / "django-badge.svg").write_text(badge, encoding="utf-8")

    # Favicon: green rounded square + white D (first letterform of the logotype)
    # Positive logo letterforms start near origin; scale D into 64x64.
    # The first path of the positive logo is the "D" glyph in local coords ~0..75 x 0..114.
    d_glyph = pos_d[0]
    favicon = f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="Django">
  <rect width="64" height="64" rx="14" fill="#0C4B33"/>
  <g transform="translate(8 10) scale(0.38)">
    <path fill="#E6EFEA" d="{d_glyph}"/>
  </g>
</svg>
"""
    (ASSETS / "favicon.svg").write_text(favicon, encoding="utf-8")

    # Also emit a small PNG favicon for older browsers via Pillow
    try:
        from PIL import Image, ImageDraw

        img = Image.new("RGBA", (64, 64), (0, 0, 0, 0))
        draw = ImageDraw.Draw(img)
        draw.rounded_rectangle((0, 0, 63, 63), radius=14, fill=(12, 75, 51, 255))
        # Approximate a bold D with shapes if glyph render is heavy — use simple D
        draw.rectangle((22, 16, 32, 48), fill=(230, 239, 234, 255))
        draw.pieslice((22, 16, 50, 48), start=-90, end=90, fill=(230, 239, 234, 255))
        draw.ellipse((30, 24, 42, 40), fill=(12, 75, 51, 255))
        img.save(ASSETS / "favicon.png")
        print("wrote favicon.png")
    except Exception as exc:  # pragma: no cover
        print("png favicon skipped:", exc)

    print("wrote light + badge + favicon")


if __name__ == "__main__":
    main()
