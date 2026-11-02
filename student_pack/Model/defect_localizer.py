#!/usr/bin/env python3
"""AI-Based Metal Plate Defect Localization and Visual Marking Engine.
First verifies metal plate presence, crops the metal plate, runs defect detection exclusively on the metal plate,
applies Non-Maximum Suppression (NMS), and outputs precise defect bounding boxes.
"""
import sys
import os
import json
import numpy as np
from PIL import Image, ImageOps, ImageDraw, ImageFont

# Import component detector to guarantee Step 1: Identify the Metal Plate
try:
    from component_detector import detect_plate_presence
except ImportError:
    from .component_detector import detect_plate_presence

def apply_nms(boxes, iou_threshold=0.3):
    """Applies Non-Maximum Suppression to eliminate overlapping duplicate boxes."""
    if len(boxes) <= 1:
        return boxes
    # Sort by pixel count descending
    boxes.sort(key=lambda b: b.get("pixel_count", 0), reverse=True)
    picked = []
    for b in boxes:
        bx1, by1, bw, bh = b["pixel_box"]
        bx2, by2 = bx1 + bw, by1 + bh
        b_area = bw * bh

        overlap = False
        for p in picked:
            px1, py1, pw, ph = p["pixel_box"]
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

def localize_defects(image_path, output_annotated_path=None):
    if not os.path.exists(image_path):
        return {
            "available": False,
            "reason": "Image file not found",
            "defect_count": 0,
            "regions": []
        }

    try:
        # Step 1: Identify the metal plate first. Ignore arbitrary objects, text, screens, and hands.
        presence = detect_plate_presence(image_path)
        if not presence.get("component_detected", False):
            return {
                "available": False,
                "reason": "PLEASE PLACE THE METAL PLATE / METAL PLATE NOT FOUND!",
                "defect_count": 0,
                "regions": []
            }

        orig = Image.open(image_path)
        im = ImageOps.exif_transpose(orig).convert("RGB")
        orig_w, orig_h = im.size

        # Step 2: Crop the metal plate region (normalized to 128x128 reference space)
        im_128 = im.resize((128, 128), Image.Resampling.BILINEAR)
        # Component metal plate center occupies 16:112, 16:112 (96x96 px)
        a = np.asarray(im_128.convert("L"), dtype=np.float64)[16:112, 16:112] / 255.0
        med = np.median(a)
        residual = a - med

        # Step 3: Anomaly detection strictly on the cropped metal plate surface
        # Scratches, pits, or dark surface abrasions:
        mask = (residual < -0.058)
        # Bright gouges:
        bright_mask = (residual > 0.085)
        combined_mask = mask | bright_mask

        if not np.any(combined_mask):
            return {
                "available": False,
                "reason": "Normal Metal Plate — No Defects Detected",
                "defect_count": 0,
                "regions": []
            }

        # Connected-component labeling via 8-connectivity BFS
        visited = np.zeros_like(combined_mask, dtype=bool)
        h_m, w_m = combined_mask.shape
        components = []

        for r in range(h_m):
            for c in range(w_m):
                if combined_mask[r, c] and not visited[r, c]:
                    comp = []
                    queue = [(r, c)]
                    visited[r, c] = True
                    while queue:
                        curr_r, curr_c = queue.pop(0)
                        comp.append((curr_r, curr_c))
                        for dr in [-1, 0, 1]:
                            for dc in [-1, 0, 1]:
                                nr, nc = curr_r + dr, curr_c + dc
                                if 0 <= nr < h_m and 0 <= nc < w_m:
                                    if combined_mask[nr, nc] and not visited[nr, nc]:
                                        visited[nr, nc] = True
                                        queue.append((nr, nc))
                    # Filter minor pixel noise (minimum 8 connected pixels in 96x96 space)
                    if len(comp) >= 8:
                        components.append(comp)

        if not components:
            return {
                "available": False,
                "reason": "Normal Metal Plate — No Defects Detected",
                "defect_count": 0,
                "regions": []
            }

        # Sort components by pixel count descending
        components.sort(key=lambda c: len(c), reverse=True)

        raw_regions = []
        scale_x = orig_w / 128.0
        scale_y = orig_h / 128.0

        for idx, comp in enumerate(components[:6]):
            min_r = min(pt[0] for pt in comp)
            max_r = max(pt[0] for pt in comp)
            min_c = min(pt[1] for pt in comp)
            max_c = max(pt[1] for pt in comp)

            # Map from 96x96 plate back to 128x128 space
            x1_128 = min_c + 16
            y1_128 = min_r + 16
            x2_128 = max_c + 16
            y2_128 = max_r + 16

            # Add context margin (pad 2px in 128px space)
            pad = 2
            x1_128 = max(16, x1_128 - pad)
            y1_128 = max(16, y1_128 - pad)
            x2_128 = min(112, x2_128 + pad)
            y2_128 = min(112, y2_128 + pad)

            # Map to original image coordinates
            x1 = max(0, int(x1_128 * scale_x))
            y1 = max(0, int(y1_128 * scale_y))
            x2 = min(orig_w, int(x2_128 * scale_x))
            y2 = min(orig_h, int(y2_128 * scale_y))
            w_box = max(10, x2 - x1)
            h_box = max(10, y2 - y1)

            pct_x = round((x1 / orig_w) * 100, 1)
            pct_y = round((y1 / orig_h) * 100, 1)
            pct_w = round((w_box / orig_w) * 100, 1)
            pct_h = round((h_box / orig_h) * 100, 1)

            label = f"Defect {idx + 1}"
            severity = "High" if len(comp) > 40 else ("Medium" if len(comp) > 15 else "Low")

            raw_regions.append({
                "label": label,
                "coordinates": {
                    "x": pct_x,
                    "y": pct_y,
                    "width": pct_w,
                    "height": pct_h,
                },
                "pixel_box": [x1, y1, w_box, h_box],
                "severity": severity,
                "pixel_count": len(comp),
            })

        # Step 4: Apply Non-Maximum Suppression (NMS) to eliminate duplicate overlapping boxes
        regions = apply_nms(raw_regions, iou_threshold=0.3)

        # Render visual marking onto annotated image if output path specified
        annotated_saved_path = None
        if output_annotated_path and regions:
            orig_rgba = orig.convert("RGBA")
            overlay = Image.new("RGBA", orig_rgba.size, (0, 0, 0, 0))
            draw = ImageDraw.Draw(overlay)

            # Draw metal plate boundary outline in cyan
            plate_box = presence.get("plate_box") or presence.get("pcb_box")
            if plate_box:
                px, py, pw, ph = plate_box
                draw.rectangle([px, py, px + pw, py + ph], outline=(6, 182, 212, 200), width=3)

            # Draw defect boxes in red strictly on defects
            line_w = max(2, int(min(orig_w, orig_h) * 0.012))
            for reg in regions:
                bx, by, bw, bh = reg["pixel_box"]
                # Translucent red overlay fill: rgba(239, 68, 68, 0.28)
                draw.rectangle([bx, by, bx + bw, by + bh], fill=(239, 68, 68, 70), outline=(239, 68, 68, 255), width=line_w)

                # Badge label
                badge_h = max(18, int(line_w * 7))
                badge_w = max(65, int(len(reg["label"]) * line_w * 4.5))
                badge_y = max(0, by - badge_h)
                draw.rectangle([bx, badge_y, bx + badge_w, badge_y + badge_h], fill=(239, 68, 68, 240))
                draw.text((bx + 5, badge_y + 3), reg["label"], fill=(255, 255, 255, 255))

            composite = Image.alpha_composite(orig_rgba, overlay)
            os.makedirs(os.path.dirname(os.path.abspath(output_annotated_path)), exist_ok=True)
            composite.convert("RGB").save(output_annotated_path, quality=95)
            annotated_saved_path = output_annotated_path

        return {
            "available": len(regions) > 0,
            "reason": f"Detected {len(regions)} Defect(s) on Metal Plate" if regions else "Normal Metal Plate — No Defects Detected",
            "defect_count": len(regions),
            "regions": regions,
            "annotated_path": annotated_saved_path
        }
    except Exception as e:
        return {
            "available": False,
            "reason": f"Localization error: {str(e)}",
            "defect_count": 0,
            "regions": []
        }

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"available": False, "reason": "No image specified", "regions": []}))
        sys.exit(1)

    in_path = sys.argv[1]
    out_path = sys.argv[2] if len(sys.argv) > 2 else None
    res = localize_defects(in_path, out_path)
    print(json.dumps(res, indent=2))
