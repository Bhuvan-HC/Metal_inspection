import path from 'path';
import fs from 'fs';
import { db } from '../server/db.js';
import { AIService } from '../server/ai-service.js';
import { EvaluationService } from '../server/evaluation-service.js';

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string) {
  if (condition) {
    console.log(`  ✓ PASS: ${testName}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${testName}`);
    failed++;
  }
}

async function runTests() {
  console.log('\n--- 1. AUTHENTICATION & RBAC TESTS ---');
  const engineer = db.findUserByUsername('engineer');
  assert(!!engineer && engineer.role === 'ENGINEER', 'Engineer user account exists with role ENGINEER');

  const supervisor = db.findUserByUsername('supervisor');
  assert(!!supervisor && supervisor.role === 'SUPERVISOR', 'Supervisor user account exists with role SUPERVISOR');

  const admin = db.findUserByUsername('admin');
  assert(!!admin && admin.role === 'ADMIN', 'Admin user account exists with role ADMIN');

  if (engineer) {
    assert(db.verifyPassword(engineer, 'Inspect@123'), 'Engineer password verification succeeds');
    assert(!db.verifyPassword(engineer, 'WrongPassword'), 'Engineer invalid password verification fails');
  }

  console.log('\n--- 2. MODEL CHECKSUM & INTEGRITY TESTS ---');
  const integrity = AIService.verifyModelIntegrity();
  assert(integrity.verified, 'Model weights and inference.py match exact SHA256 checksums');
  assert(integrity.details['classifier.npz'], 'classifier.npz checksum verified');
  assert(integrity.details['inference.py'], 'inference.py checksum verified');

  console.log('\n--- 3. IMAGE VALIDATION TESTS ---');
  const validPath = path.resolve(process.cwd(), 'student_pack/Samples/images/inspection_001.png');
  const validRes = AIService.validateImageFile(validPath);
  assert(validRes.isValid && validRes.format === 'PNG', 'Valid specimen inspection_001.png accepted');

  const corruptPath = path.resolve(process.cwd(), 'student_pack/Validation/corrupt_image.png');
  const corruptRes = AIService.validateImageFile(corruptPath);
  assert(!corruptRes.isValid, 'Corrupted image corrupt_image.png rejected');

  const notImagePath = path.resolve(process.cwd(), 'student_pack/Validation/not_an_image.jpg');
  const notImageRes = AIService.validateImageFile(notImagePath);
  assert(!notImageRes.isValid, 'Disguised text file not_an_image.jpg rejected by magic bytes');

  const tooSmallPath = path.resolve(process.cwd(), 'student_pack/Validation/too_small.png');
  const tooSmallRes = AIService.validateImageFile(tooSmallPath);
  assert(!tooSmallRes.isValid && tooSmallRes.width === 32, 'Under-dimension image too_small.png (32x32) rejected');

  console.log('\n--- 4. AI INFERENCE ENGINE TESTS ---');
  const sample1Pred = await AIService.predictImage(validPath);
  assert(sample1Pred.predicted_class === 'Defective', 'inspection_001.png correctly classified as Defective');
  assert(sample1Pred.model_version === 'BIT-PLATE-CV-1.0', 'Model version matches BIT-PLATE-CV-1.0');

  const sample2Path = path.resolve(process.cwd(), 'student_pack/Samples/images/inspection_002.jpg');
  const sample2Pred = await AIService.predictImage(sample2Path);
  assert(sample2Pred.predicted_class === 'Normal', 'inspection_002.jpg correctly classified as Normal');

  console.log('\n--- 5. IMMUTABLE PREDICTIONS & REVIEW PERSISTENCE TESTS ---');
  const testInsp = db.createInspection({
    inspectionId: 'INSP-TEST-001',
    productId: 'P-PLATE01',
    uploadedBy: 'user-eng-1',
    uploaderUsername: 'engineer',
    originalFilename: 'test_plate.png',
    imagePath: '/uploads/test_plate.png',
    imageSha256: 'abc123sha',
    status: 'COMPLETED',
    predictedClass: 'Normal',
    confidence: 0.94,
    defectProbability: 0.06,
    modelVersion: 'BIT-PLATE-CV-1.0',
  });

  const review = db.createReview({
    inspectionId: testInsp.inspectionId,
    reviewedBy: 'user-super-1',
    reviewerUsername: 'supervisor',
    originalPredictedClass: 'Normal',
    reviewedClass: 'Defective',
    decision: 'CORRECTED',
    comments: 'Micro-scratch visible under raking light.',
  });

  const fetched = db.findInspectionById('INSP-TEST-001');
  assert(fetched?.predictedClass === 'Normal', 'Original AI prediction remains Normal (immutable)');
  assert(review.reviewedClass === 'Defective', 'Supervisor review recorded Defective decision separately');

  console.log('\n--- 6. EVALUATION SET METRICS TESTS ---');
  const evalResults = await EvaluationService.runEvaluation();
  assert(evalResults.totalEvaluated === 60, 'All 60 ground-truth samples evaluated');
  assert(evalResults.truePositives === 30, '30 True Positives evaluated');
  assert(evalResults.trueNegatives === 30, '30 True Negatives evaluated');
  assert(evalResults.defectRecall === 1.0, 'Defect Recall calculated correctly (100.0%)');

  console.log(`\n===========================================`);
  console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log(`===========================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Test execution error:', err);
  process.exit(1);
});
