import { format, parseISO, isValid } from 'date-fns'
import type { BookingStatus, BookingType } from './types'
import { BOOKING_STATUS_LABELS } from './types'

export function formatDate(value: string | null | undefined): string {
  if (!value) return '—'
  const d = value.includes('T') ? parseISO(value) : parseISO(`${value}T12:00:00`)
  if (!isValid(d)) return value
  return format(d, 'EEE d MMM yyyy')
}

export function formatTime(value: string | null | undefined): string {
  if (!value) return '—'
  const raw = value.length === 5 ? `${value}:00` : value
  const d = parseISO(`1970-01-01T${raw}`)
  if (!isValid(d)) return value.slice(0, 5)
  return format(d, 'HH:mm')
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—'
  const d = parseISO(value)
  if (!isValid(d)) return value
  return format(d, 'EEE d MMM yyyy · HH:mm')
}

export function formatPrice(value: number | null | undefined): string {
  if (value == null) return ''
  return new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency: 'ZAR',
    maximumFractionDigits: 0,
  }).format(value)
}

export function statusLabel(status: BookingStatus): string {
  return BOOKING_STATUS_LABELS[status] ?? status
}

export function bookingTypeLabel(type: BookingType): string {
  if (type === 'home_visit') return 'Home visit'
  if (type === 'pickup') return 'Wig collection'
  return 'Wig / Sheitel'
}

export function whatsappLink(phone: string | null | undefined, message?: string): string | null {
  if (!phone) return null
  const digits = phone.replace(/\D/g, '')
  if (!digits) return null
  const base = `https://wa.me/${digits}`
  return message ? `${base}?text=${encodeURIComponent(message)}` : base
}

export function telLink(phone: string | null | undefined): string | null {
  if (!phone) return null
  return `tel:${phone.replace(/\s/g, '')}`
}

export function mailLink(email: string | null | undefined, subject?: string): string | null {
  if (!email) return null
  return subject
    ? `mailto:${email}?subject=${encodeURIComponent(subject)}`
    : `mailto:${email}`
}
