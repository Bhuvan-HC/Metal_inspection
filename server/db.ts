import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export type UserRole = 'ENGINEER' | 'SUPERVISOR' | 'ADMIN';

export interface User {
  id: string;
  username: string;
  email: string;
  role: UserRole;
  passwordHash: string;
  isActive: boolean;
  createdAt: string;
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
  imagePath: string; // url or relative path
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

interface DatabaseSchema {
  users: User[];
  products: Product[];
  batches: InspectionBatch[];
  inspections: Inspection[];
  reviews: InspectionReview[];
  auditLogs: AuditLog[];
  sessions?: Record<string, { userId: string; role: UserRole; expiresAt: number }>;
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password + '_inspectai_salt').digest('hex');
}

class Database {
  private data: DatabaseSchema;

  constructor() {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    if (fs.existsSync(DB_FILE)) {
      try {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        this.data = JSON.parse(raw);
      } catch (err) {
        console.error('Failed to load database, resetting:', err);
        this.data = this.getDefaultData();
        this.save();
      }
    } else {
      this.data = this.getDefaultData();
      this.save();
    }
  }

  private getDefaultData(): DatabaseSchema {
    const now = new Date().toISOString();
    return {
      users: [
        {
          id: 'user-admin-1',
          username: 'admin',
          email: 'admin@inspectai.local',
          role: 'ADMIN',
          passwordHash: hashPassword('Admin@123'),
          isActive: true,
          createdAt: now,
        },
        {
          id: 'user-super-1',
          username: 'supervisor',
          email: 'supervisor@inspectai.local',
          role: 'SUPERVISOR',
          passwordHash: hashPassword('Super@123'),
          isActive: true,
          createdAt: now,
        },
        {
          id: 'user-eng-1',
          username: 'engineer',
          email: 'engineer@inspectai.local',
          role: 'ENGINEER',
          passwordHash: hashPassword('Inspect@123'),
          isActive: true,
          createdAt: now,
        },
      ],
      products: [
        {
          id: 'prod-plate-01',
          productId: 'P-PLATE01',
          name: 'Demonstration metal plate',
          description: 'Synthetic centered plate with scratches or pits.',
          isActive: true,
          createdAt: now,
        },
      ],
      batches: [],
      inspections: [],
      reviews: [],
      auditLogs: [],
    };
  }

  public save(): void {
    try {
      const tempPath = DB_FILE + '.tmp';
      fs.writeFileSync(tempPath, JSON.stringify(this.data, null, 2), 'utf-8');
      fs.renameSync(tempPath, DB_FILE);
    } catch (err) {
      console.error('Error saving db.json:', err);
    }
  }

  // Users
  public getUsers(): User[] {
    return this.data.users;
  }

  public findUserById(id: string): User | undefined {
    return this.data.users.find((u) => u.id === id);
  }

  public findUserByUsername(username: string): User | undefined {
    return this.data.users.find((u) => u.username.toLowerCase() === username.toLowerCase());
  }

  public verifyPassword(user: User, password: string): boolean {
    return user.passwordHash === hashPassword(password);
  }

  // Products
  public getProducts(): Product[] {
    return this.data.products.filter((p) => p.isActive);
  }

  public findProductByCode(productId: string): Product | undefined {
    return this.data.products.find((p) => p.productId === productId);
  }

  public createProduct(product: Omit<Product, 'id' | 'createdAt'>): Product {
    const newProduct: Product = {
      ...product,
      id: 'prod-' + crypto.randomUUID().slice(0, 8),
      createdAt: new Date().toISOString(),
    };
    this.data.products.push(newProduct);
    this.save();
    return newProduct;
  }

