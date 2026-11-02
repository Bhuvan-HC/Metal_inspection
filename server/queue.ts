import path from 'path';
import { db, Inspection, InspectionBatch } from './db.js';
import { AIService } from './ai-service.js';

interface QueueItem {
  inspectionId: string;
  batchId?: string;
  filePath: string;
}

class InspectionQueue {
  private queue: QueueItem[] = [];
  private isProcessing = false;

  public enqueue(item: QueueItem): void {
    this.queue.push(item);
    this.processNext();
  }

  public enqueueBatch(items: QueueItem[]): void {
    this.queue.push(...items);
    this.processNext();
  }

  private async processNext(): Promise<void> {
    if (this.isProcessing || this.queue.length === 0) {
      return;
    }

    this.isProcessing = true;
    const item = this.queue.shift();

    if (!item) {
      this.isProcessing = false;
      return;
    }

    try {
      await this.processItem(item);
    } catch (err) {
      console.error(`Error processing inspection ${item.inspectionId}:`, err);
    } finally {
      this.isProcessing = false;
      // Continue with next item in queue
      setImmediate(() => this.processNext());
    }
  }

  private async processItem(item: QueueItem): Promise<void> {
    const inspection = db.findInspectionById(item.inspectionId);
    if (!inspection) return;

    // 1. Mark as PROCESSING
    db.updateInspection(inspection.inspectionId, {
      status: 'PROCESSING',
      startedAt: new Date().toISOString(),
    });

    if (item.batchId) {
      db.updateBatch(item.batchId, { status: 'PROCESSING' });
    }

    // 2. Validate image file
    const validation = AIService.validateImageFile(item.filePath);

    if (!validation.isValid) {
      // Mark as REJECTED with readable error
      db.updateInspection(inspection.inspectionId, {
        status: 'REJECTED',
        errorMessage: validation.error || 'Validation failed',
        imageSha256: validation.sha256 || inspection.imageSha256,
        completedAt: new Date().toISOString(),
      });

      db.addAuditLog({
        actorId: inspection.uploadedBy,
        actorUsername: inspection.uploaderUsername,
        actorRole: 'ENGINEER',
        action: 'INSPECTION_REJECTED',
        resourceType: 'INSPECTION',
        resourceId: inspection.inspectionId,
        details: `Rejected file ${inspection.originalFilename}: ${validation.error}`,
      });

      this.updateBatchProgress(item.batchId);
      return;
    }

    // Update sha256 from validated file
    db.updateInspection(inspection.inspectionId, {
      imageSha256: validation.sha256 || inspection.imageSha256,
    });

    // 3. Execute model inference
    try {
      const result = await AIService.predictImage(item.filePath);

      let localizationData: any = undefined;
      let annotatedImagePath: string | undefined = undefined;

      if (result.predicted_class === 'Defective') {
        const uploadsDir = path.resolve(process.cwd(), 'uploads');
        const annotatedFilename = `annotated_${path.basename(item.filePath)}`;
        const annotatedFullPath = path.join(uploadsDir, annotatedFilename);

        const loc = await AIService.localizeDefect(item.filePath, annotatedFullPath);
        localizationData = loc;
        if (loc.annotatedImageUrl) {
          annotatedImagePath = loc.annotatedImageUrl;
        }
      }

      db.updateInspection(inspection.inspectionId, {
        status: 'COMPLETED',
        predictedClass: result.predicted_class,
        confidence: result.confidence,
        defectProbability: result.defect_probability,
        modelVersion: result.model_version,
        localization: localizationData,
        annotatedImagePath,
        completedAt: new Date().toISOString(),
      });

      db.addAuditLog({
        actorId: inspection.uploadedBy,
        actorUsername: inspection.uploaderUsername,
        actorRole: 'ENGINEER',
        action: 'INFERENCE_SUCCESS',
        resourceType: 'INSPECTION',
        resourceId: inspection.inspectionId,
        details: `Prediction: ${result.predicted_class} (${(result.confidence * 100).toFixed(1)}%)`,
      });
    } catch (err: any) {
      db.updateInspection(inspection.inspectionId, {
        status: 'FAILED',
        errorMessage: err.message || 'Inference engine error',
        completedAt: new Date().toISOString(),
      });

      db.addAuditLog({
        actorId: inspection.uploadedBy,
        actorUsername: inspection.uploaderUsername,
        actorRole: 'ENGINEER',
        action: 'INFERENCE_FAILED',
        resourceType: 'INSPECTION',
        resourceId: inspection.inspectionId,
        details: `Error for ${inspection.originalFilename}: ${err.message}`,
      });
    }

    this.updateBatchProgress(item.batchId);
  }

  private updateBatchProgress(batchId?: string): void {
    if (!batchId) return;

    const batch = db.findBatchById(batchId);
    if (!batch) return;

    const items = db.findInspectionsByBatchId(batchId);
    let accepted = 0;
    let rejected = 0;
    let completed = 0;
    let failed = 0;
    let pendingOrProcessing = 0;

    for (const it of items) {
      if (it.status === 'COMPLETED') {
        completed++;
        accepted++;
      } else if (it.status === 'REJECTED') {
        rejected++;
      } else if (it.status === 'FAILED') {
        failed++;
        accepted++;
      } else {
        pendingOrProcessing++;
      }
    }

    let finalStatus = batch.status;
    let completedAt: string | undefined = undefined;

    if (pendingOrProcessing === 0) {
      completedAt = new Date().toISOString();
      if (rejected === 0 && failed === 0) {
        finalStatus = 'COMPLETED';
      } else if (completed > 0) {
        finalStatus = 'COMPLETED_WITH_ERRORS';
      } else {
        finalStatus = 'FAILED';
      }
    } else {
      finalStatus = 'PROCESSING';
    }

    db.updateBatch(batchId, {
      acceptedFiles: accepted,
      rejectedFiles: rejected,
      completedFiles: completed,
      failedFiles: failed,
      status: finalStatus,
      completedAt,
    });
  }
}

export const inspectionQueue = new InspectionQueue();
