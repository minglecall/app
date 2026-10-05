/**
 * Settlement status transitions + append-only settlement_events.
 * Phase 2 provides helpers; Phase 4 routes will call these from Express.
 *
 * Recommended host salary visibility (product):
 * - Agency hosts: host_salary_status → paid on tl_confirmed
 * - Direct hosts: host_salary_status → paid on admin_paid
 */

import { getSupabaseAdmin, isSupabaseAdminConfigured } from '../supabaseAdmin';
import type { SettlementBatchStatus, SettlementEventType } from '../../shared/finance/types';

export const SETTLEMENT_STATUS_TRANSITIONS: Record<
  SettlementBatchStatus,
  readonly SettlementBatchStatus[]
> = {
  pending_admin_pay: ['admin_paid', 'cancelled'],
  admin_paid: ['tl_confirmed', 'cancelled'],
  tl_confirmed: [],
  cancelled: [],
};

export function canTransitionSettlementStatus(
  from: SettlementBatchStatus,
  to: SettlementBatchStatus
): boolean {
  return (SETTLEMENT_STATUS_TRANSITIONS[from] || []).includes(to);
}

export interface TransitionResult {
  success: boolean;
  error?: string;
  code?: 'INVALID_TRANSITION' | 'NOT_FOUND' | 'DB_ERROR' | 'NOT_CONFIGURED';
}

async function appendEvent(opts: {
  batchId: string;
  periodId?: string | null;
  eventType: SettlementEventType;
  actorUserId: string;
  note?: string | null;
  payload?: Record<string, unknown>;
}): Promise<{ success: boolean; error?: string }> {
  const client = getSupabaseAdmin();
  if (!client) return { success: false, error: 'Supabase admin client unavailable' };
  const { error } = await client.from('settlement_events').insert({
    batch_id: opts.batchId,
    period_id: opts.periodId ?? null,
    event_type: opts.eventType,
    actor_user_id: opts.actorUserId,
    note: opts.note ?? null,
    payload: opts.payload ?? {},
  });
  if (error) return { success: false, error: error.message };
  return { success: true };
}

async function markHostLinesPaid(batchId: string): Promise<{ success: boolean; error?: string }> {
  const client = getSupabaseAdmin();
  if (!client) return { success: false, error: 'Supabase admin client unavailable' };
  const { error } = await client
    .from('settlement_line_items')
    .update({ host_salary_status: 'paid' })
    .eq('batch_id', batchId)
    .eq('payee_role', 'host');
  if (error) return { success: false, error: error.message };
  return { success: true };
}

/**
 * Admin marks a batch as paid (remittance complete).
 * Direct-host batches: host lines → paid immediately.
 * TL bundles: host lines stay pending until tl_confirmed (unless markHostsPaidNow).
 */
