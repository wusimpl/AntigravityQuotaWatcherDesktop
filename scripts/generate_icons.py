
import os
from PIL import Image

# Configuration
SOURCE_IMAGE_PATH = r"C:/Users/Administrator/.gemini/antigravity/brain/d9fce87b-7355-4ee5-a487-4f6c2c186145/ag_simple_capsule_1767751839629.png"
RESOURCES_DIR = r"c:/Users/Administrator/code/ag-quota-desktop/resources"

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

def generate_icons():
    if not os.path.exists(SOURCE_IMAGE_PATH):
        print(f"Error: Source image not found at {SOURCE_IMAGE_PATH}")
        return

    if not os.path.exists(RESOURCES_DIR):
        os.makedirs(RESOURCES_DIR)
        print(f"Created directory: {RESOURCES_DIR}")

    try:
        img = Image.open(SOURCE_IMAGE_PATH)
        print(f"Loaded image: {img.size} {img.format} {img.mode}")

        # Ensure RGBA
        if img.mode != 'RGBA':
            img = img.convert('RGBA')
        
        # 移除白色背景（使其透明）
        img = remove_white_background(img)
        print("Removed white background (converted to transparent)")

        # 1. Generate icon.ico for Windows
        # Sizes recommended for Windows
        icon_sizes = [(256, 256), (128, 128), (64, 64), (48, 48), (32, 32), (16, 16)]
        ico_path = os.path.join(RESOURCES_DIR, "icon.ico")
        img.save(ico_path, format='ICO', sizes=icon_sizes)
        print(f"Generated: {ico_path}")

        # 2. Generate icon.png (High Res)
        png_path = os.path.join(RESOURCES_DIR, "icon.png")
        img.resize((512, 512), Image.Resampling.LANCZOS).save(png_path, format='PNG')
        print(f"Generated: {png_path}")

        # 3. Generate tray icons (Small PNGs)
        # Usually tray icons are 16x16 or 32x32 (for high DPI)
        tray_16 = os.path.join(RESOURCES_DIR, "tray-16x16.png")
        img.resize((16, 16), Image.Resampling.LANCZOS).save(tray_16, format='PNG')
        
        tray_32 = os.path.join(RESOURCES_DIR, "tray-32x32.png")
        img.resize((32, 32), Image.Resampling.LANCZOS).save(tray_32, format='PNG')
        print(f"Generated tray icons: {tray_16}, {tray_32}")
        
        # 4. Attempt to generate icon.icns (Mac) - Optional/Partial
        # Since we are on Windows, we'll try to save as ICNS if Pillow supports it, 
        # otherwise we might just leave it or creating a PNG named .icns is bad practice.
        # Let's check if we can save as ICNS.
        icns_path = os.path.join(RESOURCES_DIR, "icon.icns")
        try:
            img.save(icns_path, format='ICNS', sizes=[(512,512), (256,256), (128,128), (32,32), (16,16)])
            print(f"Generated: {icns_path}")
        except Exception as e:
            print(f"Could not generate ICNS (expected on Windows without heavy libs): {e}")

    except Exception as e:
        print(f"An error occurred: {e}")

if __name__ == "__main__":
    generate_icons()
