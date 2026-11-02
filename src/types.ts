export type UserRole = 'ENGINEER' | 'SUPERVISOR' | 'ADMIN';

export interface User {
  id: string;
  username: string;
  email: string;
  role: UserRole;
  isActive: boolean;
}

export interface Product {
  id: string;
  productId: string;
  name: string;
  description: string;
  isActive: boolean;
  createdAt: string;
}

export type BatchStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'COMPLETED_WITH_ERRORS' | 'FAILED';

export interface InspectionBatch {
  id: string;
  batchId: string;
  productId?: string;
  uploadedBy: string;
  uploaderUsername: string;
  totalFiles: number;
  acceptedFiles: number;
  rejectedFiles: number;
  completedFiles: number;
  failedFiles: number;
  status: BatchStatus;
  createdAt: string;
  completedAt?: string;
  reviewStatus?: 'UNREVIEWED' | 'CONFIRMED' | 'CORRECTED';
  reviewedBy?: string;
  reviewerUsername?: string;
  reviewComments?: string;
  reviewedAt?: string;
}

export interface DefectRegion {
  label: string;
  coordinates: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  pixel_box: [number, number, number, number];
  severity: 'Low' | 'Medium' | 'High';
  pixel_count?: number;
}

export interface DefectLocalization {
  available: boolean;
  reason?: string;
  defectCount: number;
  regions: DefectRegion[];
  annotatedImageUrl?: string;
}

export type InspectionStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'REJECTED' | 'FAILED';

export interface Inspection {
  id: string;
  inspectionId: string;
  batchId?: string;
  productId: string;
  uploadedBy: string;
  uploaderUsername: string;
  originalFilename: string;
  imagePath: string;
  imageSha256: string;
  status: InspectionStatus;
  predictedClass?: 'Normal' | 'Defective';
  confidence?: number;
  defectProbability?: number;
  modelVersion?: string;
  errorMessage?: string;
  localization?: DefectLocalization;
  annotatedImagePath?: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  latestReview?: InspectionReview | null;
  reviewStatus?: 'UNREVIEWED' | 'CONFIRMED' | 'CORRECTED';
}

export type ReviewDecision = 'CONFIRMED' | 'CORRECTED';

export interface InspectionReview {
  id: string;
  inspectionId: string;
  reviewedBy: string;
  reviewerUsername: string;
  originalPredictedClass: 'Normal' | 'Defective';
  reviewedClass: 'Normal' | 'Defective';
  decision: ReviewDecision;
  comments: string;
  createdAt: string;
  updatedAt?: string;
}

export interface AuditLog {
  id: string;
  actorId: string;
  actorUsername: string;
  actorRole: UserRole;
  action: string;
  resourceType: string;
  resourceId: string;
  details: string;
  createdAt: string;
}

export interface EvaluationMetrics {
  totalEvaluated: number;
  totalEligible: number;
  truePositives: number;
  trueNegatives: number;
  falsePositives: number;
  falseNegatives: number;
  defectRecall: number;
  precision: number;
  f1Score: number;
  accuracy: number;
  confusionMatrix: {
    matrix: [[number, number], [number, number]];
    rowLabels: ['Actual Normal', 'Actual Defective'];
    colLabels: ['Predicted Normal', 'Predicted Defective'];
  };
  sampleItems: {
    imageId: string;
    filename: string;
    relativePath: string;
    actualLabel: 'Normal' | 'Defective';
    predictedClass: 'Normal' | 'Defective';
    confidence: number;
    defectProbability: number;
    isCorrect: boolean;
  }[];
  modelLimitationsNote: string;
}

export interface AnalyticsOverview {
  totalInspections: number;
  completedInspections: number;
  normalCount: number;
  defectiveCount: number;
  defectRate: number;
  rejectedCount: number;
  failedCount: number;
  pendingInspections: number;
  pendingReviews: number;
  confirmedReviews: number;
  correctedReviews: number;
  totalBatches: number;
  activeProduct: string;
}
