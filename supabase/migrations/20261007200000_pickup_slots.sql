-- Wig collection pickup type, and booking rules that keep it separate from hair/wig slots.
-- Enum values are added first; functions that reference them follow in the next statement group.
-- Applied to the live project in two steps so the new enum values are committed before use.

ALTER TYPE public.booking_type ADD VALUE IF NOT EXISTS 'pickup';
ALTER TYPE public.slot_appointment_type ADD VALUE IF NOT EXISTS 'pickup';
