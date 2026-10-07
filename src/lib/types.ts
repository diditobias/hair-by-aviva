export type UserRole = 'owner' | 'admin' | 'client'

export type BookingStatus =
  | 'requested'
  | 'awaiting_confirmation'
  | 'confirmed'
  | 'reschedule_requested'
  | 'completed'
  | 'cancelled'
  | 'declined'

export type BookingType = 'home_visit' | 'wig' | 'pickup'

export type BookingSource =
  | 'website'
  | 'admin'
  | 'whatsapp'
  | 'instagram'
  | 'phone'
  | 'referral'
  | 'other'

export type EnquiryStatus = 'new' | 'in_progress' | 'replied' | 'closed'

export type ServiceCategory = 'haircuts' | 'styling' | 'occasion' | 'wigs' | 'other'

export interface Profile {
  id: string
  first_name: string | null
  last_name: string | null
  email: string | null
  phone: string | null
  role: UserRole
  avatar_url: string | null
  created_at: string
  updated_at: string
}

export interface Client {
  id: string
  auth_user_id: string | null
  full_name: string
  email: string | null
  phone: string | null
  suburb: string | null
  preferred_contact: 'phone' | 'whatsapp' | 'email' | null
  private_notes: string | null
  created_at: string
  updated_at: string
}

export interface Service {
  id: string
  name: string
  category: ServiceCategory
  description: string | null
  duration_minutes: number
  price_from: number | null
  display_price: boolean
  booking_type: BookingType | null
  home_call_eligible: boolean
  wig_appointment: boolean
  active: boolean
  sort_order: number
}

export type SlotAppointmentType = 'home_visit' | 'wig' | 'pickup' | 'both'
export type SlotStatus =
  | 'available'
  | 'held'
  | 'requested'
  | 'confirmed'
  | 'blocked'
  | 'removed'
  | 'completed'

export interface AvailabilitySlot {
  id: string
  slot_date: string
  start_time: string
  end_time: string
  appointment_type: SlotAppointmentType
  duration_minutes: number
  travel_buffer_minutes: number
  status: SlotStatus
  service_id: string | null
  admin_note?: string | null
  held_until?: string | null
  held_by?: string | null
  booking_id?: string | null
  created_at?: string
  updated_at?: string
  service_ids?: string[]
}

export interface Booking {
  id: string
  client_id: string
  service_id: string | null
  availability_slot_id?: string | null
  created_by: string | null
  booking_source: BookingSource
  booking_type: BookingType
  requested_date: string | null
  requested_time: string | null
  confirmed_start: string | null
  confirmed_end: string | null
  alternative_date: string | null
  alternative_time: string | null
  suburb: string | null
  customer_address: string | null
  number_of_people: number
  customer_notes: string | null
  admin_notes: string | null
  client_message: string | null
  travel_buffer_minutes: number
  status: BookingStatus
  created_at: string
  updated_at: string
  clients?: Client | null
  services?: Service | null
}

export interface Enquiry {
  id: string
  full_name: string
  email: string | null
  phone: string | null
  subject: string | null
  category: string | null
  message: string
  preferred_contact: string | null
  status: EnquiryStatus
  admin_notes: string | null
  created_at: string
  updated_at: string
}

export interface BusinessSettings {
  id: number
  business_name: string
  tagline: string | null
  phone: string | null
  whatsapp: string | null
  email: string | null
  instagram: string | null
  accept_bookings: boolean
  home_visits_enabled: boolean
  wig_appointments_enabled: boolean
  max_advance_days: number
  min_notice_hours: number
  default_duration_minutes: number
  default_travel_buffer_minutes: number
  service_areas: string[]
  travel_fee_message: string | null
  show_prices: boolean
  show_testimonials: boolean
  show_instagram: boolean
  announcement_banner: string | null
  notification_email: string | null
  working_hours: Record<string, unknown>
  updated_at: string
}

export interface GalleryImage {
  id: string
  title: string | null
  caption: string | null
  category: string
  image_url: string
  before_url: string | null
  after_url: string | null
  sort_order: number
  visible: boolean
}

export interface Testimonial {
  id: string
  client_name: string
  quote: string
  active: boolean
  sort_order: number
}

export type OfferKind = 'deal' | 'sale' | 'announcement' | 'reward'
export type OfferClaimStatus = 'claimed' | 'redeemed'

export interface Offer {
  id: string
  title: string
  body: string
  kind: OfferKind
  highlight: string | null
  visits_required: number | null
  published: boolean
  starts_on: string | null
  ends_on: string | null
  sort_order: number
  created_at: string
  updated_at: string
}

export interface OfferClaim {
  id: string
  offer_id: string
  user_id: string
  status: OfferClaimStatus
  claimed_at: string
  redeemed_at: string | null
}

export const OFFER_KIND_LABELS: Record<OfferKind, string> = {
  deal: 'Deal',
  sale: 'Sale',
  announcement: 'Announcement',
  reward: 'Loyalty reward',
}

export const BOOKING_STATUS_LABELS: Record<BookingStatus, string> = {
  requested: 'Booking Requested',
  awaiting_confirmation: 'Awaiting Confirmation',
  confirmed: 'Confirmed',
  reschedule_requested: 'Reschedule Requested',
  completed: 'Completed',
  cancelled: 'Cancelled',
  declined: 'Declined',
}

export const SLOT_STATUS_LABELS: Record<SlotStatus, string> = {
  available: 'Available',
  held: 'Held',
  requested: 'Requested',
  confirmed: 'Confirmed',
  blocked: 'Blocked',
  removed: 'Removed',
  completed: 'Completed',
}
