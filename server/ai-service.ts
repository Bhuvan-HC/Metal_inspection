import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export interface ValidationResult {
  isValid: boolean;
  error?: string;
  format?: 'PNG' | 'JPEG';
  width?: number;
  height?: number;
  sizeBytes?: number;
  sha256?: string;
}

export interface InferenceResult {
  predicted_class: 'Normal' | 'Defective';
  confidence: number;
  defect_probability: number;
  model_version: string;
}

const MODEL_DIR = path.resolve(process.cwd(), 'student_pack/Model');
const INFERENCE_SCRIPT = path.join(MODEL_DIR, 'inference.py');
const MODEL_NPZ = path.join(MODEL_DIR, 'classifier.npz');

const EXPECTED_CHECKSUMS: Record<string, string> = {
  'classifier.npz': 'd05a524ac10d6cb864e82da5adb69c0762308ddc05f833fd96eac336c4984ed2',
  'inference.py': '322647cb2e9b5466fe675af56564114532a3c50366ea4fad2961d69a88089ffc',
};

export class AIService {
  public static verifyModelIntegrity(): { verified: boolean; details: Record<string, boolean> } {
    const details: Record<string, boolean> = {};
    let allValid = true;

    for (const [filename, expectedHash] of Object.entries(EXPECTED_CHECKSUMS)) {
      const filePath = path.join(MODEL_DIR, filename);
      if (!fs.existsSync(filePath)) {
        details[filename] = false;
        allValid = false;
        continue;
      }
      const fileBuffer = fs.readFileSync(filePath);
      const actualHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
      const matches = actualHash === expectedHash;
      details[filename] = matches;
      if (!matches) allValid = false;
    }

    return { verified: allValid, details };
  }

  /**
   * Validates image buffer using magic bytes, dimensions, and size constraints.
   * Requirement: Accept decoded JPEG or PNG only, at most 5 MiB per file,
   * with each dimension from 64 to 4096 pixels inclusive.
   */
  public static validateImageFile(filePath: string): ValidationResult {
    if (!fs.existsSync(filePath)) {
      return { isValid: false, error: 'File does not exist on disk' };
    }

    const stats = fs.statSync(filePath);
    const sizeBytes = stats.size;
    const MAX_SIZE = 5 * 1024 * 1024; // 5 MiB

    if (sizeBytes > MAX_SIZE) {
      return {
        isValid: false,
        sizeBytes,
        error: `File size (${(sizeBytes / (1024 * 1024)).toFixed(2)} MB) exceeds maximum allowed 5 MiB`,
      };
    }

    if (sizeBytes < 16) {
      return {
        isValid: false,
        sizeBytes,
        error: 'File is too small to be a valid image header',
      };
    }

    const buffer = fs.readFileSync(filePath);
    const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');

    // 1. Check Magic Bytes
    const isPng = buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47;
    const isJpeg = buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;

    if (!isPng && !isJpeg) {
      return {
        isValid: false,
        sizeBytes,
        sha256,
        error: 'File content does not match valid JPEG or PNG image format (corrupt or disguised file)',
      };
    }

    // 2. Decode dimensions
    let width = 0;
    let height = 0;

    if (isPng) {
      if (buffer.length < 24) {
        return { isValid: false, sizeBytes, sha256, error: 'Corrupted PNG header structure' };
      }
      width = buffer.readUInt32BE(16);
      height = buffer.readUInt32BE(20);
    } else if (isJpeg) {
      // Parse SOF markers for JPEG dimensions
      let offset = 2;
      let foundDimensions = false;
      while (offset < buffer.length) {
        if (buffer[offset] !== 0xff) {
          offset++;
          continue;
        }
        const marker = buffer[offset + 1];
        // SOF0 (0xC0), SOF1 (0xC1), SOF2 (0xC2)
        if (marker === 0xc0 || marker === 0xc1 || marker === 0xc2) {
          height = buffer.readUInt16BE(offset + 5);
          width = buffer.readUInt16BE(offset + 7);
          foundDimensions = true;
          break;
        } else if (marker === 0xd9 || marker === 0xda) {
          // EOI or SOS
          break;
        } else {
          const length = buffer.readUInt16BE(offset + 2);
          offset += 2 + length;
        }
      }
      if (!foundDimensions || width === 0 || height === 0) {
        // Fallback or truncated JPEG
        return { isValid: false, sizeBytes, sha256, error: 'Corrupted JPEG header: could not read dimensions' };
      }
    }

    // 3. Validate dimension bounds: 64 to 4096 px inclusive
    if (width < 64 || height < 64) {
      return {
        isValid: false,
        format: isPng ? 'PNG' : 'JPEG',
        width,
        height,
        sizeBytes,
        sha256,
        error: `Image dimensions (${width}x${height}) are below required minimum 64x64 pixels`,
      };
    }

    if (width > 4096 || height > 4096) {
      return {
        isValid: false,
        format: isPng ? 'PNG' : 'JPEG',
        width,
        height,
        sizeBytes,
        sha256,
        error: `Image dimensions (${width}x${height}) exceed maximum allowed 4096x4096 pixels`,
      };
    }

    return {
      isValid: true,
      format: isPng ? 'PNG' : 'JPEG',
      width,
      height,
      sizeBytes,
      sha256,
    };
  }

