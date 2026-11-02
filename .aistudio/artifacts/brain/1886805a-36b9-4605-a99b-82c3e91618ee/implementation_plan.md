# InspectAI — AI-Powered Visual Quality Inspection & Traceability Platform

InspectAI is a high-performance visual quality inspection, traceability, and supervisor review platform designed for high-precision manufacturing. It executes real computer vision inference using the provided frozen logistic regression model (`BIT-PLATE-CV-1.0`), provides asynchronous batch image processing with item-level tracking, enforces strict role-based permissions, and preserves immutable audit and review histories.

## User Review & Critical Decisions

> [!IMPORTANT]
> The following architectural parameters have been confirmed based on user feedback and contest requirements:

- **Confirmed Decision 1: Authentication & Role Discipline**: Strict login and logout workflow without a demo quick-switcher. Backend enforces real session/token validation with HTTP 401 for unauthenticated access and HTTP 403 for unauthorized actions (e.g. Engineers attempting review endpoints or Admin product settings).
- **Confirmed Decision 2: Sample Data & Evaluation Initialization**: On first launch, the 60 ground-truth evaluation samples (`inspection_001.png` through `inspection_060.jpg`) will be preloaded into persistent storage through the actual AI inference pipeline, enabling instant inspection history, confusion matrix calculations, defect recall metrics, and supervisor review workflows without manual re-uploading.
- **Confirmed Decision 3: Batch Processing Pipeline**: Real-time asynchronous processing queue with independent item validation, robust per-item error isolation (e.g., rejecting corrupt, non-image, and under-dimension files without blocking valid items), and live polling.
- **Confirmed Decision 4: Full-Stack Architecture**: Express + TypeScript unified full-stack server mounted with Vite middleware on port 3000, calling the native Python model service (`inference.py` + `classifier.npz` with 17-dimensional feature extraction) via high-efficiency local worker execution, backed by durable SQLite/JSON persistence and real-time task queueing.

---

## 1. Overview & Core Concept

- **What It Does**: InspectAI automates defect detection on manufactured parts (specifically product `P-PLATE01`, synthetic centered plates with scratches or pits). It accepts single or batch uploads (1–10 images), performs strict binary image validation (format, header decoding, dimension $\ge 64\times 64$, size $\le 5\text{MB}$), executes frozen model inference with 0.5 decision threshold, records immutable predictions with confidence and defect probabilities, and provides a dual-column Supervisor Review workspace for verification and audit trail tracking.
- **Target Audience / Personas**:
  - **Quality Engineer**: Authenticated operator responsible for selecting registered products, uploading part images, monitoring batch jobs, and reviewing their own inspection history.
  - **Quality Supervisor**: Authorized lead responsible for reviewing all inspection records, verifying or correcting AI classifications with comments, and analyzing quality trends.
  - **Plant Administrator**: Manages product registries (e.g., `P-PLATE01`) and system parameters.
- **Key Value**: Delivers end-to-end traceability where AI predictions and human supervisor decisions remain strictly decoupled, ensuring regulatory compliance, zero silent data loss, and verifiable quality metrics.

---

## 2. User Experience & Visual Design

### Key User Flows
1. **Authentication Flow**: Clean glassmorphism login screen with credential validation, role-based redirection, and persistent session state. Dedicated seed credentials provided for Engineer (`engineer` / `Inspect@123`), Supervisor (`supervisor` / `Super@123`), and Admin (`admin` / `Admin@123`).
2. **Dashboard Overview**: KPI metric cards (Total Inspections, Normal count, Defective count, Pending Reviews, Defect Rate) using tabular figures, activity trend charts (Recharts), distribution donut charts, and a recent inspection table with quick status badges.
3. **Single Image Inspection**: Left panel drag-and-drop zone with instant client-side preview, validation status, and file specs. Right panel with product selector (`P-PLATE01`), inspection execution button, animated inference state, and comprehensive result card (predicted class, confidence score, defect probability, model version, and SHA-256 hash).
4. **Batch Inspection Workspace**: 1–10 image uploader supporting mixed valid/invalid files. Displays per-file size and validation badge. Upon submission, an asynchronous batch tracking card reveals live progress bars, independent status states (`PENDING` $\to$ `PROCESSING` $\to$ `COMPLETED` / `REJECTED` / `FAILED`), and item-level error details.
5. **Inspection History & Filters**: Searchable, paginated data grid filterable by date range, prediction class (`Normal`, `Defective`), status (`COMPLETED`, `REJECTED`, `FAILED`), and review status (`Unreviewed`, `Confirmed`, `Corrected`).
6. **Supervisor Review Center (Supervisor Only)**: Dual-pane comparison interface. The left pane shows the original inspected image, product specs, and immutable AI prediction. The right pane provides the decision form: Confirm prediction or Correct prediction (`Normal` $\leftrightarrow$ `Defective`), required supervisor comments, and timestamped audit history.
7. **Model Evaluation & Quality Analytics**: Automated validation against all 60 labeled samples. Renders the $2\times 2$ Confusion Matrix, Defect Recall ($\frac{TP}{TP + FN}$), Precision, F1-Score, and Overall Accuracy, with explicit documentation of model boundaries and intentional validation rejections.

