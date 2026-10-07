import type { BookingStatus, EnquiryStatus, SlotStatus } from '../../lib/types'
import { SLOT_STATUS_LABELS } from '../../lib/types'
import { statusLabel } from '../../lib/format'

const bookingTone: Record<BookingStatus, string> = {
  requested: 'tone-warn',
  awaiting_confirmation: 'tone-warn',
  confirmed: 'tone-ok',
  reschedule_requested: 'tone-warn',
  completed: 'tone-muted',
  cancelled: 'tone-danger',
  declined: 'tone-danger',
}

const slotTone: Record<SlotStatus, string> = {
  available: 'tone-ok',
  held: 'tone-warn',
  requested: 'tone-warn',
  confirmed: 'tone-ok',
  blocked: 'tone-danger',
  removed: 'tone-muted',
  completed: 'tone-muted',
}

export function BookingStatusBadge({ status }: { status: BookingStatus }) {
  return <span className={`badge ${bookingTone[status]}`}>{statusLabel(status)}</span>
}

export function EnquiryStatusBadge({ status }: { status: EnquiryStatus }) {
  const tone =
    status === 'new' ? 'tone-warn' : status === 'closed' ? 'tone-muted' : status === 'replied' ? 'tone-ok' : 'tone-accent'
  const label = status.replace('_', ' ')
  return <span className={`badge ${tone}`}>{label}</span>
}

export function SlotStatusBadge({ status }: { status: SlotStatus }) {
  return <span className={`badge ${slotTone[status]}`}>{SLOT_STATUS_LABELS[status] ?? status}</span>
}
