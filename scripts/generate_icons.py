
import argparse
import os
from PIL import Image, ImageChops, ImageFilter

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DEFAULT_RESOURCES_DIR = os.path.abspath(os.path.join(SCRIPT_DIR, "..", "resources"))
LEGACY_SOURCE_IMAGE_PATH = r"C:/Users/Administrator/.gemini/antigravity/brain/d9fce87b-7355-4ee5-a487-4f6c2c186145/ag_simple_capsule_1767751839629.png"

def remove_white_background(img, threshold=240):
    """
    将白色/近白色背景转换为透明。
    threshold: RGB 值高于此阈值的像素被视为"白色"并设为透明。
    """
    img = img.convert('RGBA')
    data = img.getdata()
    
    new_data = []
    for item in data:
        # 如果 R, G, B 都接近白色（高于阈值），则设为透明
        if item[0] > threshold and item[1] > threshold and item[2] > threshold:
            new_data.append((255, 255, 255, 0))  # 完全透明
        else:
            new_data.append(item)
    
    img.putdata(new_data)
    return img

def crop_to_alpha_bbox(img: Image.Image, alpha_threshold: int = 0) -> Image.Image:
    img = img.convert("RGBA")
    alpha = img.split()[-1]
    if alpha_threshold > 0:
        alpha = alpha.point(lambda p: 255 if p > alpha_threshold else 0)
    bbox = alpha.getbbox()
    return img.crop(bbox) if bbox else img

def render_tray_icon(img: Image.Image, size: int, stroke_px: int, stroke_opacity: float = 0.85) -> Image.Image:
    base = crop_to_alpha_bbox(img)
    w, h = base.size
    scale = min(size / w, size / h)
    nw = max(1, int(round(w * scale)))
    nh = max(1, int(round(h * scale)))
    base = base.resize((nw, nh), Image.Resampling.LANCZOS)

    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    canvas.paste(base, ((size - nw) // 2, (size - nh) // 2), base)

    alpha = canvas.split()[-1]
    kernel = stroke_px * 2 + 1
    dilated = alpha.filter(ImageFilter.MaxFilter(kernel))
    border = ImageChops.subtract(dilated, alpha)
    if stroke_opacity < 1:
        border = border.point(lambda p: int(p * stroke_opacity))

    stroke = Image.new("RGBA", (size, size), (0, 0, 0, 255))
    stroke.putalpha(border)
    return Image.alpha_composite(stroke, canvas)

def resolve_source_image_path(cli_source: str | None, resources_dir: str) -> str | None:
    candidates = [
        cli_source,
        os.environ.get("AG_QUOTA_SOURCE_IMAGE"),
        LEGACY_SOURCE_IMAGE_PATH,
        os.path.join(resources_dir, "icon.png"),
    ]
    for candidate in candidates:
        if candidate and os.path.exists(candidate):
            return candidate
    return None

def generate_icons(source_image_path: str, resources_dir: str, only_tray: bool) -> None:
    if not os.path.exists(resources_dir):
        os.makedirs(resources_dir)
        print(f"Created directory: {resources_dir}")

    try:
        img = Image.open(source_image_path)
        print(f"Loaded image: {img.size} {img.format} {img.mode}")

        # Ensure RGBA
        if img.mode != 'RGBA':
            img = img.convert('RGBA')
        
        # 移除白色背景（使其透明）
        img = remove_white_background(img)
        print("Removed white background (converted to transparent)")

        if not only_tray:
            # 1. Generate icon.ico for Windows
            # Sizes recommended for Windows
            icon_sizes = [(256, 256), (128, 128), (64, 64), (48, 48), (32, 32), (16, 16)]
            ico_path = os.path.join(resources_dir, "icon.ico")
            img.save(ico_path, format='ICO', sizes=icon_sizes)
            print(f"Generated: {ico_path}")

            # 2. Generate icon.png (High Res)
            png_path = os.path.join(resources_dir, "icon.png")
            img.resize((512, 512), Image.Resampling.LANCZOS).save(png_path, format='PNG')
            print(f"Generated: {png_path}")

        # 3. Generate tray icons (Small PNGs)
        # Usually tray icons are 16x16 or 32x32 (for high DPI)
        tray_16 = os.path.join(resources_dir, "tray-16x16.png")
        render_tray_icon(img, 16, stroke_px=1).save(tray_16, format='PNG')
        
        tray_32 = os.path.join(resources_dir, "tray-32x32.png")
        render_tray_icon(img, 32, stroke_px=2).save(tray_32, format='PNG')
        print(f"Generated tray icons: {tray_16}, {tray_32}")
        
        if not only_tray:
            # 4. Attempt to generate icon.icns (Mac) - Optional/Partial
            # Since we are on Windows, we'll try to save as ICNS if Pillow supports it,
            # otherwise we might just leave it or creating a PNG named .icns is bad practice.
            # Let's check if we can save as ICNS.
            icns_path = os.path.join(resources_dir, "icon.icns")
            try:
                img.save(icns_path, format='ICNS', sizes=[(512,512), (256,256), (128,128), (32,32), (16,16)])
                print(f"Generated: {icns_path}")
            except Exception as e:
                print(f"Could not generate ICNS (expected on Windows without heavy libs): {e}")

    except Exception as e:
        print(f"An error occurred: {e}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", help="Source image path (PNG recommended).")
    parser.add_argument("--resources-dir", default=DEFAULT_RESOURCES_DIR, help="Output resources directory.")
    parser.add_argument("--only-tray", action="store_true", help="Only generate tray icons (does not overwrite icon.ico/icon.png/icon.icns).")
    args = parser.parse_args()

    source_image_path = resolve_source_image_path(args.source, args.resources_dir)
    if not source_image_path:
        raise SystemExit(
            "Source image not found. Provide --source, set AG_QUOTA_SOURCE_IMAGE, "
            f"or place an icon at {os.path.join(args.resources_dir, 'icon.png')}"
        )

    generate_icons(source_image_path, args.resources_dir, args.only_tray)
