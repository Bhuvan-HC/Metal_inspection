import {
  User,
  Product,
  Inspection,
  InspectionBatch,
  InspectionReview,
  AuditLog,
  EvaluationMetrics,
  AnalyticsOverview,
} from '../types';

const API_BASE = '/api/v1';

function getAuthHeaders(): HeadersInit {
  const token = localStorage.getItem('inspectai_token') || sessionStorage.getItem('inspectai_token');
  const headers: HeadersInit = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

export const api = {
  // Auth
  async login(username: string, password: string): Promise<{ token: string; user: User }> {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Login failed' }));
      throw new Error(err.error || 'Login failed');
    }
    return res.json();
  },

  async logout(): Promise<void> {
    await fetch(`${API_BASE}/auth/logout`, {
      method: 'POST',
      headers: getAuthHeaders(),
    }).catch(() => {});
    localStorage.removeItem('inspectai_token');
    sessionStorage.removeItem('inspectai_token');
  },

  async getMe(): Promise<{ user: User }> {
    const res = await fetch(`${API_BASE}/auth/me`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) {
      throw new Error('Unauthorized');
    }
    return res.json();
  },

  // Products
  async getProducts(): Promise<Product[]> {
    const res = await fetch(`${API_BASE}/products`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch products');
    return res.json();
  },

  async createProduct(data: { productId: string; name: string; description: string }): Promise<Product> {
    const res = await fetch(`${API_BASE}/products`, {
      method: 'POST',
      headers: {
        ...getAuthHeaders(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to create product' }));
      throw new Error(err.error || 'Failed to create product');
    }
    return res.json();
  },

  // Inspections
  async createInspection(formData: FormData): Promise<{
    inspection: Inspection;
    validation: any;
    prediction?: any;
    localization?: any;
    error?: string;
  }> {
    const res = await fetch(`${API_BASE}/inspections`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: formData,
    });
    if (res.status === 401) {
      localStorage.removeItem('inspectai_token');
      sessionStorage.removeItem('inspectai_token');
      throw new Error('Session expired or unauthenticated. Please sign in again.');
    }
    const data = await res.json().catch(() => ({ error: 'Failed to process inspection' }));
    if (!res.ok && res.status !== 422) {
      throw new Error(data.error || 'Failed to process inspection');
    }
    return data;
  },

  async detectComponentPresence(formData: FormData): Promise<{
    component_detected: boolean;
    product_id: string;
    message: string;
    center_mean?: number;
    contrast?: number;
  }> {
    const res = await fetch(`${API_BASE}/inspections/detect-component`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Component detection check failed' }));
      throw new Error(err.error || 'Component detection check failed');
    }
    return res.json();
  },

  async detectLiveFrame(frameBase64: string): Promise<{
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
    const res = await fetch(`${API_BASE}/inspections/live-detect`, {
      method: 'POST',
      headers: {
        ...getAuthHeaders(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ frame: frameBase64, productId: 'P-PLATE01' }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Live detection failed' }));
      throw new Error(err.detail || err.error || 'Live detection failed');
    }
    return res.json();
  },

  async getInspections(params: {
    productId?: string;
    predictedClass?: string;
    status?: string;
    reviewStatus?: string;
    personal?: boolean;
    search?: string;
  } = {}): Promise<Inspection[]> {
    const query = new URLSearchParams();
    if (params.productId) query.append('productId', params.productId);
    if (params.predictedClass) query.append('predictedClass', params.predictedClass);
    if (params.status) query.append('status', params.status);
    if (params.reviewStatus) query.append('reviewStatus', params.reviewStatus);
    if (params.personal) query.append('personal', 'true');
    if (params.search) query.append('search', params.search);

    const res = await fetch(`${API_BASE}/inspections?${query.toString()}`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch inspections');
    return res.json();
  },

  async getInspectionById(id: string): Promise<Inspection & { product?: Product; reviews: InspectionReview[] }> {
    const res = await fetch(`${API_BASE}/inspections/${id}`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Inspection record not found');
    return res.json();
  },

  // Batches
  async createBatch(formData: FormData): Promise<{ batch: InspectionBatch; items: Inspection[] }> {
    const res = await fetch(`${API_BASE}/batches`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to create batch' }));
      throw new Error(err.error || 'Failed to create batch');
    }
    return res.json();
  },

  async getBatches(): Promise<InspectionBatch[]> {
    const res = await fetch(`${API_BASE}/batches`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch batches');
    return res.json();
  },

  async getBatchById(id: string): Promise<{ batch: InspectionBatch; items: Inspection[] }> {
    const res = await fetch(`${API_BASE}/batches/${id}`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Batch not found');
    return res.json();
  },

  async getBatchStatus(id: string): Promise<{
    batchId: string;
    status: string;
    totalFiles: number;
    acceptedFiles: number;
    rejectedFiles: number;
    completedFiles: number;
    failedFiles: number;
    completedAt?: string;
    items: {
      inspectionId: string;
      originalFilename: string;
      status: string;
      predictedClass?: string;
      confidence?: number;
      errorMessage?: string;
    }[];
  }> {
    const res = await fetch(`${API_BASE}/batches/${id}/status`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch batch status');
    return res.json();
  },

  // Supervisor Reviews
  async submitReview(
    inspectionId: string,
    data: {
      decision: 'CONFIRMED' | 'CORRECTED';
      reviewedClass: 'Normal' | 'Defective';
      comments: string;
    }
  ): Promise<InspectionReview> {
    const res = await fetch(`${API_BASE}/inspections/${inspectionId}/review`, {
      method: 'POST',
      headers: {
        ...getAuthHeaders(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to submit review' }));
      throw new Error(err.error || `HTTP ${res.status}: Failed to submit review`);
    }
    return res.json();
  },

  async submitBatchReview(
    batchId: string,
    data: {
      decision: 'CONFIRMED' | 'CORRECTED';
      comments: string;
      itemReviews?: Array<{
        inspectionId: string;
        reviewedClass: 'Normal' | 'Defective';
        comments?: string;
      }>;
    }
  ): Promise<InspectionBatch> {
    const res = await fetch(`${API_BASE}/batches/${batchId}/review`, {
      method: 'POST',
      headers: {
        ...getAuthHeaders(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to submit batch review' }));
      throw new Error(err.error || `HTTP ${res.status}: Failed to submit batch review`);
    }
    return res.json();
  },

  async getAllReviews(): Promise<InspectionReview[]> {
    const res = await fetch(`${API_BASE}/reviews`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) {
      if (res.status === 403) {
        throw new Error('403: Only supervisors can view review records');
      }
      throw new Error('Failed to fetch reviews');
    }
    return res.json();
  },

  // Analytics
  async getAnalyticsOverview(): Promise<AnalyticsOverview> {
    const res = await fetch(`${API_BASE}/analytics/overview`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch analytics overview');
    return res.json();
  },

  async getAnalyticsTrends(): Promise<{ date: string; normal: number; defective: number; total: number }[]> {
    const res = await fetch(`${API_BASE}/analytics/trends`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch analytics trends');
    return res.json();
  },

  // Evaluation
  async getEvaluationResults(): Promise<EvaluationMetrics> {
    const res = await fetch(`${API_BASE}/evaluation/results`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to fetch evaluation results' }));
      throw new Error(err.error || 'Failed to fetch evaluation results');
    }
    return res.json();
  },

  async runEvaluation(): Promise<EvaluationMetrics> {
    const res = await fetch(`${API_BASE}/evaluation/run`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to run evaluation' }));
      throw new Error(err.error || 'Failed to run evaluation');
    }
    return res.json();
  },

  // Model & Audit
  async getModelIntegrity(): Promise<{ verified: boolean; details: Record<string, boolean>; modelVersion: string; productId: string; decisionThreshold: number }> {
    const res = await fetch(`${API_BASE}/model/integrity`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch model integrity');
    return res.json();
  },

  async getAuditLogs(): Promise<AuditLog[]> {
    const res = await fetch(`${API_BASE}/audit-logs`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch audit logs');
    return res.json();
  },
};
