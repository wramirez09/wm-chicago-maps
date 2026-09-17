/**
 * VENDORED from wramirez09/wm-chicago-maps-backend packages/shared/src/mod.ts
 * at commit 9e2c168ba920e9c02c806781f9c7c2fb776b4066. Do not edit here — change the backend and re-vendor.
 *
 * Only change from upstream: relative imports drop their ".js" suffix. The
 * backend is NodeNext ESM, where "./common.js" resolves to common.ts; Metro
 * does not do that mapping and fails to resolve the ".js" path.
 */
import { z } from 'zod';
import { PlaceSubmission } from './places';

export const SubmissionStatus = z.enum(['pending', 'approved', 'rejected']);
export const QueueItem = z.object({
  id: z.string().uuid(),
  submittedBy: z.string().uuid(),
  submittedAt: z.string(),
  status: SubmissionStatus,
  autochecks: z.object({
    duplicateOf: z.string().uuid().nullable(),
    insideChicago: z.boolean(),
    licenseMatch: z.string().nullable(),
  }).nullable(),
  submission: PlaceSubmission,
});
export const Queue = z.object({ items: z.array(QueueItem), total: z.number().int() });
export const QueueQuery = z.object({
  status: SubmissionStatus.default('pending'),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});
export const ModDecision = z.object({ reason: z.string().max(500).optional() });
export const ModResult = z.object({ submissionId: z.string().uuid(), status: SubmissionStatus, placeId: z.string().uuid().nullable() });
