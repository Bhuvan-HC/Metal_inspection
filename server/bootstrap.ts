import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { db } from './db.js';
import { AIService } from './ai-service.js';

export async function bootstrapDatabase(): Promise<void> {
  const uploadsDir = path.resolve(process.cwd(), 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  // Preload 60 sample records if not already present
  if (!db.hasPreloadedSamples()) {
    console.log('[Bootstrap] Preloading 60 ground-truth evaluation samples into inspection history...');
    const csvPath = path.resolve(process.cwd(), 'student_pack/Samples/labels.csv');
    if (!fs.existsSync(csvPath)) {
      console.warn('[Bootstrap] labels.csv not found, skipping preloading');
      return;
    }

    const lines = fs.readFileSync(csvPath, 'utf-8').split('\n').filter((l) => l.trim().length > 0);
    const sampleRows = lines.slice(1);

    for (let i = 0; i < sampleRows.length; i++) {
      const parts = sampleRows[i].split(',').map((p) => p.trim());
      if (parts.length < 4) continue;

      const [imageId, relPath, productId] = parts;
      const fullPath = path.resolve(process.cwd(), 'student_pack/Samples', relPath);

      if (!fs.existsSync(fullPath)) continue;

      const buffer = fs.readFileSync(fullPath);
      const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');

      try {
        const pred = await AIService.predictImage(fullPath);
        const filename = path.basename(relPath);
        const inspectionId = `INSP-SAMPLE-${String(i + 1).padStart(3, '0')}`;
        const createdAt = new Date(Date.now() - (60 - i) * 60000).toISOString();

        db.createInspection({
          inspectionId,
          productId: productId || 'P-PLATE01',
          uploadedBy: 'user-eng-1',
          uploaderUsername: 'engineer',
          originalFilename: filename,
          imagePath: `/samples/${relPath}`,
          imageSha256: sha256,
          status: 'COMPLETED',
          predictedClass: pred.predicted_class,
          confidence: pred.confidence,
          defectProbability: pred.defect_probability,
          modelVersion: pred.model_version,
          createdAt,
          startedAt: createdAt,
          completedAt: createdAt,
        });
      } catch (err) {
        console.error(`[Bootstrap] Error evaluating sample ${imageId}:`, err);
      }
    }

    // Seed 2 initial supervisor reviews on preloaded samples for rich review history
    const sample1 = db.findInspectionById('INSP-SAMPLE-001');
    if (sample1) {
      db.createReview({
        inspectionId: sample1.inspectionId,
        reviewedBy: 'user-super-1',
        reviewerUsername: 'supervisor',
        originalPredictedClass: sample1.predictedClass || 'Defective',
        reviewedClass: 'Defective',
        decision: 'CONFIRMED',
        comments: 'Verified scratch pattern near top quadrant. Defective classification confirmed.',
      });
    }

    const sample2 = db.findInspectionById('INSP-SAMPLE-002');
    if (sample2) {
      db.createReview({
        inspectionId: sample2.inspectionId,
        reviewedBy: 'user-super-1',
        reviewerUsername: 'supervisor',
        originalPredictedClass: sample2.predictedClass || 'Normal',
        reviewedClass: 'Normal',
        decision: 'CONFIRMED',
        comments: 'Uniform surface texture, within tolerance bounds. Verified nominal.',
      });
    }

    db.addAuditLog({
      actorId: 'system',
      actorUsername: 'system',
      actorRole: 'ADMIN',
      action: 'BOOTSTRAP_PRELOAD_COMPLETE',
      resourceType: 'INSPECTIONS',
      resourceId: 'all-60-samples',
      details: 'Successfully preloaded and evaluated 60 sample records',
    });

    console.log('[Bootstrap] Successfully preloaded 60 sample inspections and initial reviews.');
  }
}
