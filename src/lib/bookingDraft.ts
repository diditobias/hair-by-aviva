import type { BookingType } from './types'

const DRAFT_KEY = 'hba_booking_draft'

export type BookingWizardStep =
  | 'type'
  | 'service'
  | 'day'
  | 'time'
  | 'details'
  | 'review'
  | 'success'

export interface BookingDraft {
  booking_type?: BookingType | null
  service_id?: string | null
  slot_id?: string | null
  slot_date?: string | null
  start_time?: string | null
  suburb?: string | null
  address?: string | null
  notes?: string | null
  name?: string | null
  email?: string | null
  phone?: string | null
  preferred_contact?: string | null
  step?: BookingWizardStep | null
}

function safeParse(raw: string | null): BookingDraft | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as BookingDraft
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch {
    return null
  }
}

export function getBookingDraft(): BookingDraft | null {
  if (typeof sessionStorage === 'undefined') return null
  return safeParse(sessionStorage.getItem(DRAFT_KEY))
}

export function saveBookingDraft(draft: BookingDraft): void {
  if (typeof sessionStorage === 'undefined') return
  sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft))
}

export function mergeBookingDraft(partial: Partial<BookingDraft>): BookingDraft {
  const next = { ...getBookingDraft(), ...partial }
  saveBookingDraft(next)
  return next
}

export function clearBookingDraft(): void {
  if (typeof sessionStorage === 'undefined') return
  sessionStorage.removeItem(DRAFT_KEY)
}

export function hasBookingDraft(): boolean {
  const draft = getBookingDraft()
  if (!draft) return false
  return Boolean(draft.booking_type || draft.service_id || draft.slot_id || draft.step)
}
