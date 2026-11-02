"""Component presence detector for product P-PLATE01.
Accurately distinguishes target metal plate from background, hands, screens, and text.
"""
import sys
import json
import numpy as np
from PIL import Image

def detect_plate_presence(image_path):
    try:
        im = Image.open(image_path).convert("RGB")
        orig_w, orig_h = im.size
        
        # Resize to standard analysis grid
        im_resized = im.resize((128, 128), Image.Resampling.BILINEAR)
        arr = np.asarray(im_resized, dtype=np.float64) / 255.0
        r, g, b = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2]

        # Calculate luminance and chromatic difference
        lum = 0.299 * r + 0.587 * g + 0.114 * b
        max_chroma = np.maximum(np.abs(r - g), np.maximum(np.abs(g - b), np.abs(r - b)))

        # 1. P-PLATE01 design specification:
        # Centered plate is located at rows/cols 16 to 111 (96x96 px in 128x128 space)
        center_lum = lum[16:112, 16:112]
        center_chroma = max_chroma[16:112, 16:112]
        
        # Outer border surround
        border_mask = np.ones((128, 128), dtype=bool)
        border_mask[16:112, 16:112] = False
        border_lum = lum[border_mask]

        center_mean = float(center_lum.mean())
        center_std = float(center_lum.std())
        center_chroma_mean = float(center_chroma.mean())
        border_mean = float(border_lum.mean())
        contrast = center_mean - border_mean

        # Verification criteria:
        # 1. Metallic plate surface luminance: 0.52 <= center_mean <= 0.88
        # 2. Achromatic surface (not skin, wood, or colored background): center_chroma_mean <= 0.08
        # 3. Definite boundary contrast against surround: contrast >= 0.14
        # 4. Smooth uniform surface (reject high-frequency text / browser clutter): center_std <= 0.15
        # 5. Border surround is darker than plate: border_mean <= 0.58
        is_plate = (
            (0.52 <= center_mean <= 0.88) and
            (center_chroma_mean <= 0.08) and
            (contrast >= 0.14) and
            (center_std <= 0.15) and
            (border_mean <= 0.58)
        )

        # Compute bounding box in original image coordinates
        if is_plate:
            plate_box = [
                int(round(orig_w * (16.0 / 128.0))),
                int(round(orig_h * (16.0 / 128.0))),
                int(round(orig_w * (96.0 / 128.0))),
                int(round(orig_h * (96.0 / 128.0))),
            ]
        else:
            plate_box = None

        return {
            "component_detected": bool(is_plate),
            "product_id": "P-PLATE01",
            "center_mean": round(center_mean, 3),
            "center_std": round(center_std, 3),
            "border_mean": round(border_mean, 3),
            "contrast": round(contrast, 3),
            "chroma": round(center_chroma_mean, 3),
            "plate_box": plate_box,
            "pcb_box": plate_box,
            "message": "METAL PLATE DETECTED — Ready for Inspection" if is_plate else "PLEASE PLACE THE METAL PLATE / METAL PLATE NOT FOUND!"
        }
    except Exception as e:
        return {
            "component_detected": False,
            "error": str(e),
            "message": "PLEASE PLACE THE METAL PLATE / METAL PLATE NOT FOUND!"
        }

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"component_detected": False, "message": "No image specified"}))
        sys.exit(1)
    result = detect_plate_presence(sys.argv[1])
    print(json.dumps(result))
