from pathlib import Path
from PIL import Image, ImageDraw

OUT = Path(__file__).resolve().parents[1] / "desktop" / "src-tauri" / "icons"
OUT.mkdir(parents=True, exist_ok=True)

SIZE = 1024
im = Image.new("RGBA", (SIZE, SIZE), (20, 15, 28, 255))
d = ImageDraw.Draw(im)

# Temporary development icon. Replace with final brand artwork later.
m = 64
d.rounded_rectangle((m, m, SIZE - m, SIZE - m), radius=210, fill=(93, 52, 150, 255))

# Geometric "F"
x0, y0 = 270, 260
stem_w = 105
bar_h = 95
d.rounded_rectangle((x0, y0, x0 + stem_w, 760), radius=28, fill="white")
d.rounded_rectangle((x0, y0, 700, y0 + bar_h), radius=28, fill="white")
d.rounded_rectangle((x0, 455, 620, 455 + bar_h), radius=28, fill="white")

# small builder block
d.rounded_rectangle((650, 625, 760, 735), radius=24, fill="white")

im.save(OUT / "icon.png")
im.resize((32, 32), Image.Resampling.LANCZOS).save(OUT / "32x32.png")
im.resize((128, 128), Image.Resampling.LANCZOS).save(OUT / "128x128.png")
im.resize((256, 256), Image.Resampling.LANCZOS).save(OUT / "128x128@2x.png")
im.save(
    OUT / "icon.ico",
    sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)],
)
im.save(OUT / "icon.icns")

print(f"Generated app icons in {OUT}")