  /**
   * Executes the exact supplied inference.py model pipeline via Python runner.
   */
  public static async predictImage(imagePath: string): Promise<InferenceResult> {
    const absImagePath = path.resolve(imagePath);
    if (!fs.existsSync(absImagePath)) {
      throw new Error(`Image file not found at ${absImagePath}`);
    }

    try {
      const { stdout } = await execFileAsync('python3', [INFERENCE_SCRIPT, absImagePath], {
        timeout: 10000,
        cwd: MODEL_DIR,
      });

      const parsed = JSON.parse(stdout.trim());
      if (!parsed.predicted_class || parsed.confidence === undefined) {
        throw new Error(`Invalid prediction output structure: ${stdout}`);
      }

      return {
        predicted_class: parsed.predicted_class,
        confidence: Number(parsed.confidence),
        defect_probability: Number(parsed.defect_probability),
        model_version: parsed.model_version || 'BIT-PLATE-CV-1.0',
      };
    } catch (err: any) {
      console.error('Python inference error:', err.stderr || err.message);
      throw new Error(`Inference execution failed: ${err.stderr || err.message}`);
    }
  }

  /**
   * Checks whether the image contains the expected P-PLATE01 centered metal plate
   * before allowing AI defect classification.
   */
  public static async detectComponentPresence(imagePath: string): Promise<{
    component_detected: boolean;
    product_id: string;
    message: string;
    center_mean?: number;
    contrast?: number;
  }> {
    const absImagePath = path.resolve(imagePath);
    if (!fs.existsSync(absImagePath)) {
      return {
        component_detected: false,
        product_id: 'P-PLATE01',
        message: 'Component Not Found! Please Place the Component',
      };
    }

    const detectorScript = path.join(MODEL_DIR, 'component_detector.py');
    try {
      const { stdout } = await execFileAsync('python3', [detectorScript, absImagePath], {
        timeout: 5000,
        cwd: MODEL_DIR,
      });
      const parsed = JSON.parse(stdout.trim());
      return {
        component_detected: Boolean(parsed.component_detected),
        product_id: 'P-PLATE01',
        message: parsed.message || (parsed.component_detected ? 'Component Detected — Ready for Inspection' : 'Component Not Found! Please Place the Component'),
        center_mean: parsed.center_mean,
        contrast: parsed.contrast,
      };
    } catch (err: any) {
      console.error('Component detector execution error:', err.stderr || err.message);
      return {
        component_detected: false,
        product_id: 'P-PLATE01',
        message: 'Component Not Found! Please Place the Component',
      };
    }
  }

