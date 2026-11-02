#!/usr/bin/env python3
"""High-performance live camera defect detection and localization engine for product P-PLATE01.
Accurately detects metal plate in live video frames, crops the plate, standardizes to
128x128 reference space, evaluates classifier.npz, and localizes defect coordinates
mapped directly back to the original camera frame.
"""
import sys
import os
import json
from pathlib import Path
import numpy as np
from PIL import Image, ImageOps

MODEL_DIR = Path(__file__).resolve().parent
MODEL_PATH = MODEL_DIR / "classifier.npz"

def load_classifier():
    if not MODEL_PATH.exists():
        raise FileNotFoundError(f"Model file {MODEL_PATH} not found")
    return np.load(MODEL_PATH, allow_pickle=False)

def apply_nms(boxes, iou_threshold=0.3):
    if len(boxes) <= 1:
        return boxes
    boxes.sort(key=lambda b: b.get("pixel_count", 0), reverse=True)
    picked = []
    for b in boxes:
        bx1, by1, bw, bh = b["frame_box"]
        bx2, by2 = bx1 + bw, by1 + bh
        b_area = bw * bh
        overlap = False
        for p in picked:
            px1, py1, pw, ph = p["frame_box"]
            px2, py2 = px1 + pw, py1 + ph
            p_area = pw * ph

            ix1 = max(bx1, px1)
            iy1 = max(by1, py1)
            ix2 = min(bx2, px2)
            iy2 = min(by2, py2)

            inter_w = max(0, ix2 - ix1)
            inter_h = max(0, iy2 - iy1)
            inter_area = inter_w * inter_h
            union_area = b_area + p_area - inter_area
            iou = inter_area / union_area if union_area > 0 else 0
            if iou > iou_threshold:
                overlap = True
                break
        if not overlap:
            picked.append(b)
    return picked

def detect_metal_plate_region(im):
    """Locates the target metal plate P-PLATE01 in a camera frame.
    Rejects text, screens, human hands, and background tables.
    Returns: (is_detected, plate_box, debug_info)
    """
    orig_w, orig_h = im.size
    # Downscale for rapid analysis (160x120)
    dw, dh = 160, 120
    im_small = im.resize((dw, dh), Image.Resampling.BILINEAR)
    arr = np.asarray(im_small, dtype=np.float64) / 255.0
    r, g, b = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2]

    lum = 0.299 * r + 0.587 * g + 0.114 * b
    chroma = np.maximum(np.abs(r - g), np.maximum(np.abs(g - b), np.abs(r - b)))

    # Reject skin tones: R > 0.35, G > 0.15, B > 0.08, R > G > B, (R-G) > 0.05
    is_skin = (r > 0.35) & (g > 0.15) & (b > 0.08) & (r > g) & (r > b) & ((r - g) > 0.045) & (np.abs(g - b) < 0.25)

    # Metal plate criteria:
    # 1. Achromatic: low chroma (<= 0.16 allows for typical indoor camera white balance)
    # 2. Metallic surface luminance: between 0.36 and 0.95
    # 3. Non-skin
    is_metal = (chroma <= 0.16) & (lum >= 0.36) & (lum <= 0.95) & (~is_skin)

    y_indices, x_indices = np.where(is_metal)
    total_metal = len(x_indices)

    # Plate must occupy reasonable proportion of frame
    min_metal_pixels = int(dw * dh * 0.04) # at least 4% of frame
    if total_metal < min_metal_pixels:
        return False, None, {"reason": "Insufficient metal pixels", "count": total_metal}

    min_x, max_x = int(x_indices.min()), int(x_indices.max())
    min_y, max_y = int(y_indices.min()), int(y_indices.max())
    box_w = max_x - min_x
    box_h = max_y - min_y

    if box_w < dw * 0.12 or box_h < dh * 0.12:
        return False, None, {"reason": "Candidate region too small", "size": [box_w, box_h]}

    # Full screen background rejection (blank wall or huge screen > 92% of frame)
    if box_w >= dw * 0.94 and box_h >= dh * 0.94:
        return False, None, {"reason": "Full-screen background rejected"}

    # Aspect ratio check: manufactured metal plate is square / rectangle (0.55 to 1.7)
    aspect = box_w / box_h if box_h > 0 else 0
    if aspect < 0.55 or aspect > 1.75:
        return False, None, {"reason": "Non-plate aspect ratio", "aspect": round(aspect, 2)}

    # Surface density: metal pixels should densely fill bounding box (>= 40%)
    density = total_metal / (box_w * box_h) if box_w * box_h > 0 else 0
    if density < 0.40:
        return False, None, {"reason": "Low surface density", "density": round(density, 2)}

    # Check local texture variance (reject high-frequency code/text screens)
    plate_lums = lum[min_y:max_y+1, min_x:max_x+1]
    metal_mask_crop = is_metal[min_y:max_y+1, min_x:max_x+1]
    if np.any(metal_mask_crop):
        plate_std = float(plate_lums[metal_mask_crop].std())
        if plate_std > 0.22:
            return False, None, {"reason": "High variance text/screen clutter", "std": round(plate_std, 3)}

    # Map box back to original image dimensions
    scale_x = orig_w / float(dw)
    scale_y = orig_h / float(dh)
    plate_box = [
        max(0, int(round(min_x * scale_x))),
        max(0, int(round(min_y * scale_y))),
        min(orig_w, int(round(box_w * scale_x))),
        min(orig_h, int(round(box_h * scale_y))),
    ]

    return True, plate_box, {"density": round(density, 2), "total_metal": total_metal}