  // Batches
  public getBatches(): InspectionBatch[] {
    return [...this.data.batches].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  public findBatchById(batchId: string): InspectionBatch | undefined {
    return this.data.batches.find((b) => b.batchId === batchId || b.id === batchId);
  }

  public createBatch(batch: Omit<InspectionBatch, 'id' | 'createdAt'>): InspectionBatch {
    const newBatch: InspectionBatch = {
      ...batch,
      id: 'batch-' + crypto.randomUUID().slice(0, 8),
      createdAt: new Date().toISOString(),
    };
    this.data.batches.push(newBatch);
    this.save();
    return newBatch;
  }

  public updateBatch(batchId: string, updates: Partial<InspectionBatch>): InspectionBatch | undefined {
    const index = this.data.batches.findIndex((b) => b.batchId === batchId || b.id === batchId);
    if (index === -1) return undefined;
    this.data.batches[index] = { ...this.data.batches[index], ...updates };
    this.save();
    return this.data.batches[index];
  }

  // Inspections
  public getInspections(): Inspection[] {
    return [...this.data.inspections].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  public findInspectionById(id: string): Inspection | undefined {
    return this.data.inspections.find((i) => i.inspectionId === id || i.id === id);
  }

  public findInspectionsByBatchId(batchId: string): Inspection[] {
    return this.data.inspections.filter((i) => i.batchId === batchId);
  }

  public createInspection(inspection: Omit<Inspection, 'id' | 'createdAt'> & { createdAt?: string }): Inspection {
    const newInspection: Inspection = {
      ...inspection,
      id: 'insp-' + crypto.randomUUID().slice(0, 8),
      createdAt: inspection.createdAt || new Date().toISOString(),
    };
    this.data.inspections.push(newInspection);
    this.save();
    return newInspection;
  }

  public updateInspection(id: string, updates: Partial<Inspection>): Inspection | undefined {
    const index = this.data.inspections.findIndex((i) => i.inspectionId === id || i.id === id);
    if (index === -1) return undefined;
    this.data.inspections[index] = { ...this.data.inspections[index], ...updates };
    this.save();
    return this.data.inspections[index];
  }

  // Reviews
  public getReviews(): InspectionReview[] {
    return [...this.data.reviews].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  public findReviewsByInspectionId(inspectionId: string): InspectionReview[] {
    return this.data.reviews.filter((r) => r.inspectionId === inspectionId);
  }

  public createReview(review: Omit<InspectionReview, 'id' | 'createdAt'>): InspectionReview {
    const newReview: InspectionReview = {
      ...review,
      id: 'rev-' + crypto.randomUUID().slice(0, 8),
      createdAt: new Date().toISOString(),
    };
    this.data.reviews.push(newReview);
    this.save();
    return newReview;
  }

  // Audit Logs
  public getAuditLogs(): AuditLog[] {
    return [...this.data.auditLogs].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  public addAuditLog(log: Omit<AuditLog, 'id' | 'createdAt'>): AuditLog {
    const newLog: AuditLog = {
      ...log,
      id: 'audit-' + crypto.randomUUID().slice(0, 8),
      createdAt: new Date().toISOString(),
    };
    this.data.auditLogs.push(newLog);
    this.save();
    return newLog;
  }

  // Sessions
  public createSession(token: string, session: { userId: string; role: UserRole; expiresAt: number }): void {
    if (!this.data.sessions) this.data.sessions = {};
    this.data.sessions[token] = session;
    this.save();
  }

  public getSession(token: string): { userId: string; role: UserRole; expiresAt: number } | undefined {
    if (!this.data.sessions) return undefined;
    const session = this.data.sessions[token];
    if (session && session.expiresAt < Date.now()) {
      delete this.data.sessions[token];
      this.save();
      return undefined;
    }
    return session;
  }

  public deleteSession(token: string): void {
    if (this.data.sessions && this.data.sessions[token]) {
      delete this.data.sessions[token];
      this.save();
    }
  }

  // Check if initial samples preloaded
  public hasPreloadedSamples(): boolean {
    return this.data.inspections.some((i) => i.inspectionId.startsWith('INSP-SAMPLE-'));
  }
}

export const db = new Database();