  /**
   * Executes AI-based defect localization to isolate the exact defect region(s)
   * on defective plates and produce an annotated visual image with red outline and translucent overlay.
   */
  public static async localizeDefect(
    imagePath: string,
    outputAnnotatedPath?: string
  ): Promise<{
    available: boolean;
    reason?: string;
    defectCount: number;
    regions: Array<{
      label: string;
      coordinates: { x: number; y: number; width: number; height: number };
      pixel_box: [number, number, number, number];
      severity: 'Low' | 'Medium' | 'High';
      pixel_count?: number;
    }>;
    annotatedImageUrl?: string;
  }> {
    const absImagePath = path.resolve(imagePath);
    if (!fs.existsSync(absImagePath)) {
      return {
        available: false,
        reason: 'Image file not found',
        defectCount: 0,
        regions: [],
      };
    }

    const localizerScript = path.join(MODEL_DIR, 'defect_localizer.py');
    try {
      const args = [localizerScript, absImagePath];
      if (outputAnnotatedPath) {
        args.push(path.resolve(outputAnnotatedPath));
      }

      const { stdout } = await execFileAsync('python3', args, {
        timeout: 8000,
        cwd: MODEL_DIR,
      });

      const parsed = JSON.parse(stdout.trim());
      let annotatedImageUrl: string | undefined = undefined;

      if (outputAnnotatedPath && parsed.available && fs.existsSync(outputAnnotatedPath)) {
        const uploadsDir = path.resolve(process.cwd(), 'uploads');
        const rel = path.relative(uploadsDir, path.resolve(outputAnnotatedPath));
        if (!rel.startsWith('..')) {
          annotatedImageUrl = `/uploads/${rel}`;
        } else {
          annotatedImageUrl = `/uploads/${path.basename(outputAnnotatedPath)}`;
        }
      }

      return {
        available: Boolean(parsed.available),
        reason: parsed.reason,
        defectCount: parsed.defect_count || 0,
        regions: parsed.regions || [],
        annotatedImageUrl,
      };
    } catch (err: any) {
      console.error('Defect localizer execution error:', err.stderr || err.message);
      return {
        available: false,
        reason: 'Defect Detected — Exact Location Unavailable',
        defectCount: 0,
        regions: [],
      };
    }
  }

  /**
   * Continuous live camera defect detection and localization pipeline.
   * Processes live camera frames, isolates target metal plate P-PLATE01,
   * evaluates classifier.npz, and maps localized defect regions to frame coordinates.
   */
  public static async detectLiveFrame(
    frameInput: string | Buffer
  ): Promise<{
    plate_detected: boolean;
    product_id: string;
    plate_box?: [number, number, number, number] | null;
    predicted_class?: 'Normal' | 'Defective';
    confidence?: number;
    defect_probability?: number;
    status: string;
    message?: string;
    detail?: string;
    regions: Array<{
      label: string;
      confidence: number;
      severity: 'Low' | 'Medium' | 'High';
      pixel_count?: number;
      frame_box: [number, number, number, number];
      coordinates: { x: number; y: number; width: number; height: number };
    }>;
    model_version?: string;
    frame_dimensions?: [number, number];
  }> {
    const liveDetectorScript = path.join(MODEL_DIR, 'live_camera_detector.py');
    const tmpFramePath = path.join(os.tmpdir(), `live_frame_${Date.now()}_${crypto.randomUUID().slice(0, 6)}.jpg`);

    try {
      let buffer: Buffer;
      if (typeof frameInput === 'string') {
        const base64Data = frameInput.replace(/^data:image\/\w+;base64,/, '');
        buffer = Buffer.from(base64Data, 'base64');
      } else {
        buffer = frameInput;
      }

      fs.writeFileSync(tmpFramePath, buffer);

      const { stdout } = await execFileAsync('python3', [liveDetectorScript, tmpFramePath], {
        timeout: 6000,
        cwd: MODEL_DIR,
      });

      const parsed = JSON.parse(stdout.trim());
      return parsed;
    } catch (err: any) {
      console.error('Live frame inference error:', err.stderr || err.message);
      return {
        plate_detected: false,
        product_id: 'P-PLATE01',
        status: 'METAL PLATE NOT FOUND!',
        message: 'PLEASE PLACE THE METAL PLATE',
        detail: 'Inference pipeline error: ' + (err.message || 'unknown error'),
        regions: [],
      };
    } finally {
      if (fs.existsSync(tmpFramePath)) {
        try {
          fs.unlinkSync(tmpFramePath);
        } catch {}
      }
    }
  }
}


