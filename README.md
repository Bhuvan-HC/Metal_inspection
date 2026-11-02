# InspectAI — AI-Powered Visual Quality Inspection & Traceability Platform

> **"Precision in Every Inspection."**

InspectAI is a manufacturing visual quality inspection, traceability, and supervisor review platform designed for automated anomaly screening of industrial components (Product `P-PLATE01`: Demonstration metal plate).

---

## 1. System Architecture

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

---

## 2. Seed Credentials for Hackathon Demonstration

| Role | Username | Password | Permitted Capabilities |
| :--- | :--- | :--- | :--- |
| **Engineer** | `engineer` | `Inspect@123` | Upload specimen images, run single/batch inspections, view inspection history. **Cannot** review or correct predictions (strict 403). |
| **Supervisor** | `supervisor` | `Super@123` | View all inspections, confirm or correct predictions, record review audit notes, access quality analytics. |
| **Admin** | `admin` | `Admin@123` | Register products (`P-PLATE01`), view system audit logs, full access. |

---

## 3. Demonstration Checklist (10-Step Guide)

1. **Engineer Login**:
   - Navigate to the login screen and click the **"Engineer"** credential preset (`engineer` / `Inspect@123`).
   - Click **"Sign In"**. Notice the cyan role badge indicating active Engineer access.
2. **Single Image Inspection**:
   - Go to **Single Inspection**. Click **"Sample #001 (Defective Plate)"** preset or upload your own JPEG/PNG.
   - Click **"Execute Quality Inspection"**.
   - Observe the live model inference result: `Defective`, with confidence score, defect probability, model version (`BIT-PLATE-CV-1.0`), and SHA-256 hash.
3. **Intentional Validation Error Rejection**:
   - Click the preset **"Not An Image"** (`not_an_image.jpg`, disguised text file) or **"Too Small"** (`too_small.png`, 32×32px).
   - Execute inspection and observe immediate rejection: `Image dimensions (32x32) are below required minimum 64x64 pixels` without model crash.
4. **Mixed Valid & Invalid Batch Upload**:
   - Go to **Batch Inspection**. Click **"Load Mixed Batch Preset (4 Valid + 3 Invalid)"**.
   - Click **"Process Batch Asynchronously"**.
5. **Batch Status Tracking**:
   - Observe the live status progression (`PENDING` $\to$ `PROCESSING` $\to$ `COMPLETED_WITH_ERRORS`).
   - The 4 valid images are processed to `COMPLETED`, while corrupted/non-image/undersized files are independently marked `REJECTED` with specific error diagnostics.
6. **Persistent Inspection History**:
   - Go to **Inspection History**. Search by filename or filter by `Defective`.
   - Click **"Details"** on any record to view its full technical dossier.
7. **Supervisor Login**:
   - Click **Sign Out**, then sign in as **Supervisor** (`supervisor` / `Super@123`).
   - Notice the indigo **Supervisor** role badge.
8. **Supervisor Confirmation or Correction**:
   - Go to **Supervisor Reviews**. Select any completed inspection.
   - Toggle **"Correct AI Prediction"**, select the reviewed class, and add comments: *"Verified surface finish under magnification."*
   - Click **"Save Supervisor Review"**.
   - Notice that the **original AI prediction is never overwritten**; the supervisor's decision is stored side-by-side.
9. **Engineer Permission-Denied Test (Contest Security Check)**:
   - In the Supervisor Review Center, click **"Simulate Unauthorized Engineer Review Call"** to trigger a test API request.
   - The backend validates the user role and returns **HTTP 403 Forbidden** (`Permission denied: Only supervisors can review or correct inspections`).
10. **Model Evaluation & Quality Analytics**:
    - Go to **Model Evaluation** to view the **2×2 Confusion Matrix**, **Defect Recall (100.0%)**, **Precision (100.0%)**, **F1-Score (1.000)**, and the complete 60-sample ground-truth breakdown.
    - Check **Quality Analytics** for yield rates, defect trends, and supervisor review agreement graphs.
11. **Live Camera Detection (Optical Station Viewfinder)**:
    - Go to **Live Camera Detection** in the sidebar (or click "Switch to Live Camera Detection" from Single Inspection).
    - Connect any webcam/device camera or click **"Simulated Feed"** to simulate moving conveyor metal plates.
    - Align the specimen in the central $128\times 128$ reticle and click **"Capture & Inspect Specimen"**, or activate **"Continuous Auto-Screening"** to automatically detect defects in real-time with live glowing reticle alerts!

---

## 4. Running the Automated Test Suite

To run the automated backend test suite verifying authentication, RBAC, image validation, model integrity, and persistence:

```bash
npm test
```

Expected output:
```
--- 1. AUTHENTICATION & RBAC TESTS ---
  ✓ PASS: Engineer user account exists with role ENGINEER
  ✓ PASS: Supervisor user account exists with role SUPERVISOR
  ✓ PASS: Admin user account exists with role ADMIN
  ✓ PASS: Engineer password verification succeeds
  ✓ PASS: Engineer invalid password verification fails

--- 2. MODEL CHECKSUM & INTEGRITY TESTS ---
  ✓ PASS: Model weights and inference.py match exact SHA256 checksums
  ✓ PASS: classifier.npz checksum verified
  ✓ PASS: inference.py checksum verified

--- 3. IMAGE VALIDATION TESTS ---
  ✓ PASS: Valid specimen inspection_001.png accepted
  ✓ PASS: Corrupted image corrupt_image.png rejected
  ✓ PASS: Disguised text file not_an_image.jpg rejected by magic bytes
  ✓ PASS: Under-dimension image too_small.png (32x32) rejected

--- 4. AI INFERENCE ENGINE TESTS ---
  ✓ PASS: inspection_001.png correctly classified as Defective
  ✓ PASS: Model version matches BIT-PLATE-CV-1.0
  ✓ PASS: inspection_002.jpg correctly classified as Normal

--- 5. IMMUTABLE PREDICTIONS & REVIEW PERSISTENCE TESTS ---
  ✓ PASS: Original AI prediction remains Normal (immutable)
  ✓ PASS: Supervisor review recorded Defective decision separately

--- 6. EVALUATION SET METRICS TESTS ---
  ✓ PASS: All 60 ground-truth samples evaluated
  ✓ PASS: 30 True Positives evaluated
  ✓ PASS: 30 True Negatives evaluated
  ✓ PASS: Defect Recall calculated correctly (100.0%)

===========================================
TEST RESULTS: 21 PASSED, 0 FAILED
===========================================
```
