import fs from 'fs';
import path from 'path';
import { AIService } from './ai-service.js';

export interface SampleEvaluationItem {
  imageId: string;
  filename: string;
  relativePath: string;
  actualLabel: 'Normal' | 'Defective';
  predictedClass: 'Normal' | 'Defective';
  confidence: number;
  defectProbability: number;
  isCorrect: boolean;
}

export interface EvaluationMetrics {
  totalEvaluated: number;
  totalEligible: number;
  truePositives: number; // Defective predicted Defective
  trueNegatives: number; // Normal predicted Normal
  falsePositives: number; // Normal predicted Defective
  falseNegatives: number; // Defective predicted Normal
  defectRecall: number; // TP / (TP + FN)
  precision: number; // TP / (TP + FP)
  f1Score: number;
  accuracy: number;
  confusionMatrix: {
    // Rows: Actual [Normal, Defective], Cols: Predicted [Normal, Defective]
    matrix: [[number, number], [number, number]];
    rowLabels: ['Actual Normal', 'Actual Defective'];
    colLabels: ['Predicted Normal', 'Predicted Defective'];
  };
  sampleItems: SampleEvaluationItem[];
  modelLimitationsNote: string;
}

export class EvaluationService {
  public static async runEvaluation(): Promise<EvaluationMetrics> {
    const csvPath = path.resolve(process.cwd(), 'student_pack/Samples/labels.csv');
    if (!fs.existsSync(csvPath)) {
      throw new Error('Evaluation ground-truth file student_pack/Samples/labels.csv not found');
    }

    const content = fs.readFileSync(csvPath, 'utf-8');
    const lines = content.split('\n').filter((l) => l.trim().length > 0);

    // Skip header line: image_id,relative_path,product_id,label
    const sampleRows = lines.slice(1);
    const sampleItems: SampleEvaluationItem[] = [];

    let tp = 0;
    let tn = 0;
    let fp = 0;
    let fn = 0;

    for (const row of sampleRows) {
      const parts = row.split(',').map((p) => p.trim());
      if (parts.length < 4) continue;

      const [imageId, relPath, , label] = parts;
      const actualLabel = label as 'Normal' | 'Defective';
      const fullImagePath = path.resolve(process.cwd(), 'student_pack/Samples', relPath);

      if (!fs.existsSync(fullImagePath)) {
        continue;
      }

      const prediction = await AIService.predictImage(fullImagePath);
      const isCorrect = prediction.predicted_class === actualLabel;

      if (actualLabel === 'Defective') {
        if (prediction.predicted_class === 'Defective') {
          tp++;
        } else {
          fn++;
        }
      } else {
        if (prediction.predicted_class === 'Normal') {
          tn++;
        } else {
          fp++;
        }
      }

      sampleItems.push({
        imageId,
        filename: path.basename(relPath),
        relativePath: `/samples/${relPath}`,
        actualLabel,
        predictedClass: prediction.predicted_class,
        confidence: prediction.confidence,
        defectProbability: prediction.defect_probability,
        isCorrect,
      });
    }

    const total = sampleItems.length;
    const defectRecall = tp + fn > 0 ? tp / (tp + fn) : 0;
    const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
    const f1Score = precision + defectRecall > 0 ? (2 * precision * defectRecall) / (precision + defectRecall) : 0;
    const accuracy = total > 0 ? (tp + tn) / total : 0;

    const matrix: [[number, number], [number, number]] = [
      [tn, fp], // Row 0: Actual Normal -> [Pred Normal, Pred Defective]
      [fn, tp], // Row 1: Actual Defective -> [Pred Normal, Pred Defective]
    ];

    return {
      totalEvaluated: total,
      totalEligible: 60,
      truePositives: tp,
      trueNegatives: tn,
      falsePositives: fp,
      falseNegatives: fn,
      defectRecall,
      precision,
      f1Score,
      accuracy,
      confusionMatrix: {
        matrix,
        rowLabels: ['Actual Normal', 'Actual Defective'],
        colLabels: ['Predicted Normal', 'Predicted Defective'],
      },
      sampleItems,
      modelLimitationsNote:
        fn === 0
          ? 'Zero false negatives recorded on the 60-sample procedural evaluation set. As stated in the Model & Data Guide, 100% recall on this small synthetic dataset cannot establish real-world manufacturing reliability due to fixed framing, synthetic texture artifacts, and uncalibrated linear scores.'
          : 'Evaluation metrics derived from actual frozen model inference on the 60 ground-truth samples.',
    };
  }
}
