import { db } from '@/api/db/client'

/**
 * Log an audit event into operation_audit_events.
 * Fire-and-forget — never blocks the caller, swallows errors.
 *
 * @param {Object} opts
 * @param {string} opts.eventType  — e.g. 'sales_order.created'
 * @param {string} opts.entityType — e.g. 'sales_order'
 * @param {string|number} [opts.entityId]
 * @param {Object}  [opts.metadata={}]
 */
export async function logAuditEvent({ eventType, entityType, entityId, metadata = {} }) {
  try {
    const { error } = await db
      .from('operation_audit_events')
      .insert({
        event_type: eventType,
        entity_type: entityType,
        entity_id: entityId != null ? String(entityId) : null,
        severity: 'info',
        metadata,
      })

    if (error) {
      console.error('[audit] insert error:', error)
    }
  } catch (err) {
    // Fire-and-forget — never throw
    console.error('[audit] exception:', err)
  }
}