### Visual Identity & Theme
- **Aesthetic Direction**: Premium industrial SaaS with futuristic dark glassmorphism. Subtle ambient lighting, dark glass surfaces, restrained electric cyan and indigo accents, and crisp typography.
- **Color Palette**:
  - Dominant Canvas (60%): Deep Navy (`#080D1A`), Slate Void (`#0B132B`)
  - Structural Glass (30%): Semi-transparent slate (`rgba(16, 24, 43, 0.75)`), Hairline borders (`rgba(255, 255, 255, 0.08)`), Backdrop Blur (`blur(16px)`)
  - Accent Budget (10%): Electric Cyan (`#22D3EE` / `#67E8F9`), Soft Indigo (`#818CF8`)
  - Semantic Status: Emerald (`#10B981` / Normal), Rose (`#F43F5E` / Defective), Amber (`#F59E0B` / Warning / Pending)
- **Typography & Hierarchy**:
  - Display & Headings: `Plus Jakarta Sans` / `Outfit` (600–700 weight, balanced line wraps)
  - Body & UI: `Plus Jakarta Sans` / `DM Sans` (400–500 weight, high contrast `#F1F5F9`)
  - Telemetry & Metrics: Monospace tabular numerals (`font-mono tabular-nums`, `#A7B3C9`)
- **Top Bar & Navigation Contract**:
  - Top Bar: Single-line brand wordmark (`InspectAI`), contextual breadcrumb trail, and user profile pill with explicit role indicator and sign-out action.
  - Sidebar: Compact vertical navigation with clean icons (Lucide React) and active cyan glow indicators.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Full-Stack Integration Pattern**:
  - *Chosen Approach*: Node.js Express server running unified with Vite dev middleware on port 3000 (`server.ts`). An isolated Python worker script executes the frozen `inference.py` using native NumPy/PIL when image processing tasks are dispatched.
  - *Why*: Conforms strictly to the port 3000 container execution environment and avoids CORS/proxy connection issues while maintaining bit-level fidelity with the supplied Python model artifacts.
  - *Alternatives Considered*: Running a standalone Django server on a separate internal port. Rejected due to port 3000 external binding constraints in the AI Studio container.
- **Decision 2: Asynchronous Batch Queue & Item Isolation**:
  - *Chosen Approach*: Server-side in-memory job queue with persistent state persistence. Each batch item is queued and processed independently with transactional state updates.
  - *Why*: Ensures corrupted, non-image, or undersized files fail immediately with clear diagnostic messages while allowing valid files in the same batch to complete successfully without stalling.
  - *Alternatives Considered*: Synchronous batch upload blocking the HTTP connection. Rejected because it violates the challenge requirement for non-blocking asynchronous processing and independent item tracking.
- **Decision 3: Immutable Predictions vs. Review Audit Records**:
  - *Chosen Approach*: The `inspections` table stores the original `predicted_class`, `confidence`, `defect_probability`, and `model_version`. A separate `inspection_reviews` table records supervisor actions (`CONFIRMED` or `CORRECTED`, comments, reviewer ID, timestamp).
  - *Why*: Guarantees traceability. The AI's original classification is never overwritten, and any supervisor correction is presented side-by-side.