def process_frame_inference(image_path_or_pil):
    """Full live pipeline:
    Detects metal plate -> Preprocesses to 128x128 standard space -> Runs classifier.npz ->
    Localizes defects -> Maps coordinates back to frame coordinates.
    """
    if isinstance(image_path_or_pil, (str, Path)):
        orig = Image.open(image_path_or_pil)
    else:
        orig = image_path_or_pil

    orig = ImageOps.exif_transpose(orig).convert("RGB")
    orig_w, orig_h = orig.size

    # Step 1: Detect metal plate
    is_detected, plate_box, debug_info = detect_metal_plate_region(orig)

    if not is_detected or not plate_box:
        # Check if the whole image itself is a pre-cropped specimen (e.g. sample image like inspection_024.jpg)
        arr_full = np.asarray(orig.resize((128, 128)), dtype=np.float64) / 255.0
        r_f, g_f, b_f = arr_full[:, :, 0], arr_full[:, :, 1], arr_full[:, :, 2]
        lum_f = 0.299 * r_f + 0.587 * g_f + 0.114 * b_f
        center_lum = lum_f[16:112, 16:112].mean()
        border_lum = lum_f[:16, :].mean()
        if (0.50 <= center_lum <= 0.88) and (center_lum - border_lum >= 0.12):
            # Centered plate specimen card format!
            is_detected = True
            plate_box = [
                int(round(orig_w * (16.0 / 128.0))),
                int(round(orig_h * (16.0 / 128.0))),
                int(round(orig_w * (96.0 / 128.0))),
                int(round(orig_h * (96.0 / 128.0))),
            ]
        else:
            return {
                "plate_detected": False,
                "message": "PLEASE PLACE THE METAL PLATE",
                "detail": "METAL PLATE NOT FOUND!",
                "status": "METAL PLATE NOT FOUND!",
                "regions": [],
                "confidence": None,
                "debug": debug_info,
            }

    # Step 2: Extract and crop metal plate region
    px, py, pw, ph = plate_box
    # Apply 2.5% inward safety margin to ensure no dark background surround bleeds into feature extraction
    pad_x = int(round(pw * 0.025))
    pad_y = int(round(ph * 0.025))
    crop_x1 = min(orig_w - 1, px + pad_x)
    crop_y1 = min(orig_h - 1, py + pad_y)
    crop_x2 = max(crop_x1 + 10, px + pw - pad_x)
    crop_y2 = max(crop_y1 + 10, py + ph - pad_y)
    plate_crop = orig.crop((crop_x1, crop_y1, crop_x2, crop_y2))

    # Step 3: Standardize to model training specification (96x96 plate centered inside 128x128 reference frame)
    plate_96 = plate_crop.resize((96, 96), Image.Resampling.BILINEAR)
    canvas = Image.new("RGB", (128, 128), color=(38, 38, 38))
    canvas.paste(plate_96, (16, 16))

    # Step 4: Extract 17-dimensional model features (exact BIT-PLATE-CV-1.0 formula)
    a = np.asarray(canvas.convert("L"), dtype=np.float64)[16:112, 16:112] / 255.0
    residual = a - np.median(a)
    feats = np.array([
        a.mean(),
        a.std(),
        *np.quantile(residual, [0.01, 0.05, 0.1, 0.25, 0.75, 0.9, 0.95, 0.99]),
        *[(residual < -v).mean() for v in [0.03, 0.06, 0.1, 0.15, 0.2]],
        np.abs(np.diff(a, axis=0)).mean(),
        np.abs(np.diff(a, axis=1)).mean()
    ], dtype=np.float64)

    # Step 5: Evaluate frozen classifier
    model = load_classifier()
    z = float(((feats - model["mean"]) / model["scale"]) @ model["coef"] + model["intercept"].item())
    defect_prob = float(1.0 / (1.0 + np.exp(-np.clip(z, -50, 50))))
    is_defective = defect_prob >= 0.50
    confidence = defect_prob if is_defective else (1.0 - defect_prob)
    predicted_class = "Defective" if is_defective else "Normal"

    # Step 6: Defect localization on the metal plate surface
    regions = []
    if is_defective:
        # Evaluate anomaly map on plate interior (excluding 6-pixel outer margin to avoid edge boundary artifacts)
        interior = a[6:90, 6:90]
        med = np.median(interior)
        res_interior = interior - med
        # Anomaly mask: dark scratches / pits (drop >= 5.5%) or bright gouges (rise >= 8.0%)
        mask = (res_interior < -0.052) | (res_interior > 0.080)

        # Connected component grouping (8-connectivity BFS)
        visited = np.zeros_like(mask, dtype=bool)
        h_m, w_m = mask.shape
        comps = []
        for r in range(h_m):
            for c in range(w_m):
                if mask[r, c] and not visited[r, c]:
                    comp = []
                    q = [(r, c)]
                    visited[r, c] = True
                    while q:
                        cr, cc = q.pop(0)
                        comp.append((cr, cc))
                        for dr in [-1, 0, 1]:
                            for dc in [-1, 0, 1]:
                                nr, nc = cr + dr, cc + dc
                                if 0 <= nr < h_m and 0 <= nc < w_m and mask[nr, nc] and not visited[nr, nc]:
                                    visited[nr, nc] = True
                                    q.append((nr, nc))
                    if len(comp) >= 10: # filter minor sensor noise
                        comps.append(comp)

        comps.sort(key=lambda c: len(c), reverse=True)

        for idx, comp in enumerate(comps[:5]):
            min_r = min(p[0] for p in comp) + 6
            max_r = max(p[0] for p in comp) + 6
            min_c = min(p[1] for p in comp) + 6
            max_c = max(p[1] for p in comp) + 6

            # Normalized relative position inside plate (0.0 to 1.0)
            rel_x = max(0.0, min_c / 96.0)
            rel_y = max(0.0, min_r / 96.0)
            rel_w = min(1.0, (max_c - min_c + 2) / 96.0)
            rel_h = min(1.0, (max_r - min_r + 2) / 96.0)

            # Map to camera frame pixel coordinates
            fx = max(px, int(round(px + rel_x * pw)))
            fy = max(py, int(round(py + rel_y * ph)))
            fw = max(18, int(round(rel_w * pw)))
            fh = max(18, int(round(rel_h * ph)))

            # Percentage coordinates relative to whole frame
            pct_x = round((fx / orig_w) * 100.0, 1)
            pct_y = round((fy / orig_h) * 100.0, 1)
            pct_w = round((fw / orig_w) * 100.0, 1)
            pct_h = round((fh / orig_h) * 100.0, 1)

            reg_conf = min(0.999, float(defect_prob * (0.94 + min(len(comp), 60) * 0.001)))
            regions.append({
                "label": f"Defect {idx + 1}",
                "confidence": round(reg_conf, 4),
                "severity": "High" if len(comp) > 40 else ("Medium" if len(comp) > 20 else "Low"),
                "pixel_count": len(comp),
                "frame_box": [fx, fy, fw, fh],
                "coordinates": {
                    "x": pct_x,
                    "y": pct_y,
                    "width": pct_w,
                    "height": pct_h,
                }
            })

        regions = apply_nms(regions, iou_threshold=0.3)

    # Determine final UI status string
    if is_defective and len(regions) > 0:
        status = "DEFECT DETECTED"
    elif is_defective and len(regions) == 0:
        status = "DEFECT DETECTED — LOCATION UNAVAILABLE"
    else:
        status = "NO DEFECT DETECTED"

    return {
        "plate_detected": True,
        "product_id": "P-PLATE01",
        "plate_box": plate_box,
        "predicted_class": predicted_class,
        "confidence": round(confidence, 4),
        "defect_probability": round(defect_prob, 4),
        "status": status,
        "regions": regions,
        "model_version": "BIT-PLATE-CV-1.0",
        "frame_dimensions": [orig_w, orig_h],
    }

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No image argument provided"}))
        sys.exit(1)
    res = process_frame_inference(sys.argv[1])
    print(json.dumps(res, indent=2))
