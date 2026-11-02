import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import multer from 'multer';
import { db, UserRole } from './server/db.js';
import { AIService } from './server/ai-service.js';
import { inspectionQueue } from './server/queue.js';
import { EvaluationService } from './server/evaluation-service.js';
import { bootstrapDatabase } from './server/bootstrap.js';

const app = express();
// The dev server must always listen on port 3000 (nginx reverse proxies from 8080 to 3000)
const PORT = 3000;

// CORS headers
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Body parsing (allow base64 webcam frames up to 25MB)
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

// Storage config for uploaded inspection images
const uploadsDir = path.resolve(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Static image routes
app.use('/uploads', express.static(uploadsDir));
app.use('/samples', express.static(path.resolve(process.cwd(), 'public/samples')));

// Multer storage
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    const unique = crypto.randomUUID().slice(0, 12);
    cb(null, `upload_${Date.now()}_${unique}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit on upload pipe (validator will enforce 5MB)
  },
});

// Auth Middleware
function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthenticated. Valid Bearer token required.' });
  }

  const token = authHeader.split(' ')[1];
  const session = db.getSession(token);

  if (!session || session.expiresAt < Date.now()) {
    return res.status(401).json({ error: 'Session expired or invalid. Please log in again.' });
  }

  const user = db.findUserById(session.userId);
  if (!user || !user.isActive) {
    return res.status(401).json({ error: 'User account not active.' });
  }

  (req as any).user = user;
  next();
}

// Role Guard Middleware
function requireRole(...roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;
    if (!user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!roles.includes(user.role)) {
      db.addAuditLog({
        actorId: user.id,
        actorUsername: user.username,
        actorRole: user.role,
        action: 'ACCESS_DENIED_FORBIDDEN',
        resourceType: 'API_ENDPOINT',
        resourceId: req.path,
        details: `Role ${user.role} attempted access to restricted endpoint: ${req.path}`,
      });

      return res.status(403).json({
        error: `Permission denied: ${user.role} role cannot perform this operation. Required: ${roles.join(' or ')}.`,
      });
    }

    next();
  };
}

// ==========================================
// REST API ROUTES (/api/v1/*)
// ==========================================

// --- AUTH ---
app.post('/api/v1/auth/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  const user = db.findUserByUsername(username);
  if (!user || !db.verifyPassword(user, password)) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }

  const token = crypto.randomUUID();
  // Session valid for 24 hours
  db.createSession(token, {
    userId: user.id,
    role: user.role,
    expiresAt: Date.now() + 24 * 60 * 60 * 1000,
  });

  db.addAuditLog({
    actorId: user.id,
    actorUsername: user.username,
    actorRole: user.role,
    action: 'USER_LOGIN',
    resourceType: 'USER',
    resourceId: user.id,
    details: `User ${user.username} logged in with role ${user.role}`,
  });

  return res.json({
    token,
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
    },
  });
});

app.post('/api/v1/auth/logout', authMiddleware, (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (token) {
    db.deleteSession(token);
  }
  return res.json({ success: true, message: 'Logged out successfully' });
});

app.get('/api/v1/auth/me', authMiddleware, (req, res) => {
  const user = (req as any).user;
  return res.json({
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
    },
  });
});

// --- PRODUCTS ---
app.get('/api/v1/products', authMiddleware, (_req, res) => {
  const products = db.getProducts();
  return res.json(products);
});

app.get('/api/v1/products/:id', authMiddleware, (req, res) => {
  const product = db.findProductByCode(req.params.id);
  if (!product) {
    return res.status(404).json({ error: 'Product not found' });
  }
  return res.json(product);
});

app.post('/api/v1/products', authMiddleware, requireRole('ADMIN', 'SUPERVISOR'), (req, res) => {
  const { productId, name, description } = req.body;
  if (!productId || !name) {
    return res.status(400).json({ error: 'Product ID and name are required' });
  }

  const existing = db.findProductByCode(productId);
  if (existing) {
    return res.status(409).json({ error: `Product ID ${productId} is already registered` });
  }

  const user = (req as any).user;
  const created = db.createProduct({
    productId,
    name,
    description: description || '',
    isActive: true,
  });

  db.addAuditLog({
    actorId: user.id,
    actorUsername: user.username,
    actorRole: user.role,
    action: 'PRODUCT_CREATED',
    resourceType: 'PRODUCT',
    resourceId: created.productId,
    details: `Product ${created.name} (${created.productId}) registered`,
  });

  return res.status(201).json(created);
});

// --- SINGLE INSPECTION ---
app.post('/api/v1/inspections', authMiddleware, upload.single('image'), async (req, res) => {
  const user = (req as any).user;
  const file = req.file;
  const productId = req.body.productId || 'P-PLATE01';

  if (!file) {
    return res.status(400).json({ error: 'No image file uploaded' });
  }

  const inspectionId = `INSP-${Date.now().toString().slice(-6)}-${crypto.randomUUID().slice(0, 4).toUpperCase()}`;

  // 1. Image validation
  const validation = AIService.validateImageFile(file.path);

  if (!validation.isValid) {
    const created = db.createInspection({
      inspectionId,
      productId,
      uploadedBy: user.id,
      uploaderUsername: user.username,
      originalFilename: file.originalname,
      imagePath: `/uploads/${file.filename}`,
      imageSha256: validation.sha256 || '',
      status: 'REJECTED',
      errorMessage: validation.error || 'Validation failed',
      completedAt: new Date().toISOString(),
    });

    db.addAuditLog({
      actorId: user.id,
      actorUsername: user.username,
      actorRole: user.role,
      action: 'INSPECTION_REJECTED',
      resourceType: 'INSPECTION',
      resourceId: inspectionId,
      details: `File ${file.originalname} rejected: ${validation.error}`,
    });

    return res.status(422).json({
      inspection: created,
      validation,
      error: validation.error,
    });
  }

  // Component presence check if requested (e.g. from camera detection)
  if (req.body.requireComponentPresence === 'true') {
    const presence = await AIService.detectComponentPresence(file.path);
    if (!presence.component_detected) {
      return res.status(422).json({
        componentDetected: false,
        error: 'Component Not Found! Please Place the Component',
        message: 'Please Place the Component',
      });
    }
  }

  // 2. Perform real model inference
  try {
    const prediction = await AIService.predictImage(file.path);

    let localizationData: any = undefined;
    let annotatedImagePath: string | undefined = undefined;

    if (prediction.predicted_class === 'Defective') {
      const annotatedFilename = `annotated_${file.filename}`;
      const annotatedFullPath = path.join(uploadsDir, annotatedFilename);
      const loc = await AIService.localizeDefect(file.path, annotatedFullPath);
      localizationData = loc;
      if (loc.annotatedImageUrl) {
        annotatedImagePath = loc.annotatedImageUrl;
      }
    } else {
      localizationData = {
        available: false,
        reason: 'Normal Specimen — No Defects Detected',
        defectCount: 0,
        regions: [],
      };
    }

    const created = db.createInspection({
      inspectionId,
      productId,
      uploadedBy: user.id,
      uploaderUsername: user.username,
      originalFilename: file.originalname,
      imagePath: `/uploads/${file.filename}`,
      imageSha256: validation.sha256 || '',
      status: 'COMPLETED',
      predictedClass: prediction.predicted_class,
      confidence: prediction.confidence,
      defectProbability: prediction.defect_probability,
      modelVersion: prediction.model_version,
      localization: localizationData,
      annotatedImagePath,
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
    });

    db.addAuditLog({
      actorId: user.id,
      actorUsername: user.username,
      actorRole: user.role,
      action: 'INSPECTION_COMPLETED',
      resourceType: 'INSPECTION',
      resourceId: inspectionId,
      details: `Prediction: ${prediction.predicted_class} (${(prediction.confidence * 100).toFixed(1)}%)`,
    });

    return res.status(201).json({
      inspection: created,
      validation,
      prediction,
      localization: localizationData,
    });
  } catch (err: any) {
    const created = db.createInspection({
      inspectionId,
      productId,
      uploadedBy: user.id,
      uploaderUsername: user.username,
      originalFilename: file.originalname,
      imagePath: `/uploads/${file.filename}`,
      imageSha256: validation.sha256 || '',
      status: 'FAILED',
      errorMessage: err.message || 'Inference failure',
      completedAt: new Date().toISOString(),
    });

    return res.status(500).json({
      inspection: created,
      error: err.message,
    });
  }
});

// --- COMPONENT PRESENCE DETECTION ENDPOINT ---
app.post('/api/v1/inspections/detect-component', authMiddleware, upload.single('image'), async (req, res) => {
  const file = req.file;
  if (!file) {
    return res.status(400).json({ error: 'No image file uploaded' });
  }

  try {
    const presence = await AIService.detectComponentPresence(file.path);
    return res.json(presence);
  } catch (err: any) {
    return res.status(500).json({
      component_detected: false,
      product_id: 'P-PLATE01',
      message: 'Component Not Found! Please Place the Component',
      error: err.message,
    });
  }
});

// --- LIVE CAMERA FRAME INFERENCE ENDPOINT ---
app.post('/api/v1/inspections/live-detect', authMiddleware, upload.single('frame'), async (req, res) => {
  try {
    let frameInput: Buffer | string | undefined;

    if (req.file) {
      frameInput = fs.readFileSync(req.file.path);
      try {
        fs.unlinkSync(req.file.path);
      } catch {}
    } else if (req.body && req.body.frame) {
      frameInput = req.body.frame;
    }

    if (!frameInput) {
      return res.status(400).json({ error: 'No video frame data provided' });
    }

    const result = await AIService.detectLiveFrame(frameInput);
    return res.json(result);
  } catch (err: any) {
    console.error('Error in /live-detect endpoint:', err);
    return res.status(500).json({
      plate_detected: false,
      product_id: 'P-PLATE01',
      status: 'METAL PLATE NOT FOUND!',
      message: 'PLEASE PLACE THE METAL PLATE',
      detail: err.message,
      regions: [],
    });
  }
});

// --- INSPECTIONS LIST & DETAILS ---
app.get('/api/v1/inspections', authMiddleware, (req, res) => {
  const user = (req as any).user;
  const {
    productId,
    predictedClass,
    status,
    reviewStatus,
    personal,
    search,
  } = req.query;

  let records = db.getInspections();

  // Strict role isolation: Engineers can ONLY view their own inspections
  if (user.role === 'ENGINEER') {
    records = records.filter((r) => r.uploadedBy === user.id);
  }

  if (productId) {
    records = records.filter((r) => r.productId === String(productId));
  }

  if (predictedClass && predictedClass !== 'ALL') {
    records = records.filter((r) => r.predictedClass === String(predictedClass));
  }

  if (status && status !== 'ALL') {
    records = records.filter((r) => r.status === String(status));
  }

  if (search) {
    const q = String(search).toLowerCase();
    records = records.filter(
      (r) =>
        r.inspectionId.toLowerCase().includes(q) ||
        r.originalFilename.toLowerCase().includes(q) ||
        r.uploaderUsername.toLowerCase().includes(q)
    );
  }

  // Attach latest review to each record
  const enriched = records.map((r) => {
    const reviews = db.findReviewsByInspectionId(r.inspectionId);
    const latestReview = reviews[0] || null;
    return {
      ...r,
      latestReview,
      reviewStatus: latestReview ? latestReview.decision : 'UNREVIEWED',
    };
  });

  // Filter by reviewStatus
  let filtered = enriched;
  if (reviewStatus && reviewStatus !== 'ALL') {
    filtered = enriched.filter((r) => r.reviewStatus === String(reviewStatus));
  }

  return res.json(filtered);
});

app.get('/api/v1/inspections/:id', authMiddleware, (req, res) => {
  const inspection = db.findInspectionById(req.params.id);
  if (!inspection) {
    return res.status(404).json({ error: 'Inspection record not found' });
  }

  const reviews = db.findReviewsByInspectionId(inspection.inspectionId);
  const product = db.findProductByCode(inspection.productId);

  return res.json({
    ...inspection,
    product,
    reviews,
    latestReview: reviews[0] || null,
  });
});

// --- BATCH INSPECTIONS ---
app.post('/api/v1/batches', authMiddleware, upload.array('images', 20), (req, res) => {
  const user = (req as any).user;
  const files = req.files as Express.Multer.File[];
  const productId = req.body.productId || 'P-PLATE01';

  if (!files || files.length === 0) {
    return res.status(400).json({ error: 'No image files uploaded in batch' });
  }

  if (files.length > 20) {
    return res.status(400).json({ error: 'Batch upload limit exceeded: Maximum 20 images allowed per batch' });
  }

  const batchId = `BATCH-${Date.now().toString().slice(-6)}-${crypto.randomUUID().slice(0, 4).toUpperCase()}`;

  const batch = db.createBatch({
    batchId,
    productId,
    uploadedBy: user.id,
    uploaderUsername: user.username,
    totalFiles: files.length,
    acceptedFiles: 0,
    rejectedFiles: 0,
    completedFiles: 0,
    failedFiles: 0,
    status: 'PENDING',
  });

  const createdItems = [];
  const queueItems = [];

  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    const inspectionId = `${batchId}-ITEM-${String(i + 1).padStart(2, '0')}`;

    const item = db.createInspection({
      inspectionId,
      batchId,
      productId,
      uploadedBy: user.id,
      uploaderUsername: user.username,
      originalFilename: f.originalname,
      imagePath: `/uploads/${f.filename}`,
      imageSha256: '',
      status: 'PENDING',
    });

    createdItems.push(item);
    queueItems.push({
      inspectionId: item.inspectionId,
      batchId,
      filePath: f.path,
    });
  }

  // Dispatch to background queue
  inspectionQueue.enqueueBatch(queueItems);

  db.addAuditLog({
    actorId: user.id,
    actorUsername: user.username,
    actorRole: user.role,
    action: 'BATCH_SUBMITTED',
    resourceType: 'BATCH',
    resourceId: batchId,
    details: `Submitted batch of ${files.length} images for asynchronous processing`,
  });

  return res.status(202).json({
    batch,
    items: createdItems,
  });
});

app.get('/api/v1/batches', authMiddleware, (_req, res) => {
  const batches = db.getBatches();
  return res.json(batches);
});

app.get('/api/v1/batches/:id', authMiddleware, (req, res) => {
  const batch = db.findBatchById(req.params.id);
  if (!batch) {
    return res.status(404).json({ error: 'Batch not found' });
  }

  const items = db.findInspectionsByBatchId(batch.batchId);
  return res.json({
    batch,
    items,
  });
});

app.get('/api/v1/batches/:id/status', authMiddleware, (req, res) => {
  const batch = db.findBatchById(req.params.id);
  if (!batch) {
    return res.status(404).json({ error: 'Batch not found' });
  }

  const items = db.findInspectionsByBatchId(batch.batchId);
  return res.json({
    batchId: batch.batchId,
    status: batch.status,
    totalFiles: batch.totalFiles,
    acceptedFiles: batch.acceptedFiles,
    rejectedFiles: batch.rejectedFiles,
    completedFiles: batch.completedFiles,
    failedFiles: batch.failedFiles,
    completedAt: batch.completedAt,
    items: items.map((it) => ({
      inspectionId: it.inspectionId,
      originalFilename: it.originalFilename,
      status: it.status,
      predictedClass: it.predictedClass,
      confidence: it.confidence,
      errorMessage: it.errorMessage,
    })),
  });
});

// --- SUPERVISOR REVIEWS (STRICT 403 ENFORCEMENT) ---
app.post(
  '/api/v1/inspections/:id/review',
  authMiddleware,
  requireRole('SUPERVISOR', 'ADMIN'),
  (req, res) => {
    const inspection = db.findInspectionById(req.params.id);
    if (!inspection) {
      return res.status(404).json({ error: 'Inspection record not found' });
    }

    const { decision, reviewedClass, comments } = req.body;
    if (!decision || !['CONFIRMED', 'CORRECTED'].includes(decision)) {
      return res.status(400).json({ error: "Decision must be either 'CONFIRMED' or 'CORRECTED'" });
    }

    if (!reviewedClass || !['Normal', 'Defective'].includes(reviewedClass)) {
      return res.status(400).json({ error: "Reviewed class must be 'Normal' or 'Defective'" });
    }

    const user = (req as any).user;
    const review = db.createReview({
      inspectionId: inspection.inspectionId,
      reviewedBy: user.id,
      reviewerUsername: user.username,
      originalPredictedClass: inspection.predictedClass || 'Normal',
      reviewedClass,
      decision,
      comments: comments || '',
    });

    db.addAuditLog({
      actorId: user.id,
      actorUsername: user.username,
      actorRole: user.role,
      action: decision === 'CONFIRMED' ? 'REVIEW_CONFIRMED' : 'REVIEW_CORRECTED',
      resourceType: 'INSPECTION_REVIEW',
      resourceId: review.id,
      details: `Supervisor ${user.username} marked ${decision}: AI=${inspection.predictedClass}, Reviewed=${reviewedClass}`,
    });

    return res.status(201).json(review);
  }
);

app.get('/api/v1/inspections/:id/reviews', authMiddleware, (req, res) => {
  const reviews = db.findReviewsByInspectionId(req.params.id);
  return res.json(reviews);
});

app.get('/api/v1/reviews', authMiddleware, requireRole('SUPERVISOR', 'ADMIN'), (_req, res) => {
  const reviews = db.getReviews();
  return res.json(reviews);
});

// --- SUPERVISOR BATCH REVIEW ---
app.post(
  '/api/v1/batches/:id/review',
  authMiddleware,
  requireRole('SUPERVISOR', 'ADMIN'),
  (req, res) => {
    const batch = db.findBatchById(req.params.id);
    if (!batch) {
      return res.status(404).json({ error: 'Batch not found' });
    }

    const { decision, comments, itemReviews } = req.body;
    if (!decision || !['CONFIRMED', 'CORRECTED'].includes(decision)) {
      return res.status(400).json({ error: "Batch decision must be either 'CONFIRMED' or 'CORRECTED'" });
    }

    const user = (req as any).user;
    const updated = db.updateBatch(batch.batchId, {
      reviewStatus: decision,
      reviewedBy: user.id,
      reviewerUsername: user.username,
      reviewComments: comments || '',
      reviewedAt: new Date().toISOString(),
    });

    // Optionally apply reviews to individual items in the batch
    if (Array.isArray(itemReviews)) {
      for (const itemRev of itemReviews) {
        if (itemRev.inspectionId && itemRev.reviewedClass) {
          const item = db.findInspectionById(itemRev.inspectionId);
          if (item) {
            db.createReview({
              inspectionId: item.inspectionId,
              reviewedBy: user.id,
              reviewerUsername: user.username,
              originalPredictedClass: item.predictedClass || 'Normal',
              reviewedClass: itemRev.reviewedClass,
              decision: itemRev.reviewedClass === item.predictedClass ? 'CONFIRMED' : 'CORRECTED',
              comments: itemRev.comments || comments || '',
            });
          }
        }
      }
    }

    db.addAuditLog({
      actorId: user.id,
      actorUsername: user.username,
      actorRole: user.role,
      action: 'BATCH_REVIEWED',
      resourceType: 'BATCH',
      resourceId: batch.batchId,
      details: `Supervisor ${user.username} marked batch ${batch.batchId} as ${decision}`,
    });

    return res.json(updated);
  }
);

// --- QUALITY ANALYTICS ---
app.get('/api/v1/analytics/overview', authMiddleware, (req, res) => {
  const user = (req as any).user;
  let inspections = db.getInspections();
  if (user && user.role === 'ENGINEER') {
    inspections = inspections.filter((i) => i.uploadedBy === user.id);
  }
  const reviews = db.getReviews();
  const batches = db.getBatches();

  const total = inspections.length;
  const normal = inspections.filter((i) => i.predictedClass === 'Normal').length;
  const defective = inspections.filter((i) => i.predictedClass === 'Defective').length;
  const completed = inspections.filter((i) => i.status === 'COMPLETED').length;
  const rejected = inspections.filter((i) => i.status === 'REJECTED').length;
  const failed = inspections.filter((i) => i.status === 'FAILED').length;
  const pending = inspections.filter((i) => i.status === 'PENDING' || i.status === 'PROCESSING').length;

  const reviewedIds = new Set(reviews.map((r) => r.inspectionId));
  const pendingReviews = inspections.filter((i) => i.status === 'COMPLETED' && !reviewedIds.has(i.inspectionId)).length;
  const confirmed = reviews.filter((r) => r.decision === 'CONFIRMED').length;
  const corrected = reviews.filter((r) => r.decision === 'CORRECTED').length;

  return res.json({
    totalInspections: total,
    completedInspections: completed,
    normalCount: normal,
    defectiveCount: defective,
    defectRate: total > 0 ? (defective / total) * 100 : 0,
    rejectedCount: rejected,
    failedCount: failed,
    pendingInspections: pending,
    pendingReviews,
    confirmedReviews: confirmed,
    correctedReviews: corrected,
    totalBatches: batches.length,
    activeProduct: 'P-PLATE01',
  });
});

app.get('/api/v1/analytics/trends', authMiddleware, (_req, res) => {
  const inspections = db.getInspections();
  const dayMap: Record<string, { date: string; normal: number; defective: number; total: number }> = {};

  for (const i of inspections) {
    const day = i.createdAt ? i.createdAt.slice(0, 10) : '2026-11-02';
    if (!dayMap[day]) {
      dayMap[day] = { date: day, normal: 0, defective: 0, total: 0 };
    }
    dayMap[day].total++;
    if (i.predictedClass === 'Defective') dayMap[day].defective++;
    else if (i.predictedClass === 'Normal') dayMap[day].normal++;
  }

  const trends = Object.values(dayMap).sort((a, b) => a.date.localeCompare(b.date));
  return res.json(trends);
});

// --- MODEL EVALUATION & INTEGRITY ---
app.get('/api/v1/evaluation/results', authMiddleware, async (_req, res) => {
  try {
    const results = await EvaluationService.runEvaluation();
    return res.json(results);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.post('/api/v1/evaluation/run', authMiddleware, async (_req, res) => {
  try {
    const results = await EvaluationService.runEvaluation();
    return res.json(results);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.get('/api/v1/model/integrity', authMiddleware, (_req, res) => {
  const integrity = AIService.verifyModelIntegrity();
  return res.json({
    ...integrity,
    modelVersion: 'BIT-PLATE-CV-1.0',
    productId: 'P-PLATE01',
    decisionThreshold: 0.5,
  });
});

// --- AUDIT LOGS ---
app.get('/api/v1/audit-logs', authMiddleware, requireRole('SUPERVISOR', 'ADMIN'), (_req, res) => {
  const logs = db.getAuditLogs();
  return res.json(logs);
});

// ==========================================
// VITE SPA DEV MIDDLEWARE / STATIC BUNDLE
// ==========================================
async function startServer() {
  // Initialize and preload 60 evaluation samples
  await bootstrapDatabase();

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, () => {
    console.log(`InspectAI backend server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Fatal error starting server:', err);
  process.exit(1);
});