---

## 4. Technical Architecture & Data Strategy

```
┌────────────────────────────────────────────────────────────────────────┐
│                        InspectAI Frontend (React SPA)                  │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐   │
│  │  Dashboard   │ │ Single Inspect│ │ Batch Inspect│ │Review Center │   │
│  └──────┬───────┘ └──────┬───────┘ └──────┬───────┘ └──────┬───────┘   │
│         │                │                │                │           │
│         ▼                ▼                ▼                ▼           │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │             API Client / Auth Context / Polling Hooks            │  │
└─────────┬───────────────────────────────────────────────────────────┬──┘
          │ HTTP /api/v1/* (Bearer Auth)                              │
          ▼                                                           ▼
┌────────────────────────────────────────────────────────────────────────┐
│                Full-Stack Backend Server (Express + TypeScript)         │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │   Auth Middleware (RBAC: Admin, Supervisor, Engineer)            │  │
│  ├──────────────────────────────────────────────────────────────────┤  │
│  │   File Validation Service (Magic bytes, Pillow format, 64-4096px) │  │
│  ├──────────────────────────────────────────────────────────────────┤  │
│  │   Async Queue & Worker Dispatcher (Batch tracking & polling)     │  │
│  ├──────────────────────────────────────────────────────────────────┤  │
│  │   Evaluation Engine (60 samples ground-truth confusion matrix)   │  │
│  └──────────────────┬───────────────────────────────┬───────────────┘  │
│                     │                               │                  │
│                     ▼                               ▼                  │
│  ┌────────────────────────────────────┐ ┌───────────────────────────┐  │
│  │    Native Python Inference Engine   │ │  Persistent Relational DB │  │
│  │   - Model/inference.py (frozen)    │ │   (Users, Products,       │  │
│  │   - Model/classifier.npz           │ │    Batches, Inspections,  │  │
│  │   - 17-feature extraction pipeline │ │    Reviews, Audit Logs)   │  │
│  └────────────────────────────────────┘ └───────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────┘
```

### Data Schema
- **Users**: `id`, `username`, `email`, `password_hash`, `role` (`ENGINEER`, `SUPERVISOR`, `ADMIN`), `is_active`, `created_at`.
- **Products**: `id`, `product_id` (`P-PLATE01`), `name`, `description`, `is_active`, `created_at`.
- **InspectionBatches**: `id`, `batch_id`, `uploaded_by`, `total_files`, `accepted_files`, `rejected_files`, `completed_files`, `failed_files`, `status` (`PENDING`, `PROCESSING`, `COMPLETED`, `COMPLETED_WITH_ERRORS`, `FAILED`), `created_at`, `completed_at`.
- **Inspections**: `id`, `inspection_id`, `batch_id`, `product_id`, `uploaded_by`, `original_filename`, `image_path`, `image_sha256`, `status` (`PENDING`, `PROCESSING`, `COMPLETED`, `REJECTED`, `FAILED`), `predicted_class` (`Normal`, `Defective`), `confidence`, `defect_probability`, `model_version` (`BIT-PLATE-CV-1.0`), `error_message`, `created_at`, `completed_at`.
- **InspectionReviews**: `id`, `inspection_id`, `reviewed_by`, `original_predicted_class`, `reviewed_class`, `decision` (`CONFIRMED`, `CORRECTED`), `comments`, `created_at`.
- **AuditLogs**: `id`, `actor_id`, `action`, `resource_type`, `resource_id`, `details`, `created_at`.

### REST API Endpoints (`/api/v1/*`)
- `POST /auth/login` & `GET /auth/me` & `POST /auth/logout`
- `GET /products` & `POST /products` (Admin only)
- `POST /inspections` (Single image upload & execution)
- `GET /inspections` (Search, filter by class, status, date)
- `GET /inspections/:id` (Full record with review history)
- `POST /batches` (Multipart 1–10 images, returns batch ID)
- `GET /batches/:id` & `GET /batches/:id/status` (Item-level polling)
- `POST /inspections/:id/review` (Supervisor only, confirm or correct)
- `GET /analytics/overview` & `GET /analytics/distribution`
- `GET /evaluation/results` (All 60 ground-truth samples evaluated)
