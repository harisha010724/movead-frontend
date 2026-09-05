import type { DocumentChecklistStatus, DocumentKind } from '@/shared/types/domain';

/**
 * How the six document kinds and six checklist states read on screen.
 *
 * Kept beside the review page rather than in the shared UI layer: these are
 * operations' words for operations' screen. The driver's app has its own
 * shorter labels for the same enum, written for the person holding the paper
 * rather than the person checking it.
 */

export const KIND_LABEL: Record<DocumentKind, string> = {
  RC: 'Registration certificate',
  LICENCE: 'Driving licence',
  INSURANCE: 'Insurance',
  POLLUTION: 'Pollution certificate',
  PERMIT: 'Commercial permit',
  OTHER: 'Other',
};

type Tone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

export const STATUS_LABEL: Record<DocumentChecklistStatus, string> = {
  missing: 'Not sent',
  uploaded: 'Awaiting review',
  verified: 'Verified',
  rejected: 'Rejected',
  expiring: 'Expiring soon',
  expired: 'Expired',
};

export const STATUS_TONE: Record<DocumentChecklistStatus, Tone> = {
  missing: 'neutral',
  uploaded: 'warning',
  verified: 'success',
  rejected: 'danger',
  expiring: 'warning',
  expired: 'danger',
};

/** A decision is only owed on something the driver has actually sent. */
export function awaitsDecision(status: DocumentChecklistStatus): boolean {
  return status === 'uploaded';
}

export function isPdf(contentType: string | null): boolean {
  return contentType === 'application/pdf';
}