export async function markBatchAdminPaid(opts: {
  batchId: string;
  actorUserId: string;
  note?: string;
  paymentReference?: string;
  /** Override: mark host lines paid on admin_paid even for TL bundles. */
  markHostsPaidNow?: boolean;
}): Promise<TransitionResult> {
  if (!isSupabaseAdminConfigured()) {
    return { success: false, code: 'NOT_CONFIGURED', error: 'Supabase admin not configured' };
  }
  const client = getSupabaseAdmin();
  if (!client) {
    return { success: false, code: 'NOT_CONFIGURED', error: 'Supabase admin client unavailable' };
  }

  const { data: batch, error } = await client
    .from('settlement_batches')
    .select('id, status, batch_kind, period_id')
    .eq('id', opts.batchId)
    .maybeSingle();

  if (error) return { success: false, code: 'DB_ERROR', error: error.message };
  if (!batch) return { success: false, code: 'NOT_FOUND', error: 'Batch not found' };

  const from = batch.status as SettlementBatchStatus;
  if (!canTransitionSettlementStatus(from, 'admin_paid')) {
    return {
      success: false,
      code: 'INVALID_TRANSITION',
      error: `Cannot transition ${from} → admin_paid`,
    };
  }

  const { error: updateError } = await client
    .from('settlement_batches')
    .update({
      status: 'admin_paid',
      payment_reference: opts.paymentReference ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', opts.batchId)
    .eq('status', from);

  if (updateError) return { success: false, code: 'DB_ERROR', error: updateError.message };

  const ev = await appendEvent({
    batchId: opts.batchId,
    periodId: batch.period_id,
    eventType: 'admin_marked_paid',
    actorUserId: opts.actorUserId,
    note: opts.note ?? null,
    payload: { paymentReference: opts.paymentReference ?? null },
  });
  if (!ev.success) {
    // Best-effort rollback so status never advances without settlement_events
    await client
      .from('settlement_batches')
      .update({
        status: from,
        payment_reference: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', opts.batchId)
      .eq('status', 'admin_paid');
    return { success: false, code: 'DB_ERROR', error: ev.error };
  }

  const payHostsNow =
    opts.markHostsPaidNow === true || batch.batch_kind === 'direct_host';
  if (payHostsNow) {
    const paid = await markHostLinesPaid(opts.batchId);
    if (!paid.success) return { success: false, code: 'DB_ERROR', error: paid.error };
  }

  return { success: true };
}

/** Team leader confirms funds received for a TL bundle. */
export async function markBatchTlConfirmed(opts: {
  batchId: string;
  actorUserId: string;
  note?: string;
}): Promise<TransitionResult> {
  if (!isSupabaseAdminConfigured()) {
    return { success: false, code: 'NOT_CONFIGURED', error: 'Supabase admin not configured' };
  }
  const client = getSupabaseAdmin();
  if (!client) {
    return { success: false, code: 'NOT_CONFIGURED', error: 'Supabase admin client unavailable' };
  }

  const { data: batch, error } = await client
    .from('settlement_batches')
    .select('id, status, batch_kind, team_leader_id, payee_user_id, period_id')
    .eq('id', opts.batchId)
    .maybeSingle();

  if (error) return { success: false, code: 'DB_ERROR', error: error.message };
  if (!batch) return { success: false, code: 'NOT_FOUND', error: 'Batch not found' };

  if (batch.batch_kind !== 'team_leader_bundle') {
    return {
      success: false,
      code: 'INVALID_TRANSITION',
      error: 'tl_confirmed only applies to team_leader_bundle batches',
    };
  }

  const allowedActor =
    opts.actorUserId === batch.team_leader_id || opts.actorUserId === batch.payee_user_id;
  if (!allowedActor) {
    return {
      success: false,
      code: 'INVALID_TRANSITION',
      error: 'Only the batch team leader may confirm receipt',
    };
  }

  const from = batch.status as SettlementBatchStatus;
  if (!canTransitionSettlementStatus(from, 'tl_confirmed')) {
    return {
      success: false,
      code: 'INVALID_TRANSITION',
      error: `Cannot transition ${from} → tl_confirmed`,
    };
  }

  const { error: updateError } = await client
    .from('settlement_batches')
    .update({
      status: 'tl_confirmed',
      updated_at: new Date().toISOString(),
    })
    .eq('id', opts.batchId)
    .eq('status', from);

  if (updateError) return { success: false, code: 'DB_ERROR', error: updateError.message };

  const ev = await appendEvent({
    batchId: opts.batchId,
    periodId: batch.period_id,
    eventType: 'tl_confirmed',
    actorUserId: opts.actorUserId,
    note: opts.note ?? null,
  });
  if (!ev.success) {
    await client
      .from('settlement_batches')
      .update({ status: from, updated_at: new Date().toISOString() })
      .eq('id', opts.batchId)
      .eq('status', 'tl_confirmed');
    return { success: false, code: 'DB_ERROR', error: ev.error };
  }

  const paid = await markHostLinesPaid(opts.batchId);
  if (!paid.success) return { success: false, code: 'DB_ERROR', error: paid.error };

  return { success: true };
}

/**
 * Admin cancel stub — status via settlement_events only (amounts immutable).
 * Does not reverse ledger amounts; use appendReversalEntry for money corrections.
 */
export async function cancelSettlementBatch(opts: {
  batchId: string;
  actorUserId: string;
  note?: string;
}): Promise<TransitionResult> {
  if (!isSupabaseAdminConfigured()) {
    return { success: false, code: 'NOT_CONFIGURED', error: 'Supabase admin not configured' };
  }
  const client = getSupabaseAdmin();
  if (!client) {
    return { success: false, code: 'NOT_CONFIGURED', error: 'Supabase admin client unavailable' };
  }

  const { data: batch, error } = await client
    .from('settlement_batches')
    .select('id, status, period_id')
    .eq('id', opts.batchId)
    .maybeSingle();

  if (error) return { success: false, code: 'DB_ERROR', error: error.message };
  if (!batch) return { success: false, code: 'NOT_FOUND', error: 'Batch not found' };

  const from = batch.status as SettlementBatchStatus;
  if (!canTransitionSettlementStatus(from, 'cancelled')) {
    return {
      success: false,
      code: 'INVALID_TRANSITION',
      error: `Cannot transition ${from} → cancelled`,
    };
  }

  const { error: updateError } = await client
    .from('settlement_batches')
    .update({
      status: 'cancelled',
      updated_at: new Date().toISOString(),
    })
    .eq('id', opts.batchId)
    .eq('status', from);

  if (updateError) return { success: false, code: 'DB_ERROR', error: updateError.message };

  const ev = await appendEvent({
    batchId: opts.batchId,
    periodId: batch.period_id,
    eventType: 'cancelled',
    actorUserId: opts.actorUserId,
    note: opts.note ?? 'Cancelled by admin',
  });
  if (!ev.success) {
    await client
      .from('settlement_batches')
      .update({ status: from, updated_at: new Date().toISOString() })
      .eq('id', opts.batchId)
      .eq('status', 'cancelled');
    return { success: false, code: 'DB_ERROR', error: ev.error };
  }

  return { success: true };
}

/** Append a free-form note event without changing status. */
export async function appendSettlementNote(opts: {
  batchId: string;
  actorUserId: string;
  note: string;
  periodId?: string | null;
}): Promise<TransitionResult> {
  if (!isSupabaseAdminConfigured()) {
    return { success: false, code: 'NOT_CONFIGURED', error: 'Supabase admin not configured' };
  }
  const ev = await appendEvent({
    batchId: opts.batchId,
    periodId: opts.periodId ?? null,
    eventType: 'note',
    actorUserId: opts.actorUserId,
    note: opts.note,
  });
  if (!ev.success) return { success: false, code: 'DB_ERROR', error: ev.error };
  return { success: true };
}

/** Record batch creation event (Phase 3 close will call after insert). */
export async function recordBatchCreatedEvent(opts: {
  batchId: string;
  periodId: string;
  actorUserId: string;
  payload?: Record<string, unknown>;
}): Promise<TransitionResult> {
  if (!isSupabaseAdminConfigured()) {
    return { success: false, code: 'NOT_CONFIGURED', error: 'Supabase admin not configured' };
  }
  const ev = await appendEvent({
    batchId: opts.batchId,
    periodId: opts.periodId,
    eventType: 'created',
    actorUserId: opts.actorUserId,
    payload: opts.payload ?? {},
  });
  if (!ev.success) return { success: false, code: 'DB_ERROR', error: ev.error };
  return { success: true };
}
