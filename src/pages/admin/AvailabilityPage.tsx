import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import {
  addDays,
  addMonths,
  addWeeks,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isBefore,
  parseISO,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from 'date-fns'
import { supabase } from '../../lib/supabase'
import { useBusinessSettings } from '../../hooks/useBusinessSettings'
import type { AvailabilitySlot, Service, SlotAppointmentType, SlotStatus } from '../../lib/types'
import { SLOT_STATUS_LABELS } from '../../lib/types'
import { SlotStatusBadge } from '../../components/shared/StatusBadge'
import { Modal } from '../../components/shared/Modal'
import { formatDate, formatTime } from '../../lib/format'

type Tab = 'release' | 'view' | 'block'
type Horizon = 'this-week' | 'next-week' | 'four-weeks' | 'month'

const HORIZONS: { id: Horizon; label: string }[] = [
  { id: 'this-week', label: 'This week' },
  { id: 'next-week', label: 'Next week' },
  { id: 'four-weeks', label: '4 weeks' },
  { id: 'month', label: 'This month' },
]

const TIME_OPTIONS = Array.from({ length: 17 }, (_, i) => {
  const total = 9 * 60 + i * 30
  const h = Math.floor(total / 60)
  const m = total % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
})

const PRESETS: Record<string, string[]> = {
  Morning: ['09:00', '10:30', '12:00'],
  Afternoon: ['13:00', '14:30', '16:00'],
  'Full Day': TIME_OPTIONS,
}

const LENGTH_PRESETS = [30, 45, 60, 90, 120, 180]

const SLOT_TYPE_OPTIONS = [
  ['home_visit', 'Home Visit Hair'],
  ['wig', 'Wig / Sheitel'],
  ['pickup', 'Wig collection'],
  ['both', 'Hair or wig'],
] as const

function slotTypeLabel(type: SlotAppointmentType): string {
  if (type === 'home_visit') return 'Home Visit Hair'
  if (type === 'wig') return 'Wig / Sheitel'
  if (type === 'pickup') return 'Wig collection'
  return 'Hair or wig'
}

function toMinutes(time: string): number {
  const [h, m] = time.slice(0, 5).split(':').map(Number)
  return h * 60 + m
}

function rangesOverlap(startA: number, endA: number, startB: number, endB: number): boolean {
  return startA < endB && startB < endA
}

function todayIso(): string {
  return format(new Date(), 'yyyy-MM-dd')
}

function pickKey(date: string, time: string): string {
  return `${date}|${time}`
}

function horizonDays(horizon: Horizon): Date[] {
  const today = startOfDay(new Date())
  if (horizon === 'this-week') {
    const start = startOfWeek(today, { weekStartsOn: 1 })
    const end = endOfWeek(today, { weekStartsOn: 1 })
    return eachDayOfInterval({ start, end }).filter((d) => !isBefore(d, today))
  }
  if (horizon === 'next-week') {
    const start = startOfWeek(addWeeks(today, 1), { weekStartsOn: 1 })
    return eachDayOfInterval({ start, end: endOfWeek(start, { weekStartsOn: 1 }) })
  }
  if (horizon === 'four-weeks') {
    return eachDayOfInterval({ start: today, end: addDays(today, 27) })
  }
  const monthEnd = endOfMonth(today)
  const remaining = eachDayOfInterval({ start: today, end: monthEnd })
  if (remaining.length < 7) {
    const next = addMonths(today, 1)
    return eachDayOfInterval({ start: startOfMonth(next), end: endOfMonth(next) })
  }
  return remaining
}

function addMinutesToTime(time: string, minutes: number): string {
  const [h, m] = time.slice(0, 5).split(':').map(Number)
  const total = h * 60 + m + minutes
  const hh = Math.floor(total / 60) % 24
  const mm = total % 60
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
}

function expandRecurringDates(
  dates: string[],
  enabled: boolean,
  mode: 'weeks' | 'until',
  weeks: number,
  until: string,
): string[] {
  if (!enabled || dates.length === 0) return dates
  const set = new Set(dates)
  if (mode === 'weeks') {
    for (const d of dates) {
      for (let w = 1; w < weeks; w++) {
        set.add(format(addWeeks(parseISO(`${d}T12:00:00`), w), 'yyyy-MM-dd'))
      }
    }
  } else if (until) {
    const untilDate = parseISO(`${until}T12:00:00`)
    for (const d of dates) {
      let next = addWeeks(parseISO(`${d}T12:00:00`), 1)
      while (!isBefore(untilDate, next)) {
        set.add(format(next, 'yyyy-MM-dd'))
        next = addWeeks(next, 1)
      }
    }
  }
  return Array.from(set).sort()
}

export function AvailabilityPage() {
  const { settings } = useBusinessSettings()
  const [tab, setTab] = useState<Tab>('view')
  const [slots, setSlots] = useState<AvailabilitySlot[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Release wizard
  const [releaseOpen, setReleaseOpen] = useState(false)
  const [releaseStep, setReleaseStep] = useState(1)
  const [dates, setDates] = useState<string[]>([])
  const [dateInput, setDateInput] = useState(todayIso())
  const [appointmentType, setAppointmentType] = useState<SlotAppointmentType>('both')
  const [times, setTimes] = useState<string[]>([])
  const [duration, setDuration] = useState(60)
  const [bufferOverride, setBufferOverride] = useState<number | ''>('')
  const [serviceIds, setServiceIds] = useState<string[]>([])
  const [adminNote, setAdminNote] = useState('')
  const [recurringOn, setRecurringOn] = useState(false)
  const [recurringMode, setRecurringMode] = useState<'weeks' | 'until'>('weeks')
  const [recurringWeeks, setRecurringWeeks] = useState(4)
  const [recurringUntil, setRecurringUntil] = useState('')
  const [releasing, setReleasing] = useState(false)

  // Calendar batch
  const [horizon, setHorizon] = useState<Horizon>('next-week')
  const [picked, setPicked] = useState<Set<string>>(() => new Set())
  const [posting, setPosting] = useState(false)

  // Copy slots
  const [copyOpen, setCopyOpen] = useState(false)
  const [copyFromDate, setCopyFromDate] = useState('')
  const [copyToDate, setCopyToDate] = useState(todayIso())
  const [copying, setCopying] = useState(false)

  // Edit slot
  const [editing, setEditing] = useState<AvailabilitySlot | null>(null)
  const [editType, setEditType] = useState<SlotAppointmentType>('both')
  const [editDuration, setEditDuration] = useState(60)
  const [editBuffer, setEditBuffer] = useState(30)
  const [editServiceIds, setEditServiceIds] = useState<string[]>([])
  const [editNote, setEditNote] = useState('')
  const [editBusy, setEditBusy] = useState(false)

  // Block time
  const [blockTitle, setBlockTitle] = useState('Blocked')
  const [blockDate, setBlockDate] = useState(todayIso())
  const [blockStart, setBlockStart] = useState('09:00')
  const [blockEnd, setBlockEnd] = useState('12:00')
  const [blockBusy, setBlockBusy] = useState(false)

  async function loadSlots() {
    const from = format(startOfDay(new Date()), 'yyyy-MM-dd')
    const { data, error: err } = await supabase
      .from('availability_slots')
      .select('*')
      .gte('slot_date', from)
      .neq('status', 'removed')
      .order('slot_date')
      .order('start_time')
    if (err) setError(err.message)
    setSlots((data as AvailabilitySlot[]) ?? [])
    setLoading(false)
  }

  useEffect(() => {
    loadSlots()
    supabase
      .from('services')
      .select('*')
      .eq('active', true)
      .order('sort_order')
      .then(({ data }) => setServices((data as Service[]) ?? []))
  }, [])

  useEffect(() => {
    if (settings?.default_duration_minutes) setDuration(settings.default_duration_minutes)
  }, [settings?.default_duration_minutes])

  useEffect(() => {
    if (!toast) return
    const t = window.setTimeout(() => setToast(null), 4000)
    return () => window.clearTimeout(t)
  }, [toast])

  const weekStats = useMemo(() => {
    const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 })
    const weekEnd = endOfWeek(new Date(), { weekStartsOn: 1 })
    const inWeek = slots.filter((s) => {
      const d = parseISO(`${s.slot_date}T12:00:00`)
      return d >= weekStart && d <= weekEnd && s.status !== 'removed'
    })
    return {
      released: inWeek.length,
      booked: inWeek.filter((s) => s.status === 'confirmed').length,
      available: inWeek.filter((s) => s.status === 'available').length,
      awaiting: inWeek.filter((s) => s.status === 'requested' || s.status === 'held').length,
    }
  }, [slots])

  const upcomingAvailable = useMemo(
    () => slots.filter((s) => s.status === 'available' && s.slot_date >= todayIso()),
    [slots],
  )

  const groupedSlots = useMemo(() => {
    const map = new Map<string, AvailabilitySlot[]>()
    for (const s of slots) {
      if (s.status === 'removed') continue
      const list = map.get(s.slot_date) ?? []
      list.push(s)
      map.set(s.slot_date, list)
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b))
  }, [slots])

  const previewDates = useMemo(
    () => expandRecurringDates(dates, recurringOn, recurringMode, recurringWeeks, recurringUntil),
    [dates, recurringOn, recurringMode, recurringWeeks, recurringUntil],
  )

  const previewCount = previewDates.length * times.length

  const datesWithSlots = useMemo(() => {
    const set = new Set(slots.map((s) => s.slot_date))
    return Array.from(set).sort()
  }, [slots])

  function openRelease(fromTab = false) {
    setReleaseStep(1)
    setDates([])
    setDateInput(todayIso())
    setAppointmentType('both')
    setTimes([])
    setDuration(settings?.default_duration_minutes ?? 60)
    setBufferOverride('')
    setServiceIds([])
    setAdminNote('')
    setRecurringOn(false)
    setRecurringMode('weeks')
    setRecurringWeeks(4)
    setRecurringUntil('')
    setError(null)
    setReleaseOpen(true)
    if (fromTab) setTab('release')
  }

  function addDate() {
    if (!dateInput) return
    if (!dates.includes(dateInput)) setDates((d) => [...d, dateInput].sort())
    setDateInput(format(addDays(parseISO(`${dateInput}T12:00:00`), 1), 'yyyy-MM-dd'))
  }

  function toggleTime(t: string) {
    setTimes((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t].sort()))
  }

  function applyPreset(key: string) {
    const preset = PRESETS[key] ?? []
    setTimes(preset.slice())
  }

  function toggleService(id: string) {
    setServiceIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  async function releaseSlots() {
    if (previewDates.length === 0 || times.length === 0) return
    setReleasing(true)
    setError(null)
    const { data, error: err } = await supabase.rpc('release_availability_slots', {
      p_dates: previewDates,
      p_times: times.map((t) => `${t}:00`),
      p_appointment_type: appointmentType,
      p_duration_minutes: duration,
      p_travel_buffer_minutes: bufferOverride === '' ? null : Number(bufferOverride),
      p_service_ids: serviceIds.length ? serviceIds : [],
      p_admin_note: adminNote.trim() || null,
    })
    setReleasing(false)
    if (err) {
      setError(err.message)
      return
    }
    const n = typeof data === 'number' ? data : previewCount
    setReleaseOpen(false)
    setToast(`${n} appointment times are now available.`)
    setTab('view')
    await loadSlots()
  }

  const boardDays = useMemo(() => horizonDays(horizon), [horizon])

  const occupyMinutes = useMemo(() => {
    const travel =
      appointmentType === 'wig' || appointmentType === 'pickup'
        ? bufferOverride === ''
          ? 0
          : Number(bufferOverride)
        : bufferOverride === ''
          ? (settings?.default_travel_buffer_minutes ?? 30)
          : Number(bufferOverride)
    return Math.max(15, duration) + Math.max(0, travel)
  }, [appointmentType, bufferOverride, duration, settings?.default_travel_buffer_minutes])

  const boardTimes = useMemo(() => {
    const times: string[] = []
    const length = Math.max(15, duration)
    for (let t = 9 * 60; t + length <= 18 * 60; t += 30) {
      const h = Math.floor(t / 60)
      const m = t % 60
      times.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`)
    }
    return times
  }, [duration])

  const postedRanges = useMemo(() => {
    return slots
      .filter((s) => s.status !== 'removed' && s.status !== 'completed')
      .map((s) => {
        const start = toMinutes(s.start_time)
        const end = toMinutes(s.end_time)
        const travel = s.appointment_type === 'wig' || s.appointment_type === 'pickup' ? 0 : s.travel_buffer_minutes
        return {
          date: s.slot_date.slice(0, 10),
          start,
          end: end + travel,
          startLabel: s.start_time.slice(0, 5),
        }
      })
  }, [slots])

  const pickedCount = picked.size

  function blockedReason(date: string, time: string, selection: Set<string>): 'posted' | 'overlap' | null {
    const start = toMinutes(time)
    const end = start + occupyMinutes
    for (const range of postedRanges) {
      if (range.date !== date) continue
      if (range.startLabel === time) return 'posted'
      if (rangesOverlap(start, end, range.start, range.end)) return 'overlap'
    }
    for (const key of selection) {
      if (!key.startsWith(`${date}|`)) continue
      const other = key.slice(date.length + 1)
      if (other === time) continue
      const otherStart = toMinutes(other)
      if (rangesOverlap(start, end, otherStart, otherStart + occupyMinutes)) return 'overlap'
    }
    return null
  }

  function toggleCell(date: string, time: string) {
    const key = pickKey(date, time)
    setPicked((prev) => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
        return next
      }
      if (blockedReason(date, time, next)) return prev
      next.add(key)
      return next
    })
  }

  function paintWindow(date: string, fromMin: number, toMin: number) {
    setPicked((prev) => {
      const next = new Set(prev)
      let cursor = fromMin
      for (const time of boardTimes) {
        const start = toMinutes(time)
        if (start < fromMin || start >= toMin || start < cursor) continue
        if (blockedReason(date, time, next)) continue
        next.add(pickKey(date, time))
        cursor = start + occupyMinutes
      }
      return next
    })
  }

  function clearDay(date: string) {
    setPicked((prev) => {
      const next = new Set(prev)
      for (const key of prev) {
        if (key.startsWith(`${date}|`)) next.delete(key)
      }
      return next
    })
  }

  function copyDayAcrossBoard(date: string) {
    const timesOnDay = [...picked].filter((key) => key.startsWith(`${date}|`)).map((key) => key.slice(date.length + 1))
    if (timesOnDay.length === 0) return
    setPicked((prev) => {
      const next = new Set(prev)
      for (const day of boardDays) {
        const iso = format(day, 'yyyy-MM-dd')
        if (iso === date) continue
        for (const time of timesOnDay) {
          const key = pickKey(iso, time)
          if (!blockedReason(iso, time, next)) next.add(key)
        }
      }
      return next
    })
  }

  function chooseBatchType(value: SlotAppointmentType) {
    setAppointmentType(value)
    setPicked(new Set())
    if (value === 'pickup') {
      setDuration(30)
      setBufferOverride(0)
    }
  }

  async function postBatch() {
    if (picked.size === 0) return
    const byDate = new Map<string, string[]>()
    for (const key of picked) {
      const [date, time] = key.split('|')
      if (!date || !time) continue
      const list = byDate.get(date) ?? []
      list.push(time)
      byDate.set(date, list)
    }
    if (byDate.size === 0) return

    setPosting(true)
    setError(null)
    let created = 0
    for (const [date, dayTimes] of byDate) {
      const { data, error: err } = await supabase.rpc('release_availability_slots', {
        p_dates: [date],
        p_times: dayTimes.sort().map((t) => `${t}:00`),
        p_appointment_type: appointmentType,
        p_duration_minutes: duration,
        p_travel_buffer_minutes:
          bufferOverride === ''
            ? appointmentType === 'pickup' || appointmentType === 'wig'
              ? 0
              : null
            : Number(bufferOverride),
        p_service_ids: serviceIds.length ? serviceIds : [],
        p_admin_note: adminNote.trim() || null,
      })
      if (err) {
        setPosting(false)
        setError(err.message)
        if (created > 0) {
          setToast(`${created} appointment times are now available.`)
          await loadSlots()
        }
        return
      }
      created += typeof data === 'number' ? data : dayTimes.length
    }
    setPosting(false)
    setPicked(new Set())
    setToast(`${created} appointment times are now available.`)
    setTab('view')
    await loadSlots()
  }

  async function copySlots() {
    if (!copyFromDate || !copyToDate) return
    const source = slots.filter(
      (s) => s.slot_date === copyFromDate && (s.status === 'available' || s.status === 'blocked'),
    )
    if (source.length === 0) {
      setError('No slots found on that date to copy.')
      return
    }
    setCopying(true)
    setError(null)
    const timesToCopy = source.map((s) => s.start_time.slice(0, 5))
    const type = source[0]?.appointment_type ?? 'both'
    const dur = source[0]?.duration_minutes ?? 60
    const buf = source[0]?.travel_buffer_minutes ?? null
    const { data, error: err } = await supabase.rpc('release_availability_slots', {
      p_dates: [copyToDate],
      p_times: timesToCopy.map((t) => (t.length === 5 ? `${t}:00` : t)),
      p_appointment_type: type,
      p_duration_minutes: dur,
      p_travel_buffer_minutes: buf,
      p_service_ids: [],
      p_admin_note: `Copied from ${copyFromDate}`,
    })
    setCopying(false)
    if (err) {
      setError(err.message)
      return
    }
    setCopyOpen(false)
    setToast(`${typeof data === 'number' ? data : timesToCopy.length} slots copied to ${formatDate(copyToDate)}.`)
    await loadSlots()
  }

  async function openEdit(slot: AvailabilitySlot) {
    setEditing(slot)
    setEditType(slot.appointment_type)
    setEditDuration(slot.duration_minutes)
    setEditBuffer(slot.travel_buffer_minutes)
    setEditNote(slot.admin_note ?? '')
    const { data } = await supabase
      .from('availability_slot_services')
      .select('service_id')
      .eq('slot_id', slot.id)
    const ids = ((data as { service_id: string }[]) ?? []).map((r) => r.service_id)
    if (ids.length === 0 && slot.service_id) ids.push(slot.service_id)
    setEditServiceIds(ids)
  }

  function warnIfLinked(action: string): boolean {
    if (!editing) return true
    const linked = ['requested', 'confirmed', 'held'].includes(editing.status) && editing.booking_id
    if (!linked) return true
    return window.confirm(
      `This slot is ${SLOT_STATUS_LABELS[editing.status as SlotStatus]} and linked to a booking. ${action} anyway?`,
    )
  }

  async function saveEdit() {
    if (!editing) return
    if (!warnIfLinked('Save changes')) return
    setEditBusy(true)
    setError(null)
    const end = addMinutesToTime(editing.start_time.slice(0, 5), editDuration)
    const { error: err } = await supabase
      .from('availability_slots')
      .update({
        appointment_type: editType,
        duration_minutes: editDuration,
        travel_buffer_minutes: editBuffer,
        end_time: end.length === 5 ? `${end}:00` : end,
        admin_note: editNote.trim() || null,
        service_id: editServiceIds.length === 1 ? editServiceIds[0] : null,
      })
      .eq('id', editing.id)
    if (!err) {
      await supabase.from('availability_slot_services').delete().eq('slot_id', editing.id)
      if (editServiceIds.length) {
        await supabase.from('availability_slot_services').insert(
          editServiceIds.map((service_id) => ({ slot_id: editing.id, service_id })),
        )
      }
    }
    setEditBusy(false)
    if (err) {
      setError(err.message)
      return
    }
    setEditing(null)
    setToast('Slot updated.')
    await loadSlots()
  }

  async function setSlotStatus(status: 'removed' | 'blocked') {
    if (!editing) return
    const label = status === 'removed' ? 'Remove' : 'Block'
    if (!warnIfLinked(label)) return
    setEditBusy(true)
    const { error: err } = await supabase
      .from('availability_slots')
      .update({ status })
      .eq('id', editing.id)
    setEditBusy(false)
    if (err) {
      setError(err.message)
      return
    }
    setEditing(null)
    setToast(status === 'removed' ? 'Slot removed.' : 'Slot blocked.')
    await loadSlots()
  }

  async function createBlock(e: FormEvent) {
    e.preventDefault()
    setBlockBusy(true)
    setError(null)
    const starts_at = new Date(`${blockDate}T${blockStart}:00`).toISOString()
    const ends_at = new Date(`${blockDate}T${blockEnd}:00`).toISOString()
    const { error: err } = await supabase.from('availability_blocks').insert({
      title: blockTitle.trim() || 'Blocked',
      block_type: 'blocked',
      starts_at,
      ends_at,
    })
    if (!err) {
      // Also create a blocked slot for calendar visibility at start time
      await supabase.from('availability_slots').insert({
        slot_date: blockDate,
        start_time: `${blockStart}:00`,
        end_time: `${blockEnd}:00`,
        appointment_type: 'both',
        duration_minutes: Math.max(
          15,
          (parseISO(`1970-01-01T${blockEnd}:00`).getTime() -
            parseISO(`1970-01-01T${blockStart}:00`).getTime()) /
            60000,
        ),
        travel_buffer_minutes: 0,
        status: 'blocked',
        admin_note: blockTitle.trim() || 'Blocked',
      })
    }
    setBlockBusy(false)
    if (err) {
      setError(err.message)
      return
    }
    setToast('Time blocked.')
    setBlockTitle('Blocked')
    await loadSlots()
  }

  return (
    <>
      <div className="admin-topbar">
        <div>
          <h1>Availability</h1>
          <p className="meta">Release appointment times clients can book</p>
        </div>
        <button className="btn btn-primary" type="button" onClick={() => setTab('release')}>
          + Release Availability
        </button>
      </div>

      {toast ? <div className="notice ok">{toast}</div> : null}
      {error ? <div className="notice error">{error}</div> : null}

      <div className="avail-tabs" role="tablist">
        <button
          type="button"
          className={tab === 'release' ? 'active' : ''}
          onClick={() => setTab('release')}
        >
          Release Slots
        </button>
        <button type="button" className={tab === 'view' ? 'active' : ''} onClick={() => setTab('view')}>
          View Released
        </button>
        <button type="button" className={tab === 'block' ? 'active' : ''} onClick={() => setTab('block')}>
          Block Time
        </button>
      </div>

      <div className="panel avail-week-strip">
        <div className="avail-week-head">
          <h2>This week</h2>
          <Link className="btn btn-ghost" to="/admin/calendar">
            View Calendar
          </Link>
        </div>
        <div className="stat-grid avail-week-stats">
          <div className="stat-card">
            <span className="meta">Released</span>
            <strong>{weekStats.released}</strong>
          </div>
          <div className="stat-card">
            <span className="meta">Booked / confirmed</span>
            <strong>{weekStats.booked}</strong>
          </div>
          <div className="stat-card">
            <span className="meta">Available</span>
            <strong>{weekStats.available}</strong>
          </div>
          <div className="stat-card">
            <span className="meta">Awaiting</span>
            <strong>{weekStats.awaiting}</strong>
          </div>
        </div>
      </div>

      {loading ? <div className="admin-loading">Loading availability…</div> : null}

      {!loading && upcomingAvailable.length === 0 && tab === 'view' ? (
        <div className="panel avail-empty">
          <p className="admin-empty" style={{ padding: '1rem 0' }}>
            You haven&apos;t released any upcoming appointment times.
          </p>
          <button className="btn btn-primary" type="button" onClick={() => setTab('release')}>
            Release Availability
          </button>
        </div>
      ) : null}

      {tab === 'view' && !loading ? (
        <div className="avail-slot-groups">
          <div className="action-row" style={{ marginBottom: '0.75rem' }}>
            <button className="btn btn-secondary" type="button" onClick={() => setCopyOpen(true)}>
              Copy slots to another date
            </button>
          </div>
          {groupedSlots.map(([date, daySlots]) => (
            <div key={date} className="panel">
              <h2 style={{ fontSize: '1.15rem' }}>{formatDate(date)}</h2>
              <div className="list">
                {daySlots.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    className="list-item avail-slot-row"
                    onClick={() => openEdit(s)}
                  >
                    <div>
                      <h3>
                        {formatTime(s.start_time)}
                        <span className="meta"> · {slotTypeLabel(s.appointment_type)}</span>
                      </h3>
                      <p className="meta">{s.duration_minutes} min</p>
                    </div>
                    <SlotStatusBadge status={s.status} />
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {tab === 'release' ? (
        <div className="avail-board">
          <div className="panel">
            <h2>Post a batch</h2>
            <p className="meta">
              Choose the stretch of time, tap the slots you want clients to see, then post them together.
            </p>
            <div className="avail-horizons" role="group" aria-label="How far ahead">
              {HORIZONS.map((h) => (
                <button
                  key={h.id}
                  type="button"
                  className={`btn ${horizon === h.id ? 'btn-secondary' : 'btn-ghost'}`}
                  onClick={() => {
                    setHorizon(h.id)
                    setPicked(new Set())
                  }}
                >
                  {h.label}
                </button>
              ))}
            </div>
            <div className="avail-type-grid avail-type-grid--inline">
              {SLOT_TYPE_OPTIONS.map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  className={`avail-type-chip ${appointmentType === value ? 'selected' : ''}`}
                  onClick={() => chooseBatchType(value)}
                >
                  {label}
                </button>
              ))}
            </div>
            <p className="meta">Slot length</p>
            <div className="avail-presets" role="group" aria-label="Slot length">
              {LENGTH_PRESETS.map((minutes) => (
                <button
                  key={minutes}
                  type="button"
                  className={`btn ${duration === minutes ? 'btn-secondary' : 'btn-ghost'}`}
                  onClick={() => {
                    setDuration(minutes)
                    setPicked(new Set())
                  }}
                >
                  {minutes % 60 === 0 ? (minutes === 60 ? '1 hour' : `${minutes / 60} hours`) : `${minutes} min`}
                </button>
              ))}
            </div>
            <p className="meta">
              Each time you tap is a {duration} minute slot
              {appointmentType === 'home_visit' || appointmentType === 'both'
                ? ', with travel time kept clear afterwards.'
                : '.'}{' '}
              Times that would overlap stay unavailable.
            </p>
            <div className="row two">
              <label className="field">
                Custom length (minutes)
                <input
                  type="number"
                  min={15}
                  step={15}
                  value={duration}
                  onChange={(e) => {
                    setDuration(Number(e.target.value))
                    setPicked(new Set())
                  }}
                />
              </label>
              <label className="field">
                Travel buffer
                <input
                  type="number"
                  min={0}
                  placeholder={`Default ${settings?.default_travel_buffer_minutes ?? 30}`}
                  value={bufferOverride}
                  onChange={(e) => setBufferOverride(e.target.value === '' ? '' : Number(e.target.value))}
                />
              </label>
            </div>
          </div>

          <div className="avail-days">
            {boardDays.map((day) => {
              const iso = format(day, 'yyyy-MM-dd')
              const selectedOnDay = [...picked].filter((key) => key.startsWith(`${iso}|`)).length
              const postedOnDay = postedRanges.filter((range) => range.date === iso).length
              return (
                <section key={iso} className="panel avail-day">
                  <div className="avail-day-head">
                    <div>
                      <p className="meta">{format(day, 'EEEE')}</p>
                      <h3>{format(day, 'd MMM')}</h3>
                    </div>
                    <p className="meta">
                      {selectedOnDay > 0 ? `${selectedOnDay} selected` : 'Tap times'}
                      {postedOnDay > 0 ? ` · ${postedOnDay} already posted` : ''}
                    </p>
                  </div>
                  <div className="avail-presets">
                    <button type="button" className="btn btn-ghost" onClick={() => paintWindow(iso, 9 * 60, 12 * 60)}>
                      Morning
                    </button>
                    <button type="button" className="btn btn-ghost" onClick={() => paintWindow(iso, 13 * 60, 17 * 60)}>
                      Afternoon
                    </button>
                    <button type="button" className="btn btn-ghost" onClick={() => paintWindow(iso, 9 * 60, 18 * 60)}>
                      Full day
                    </button>
                    <button type="button" className="btn btn-ghost" onClick={() => clearDay(iso)} disabled={selectedOnDay === 0}>
                      Clear
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => copyDayAcrossBoard(iso)}
                      disabled={selectedOnDay === 0}
                    >
                      Copy to all days
                    </button>
                  </div>
                  <div className="avail-time-chips">
                    {boardTimes.map((t) => {
                      const selected = picked.has(pickKey(iso, t))
                      const reason = blockedReason(iso, t, picked)
                      const unavailable = reason === 'posted' || (reason === 'overlap' && !selected)
                      return (
                        <button
                          key={t}
                          type="button"
                          className={`time-chip ${selected ? 'selected' : ''} ${reason === 'posted' ? 'posted' : ''}`}
                          disabled={unavailable}
                          aria-pressed={selected}
                          onClick={() => toggleCell(iso, t)}
                        >
                          {t}
                          <span className="time-chip-note">
                            {reason === 'posted'
                              ? 'Posted'
                              : unavailable
                                ? 'Overlaps'
                                : `– ${addMinutesToTime(t, duration)}`}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </section>
              )
            })}
          </div>

          <div className="avail-postbar">
            <div>
              <strong>
                {pickedCount} slot{pickedCount === 1 ? '' : 's'} selected
              </strong>
              <p className="meta">Nothing goes live until you post this batch.</p>
            </div>
            <div className="action-row">
              <button className="btn btn-ghost" type="button" onClick={() => setPicked(new Set())} disabled={pickedCount === 0}>
                Clear selection
              </button>
              <button className="btn btn-primary" type="button" disabled={posting || pickedCount === 0} onClick={postBatch}>
                {posting ? 'Posting…' : `Post ${pickedCount} slot${pickedCount === 1 ? '' : 's'}`}
              </button>
            </div>
          </div>

          <p className="meta" style={{ textAlign: 'center' }}>
            Need the same times on every chosen date?{' '}
            <button type="button" className="linkish" onClick={() => openRelease()}>
              Use the quick release instead
            </button>
          </p>
        </div>
      ) : null}

      {tab === 'block' ? (
        <form className="panel admin-form" onSubmit={createBlock}>
          <h2>Block time</h2>
          <p className="meta">Creates a blocked period so that time is unavailable.</p>
          <label className="field">
            Title
            <input value={blockTitle} onChange={(e) => setBlockTitle(e.target.value)} required />
          </label>
          <div className="row two">
            <label className="field">
              Date
              <input type="date" value={blockDate} onChange={(e) => setBlockDate(e.target.value)} required />
            </label>
            <label className="field">
              Start
              <input type="time" value={blockStart} onChange={(e) => setBlockStart(e.target.value)} required />
            </label>
            <label className="field">
              End
              <input type="time" value={blockEnd} onChange={(e) => setBlockEnd(e.target.value)} required />
            </label>
          </div>
          <button className="btn btn-primary" type="submit" disabled={blockBusy}>
            {blockBusy ? 'Saving…' : 'Block time'}
          </button>
        </form>
      ) : null}

      <Modal
        open={releaseOpen}
        title="Release Availability"
        onClose={() => setReleaseOpen(false)}
        actions={
          <>
            {releaseStep > 1 ? (
              <button className="btn btn-ghost" type="button" onClick={() => setReleaseStep((s) => s - 1)}>
                Back
              </button>
            ) : (
              <button className="btn btn-ghost" type="button" onClick={() => setReleaseOpen(false)}>
                Cancel
              </button>
            )}
            {releaseStep < 3 ? (
              <button
                className="btn btn-primary"
                type="button"
                disabled={releaseStep === 1 ? dates.length === 0 : false}
                onClick={() => setReleaseStep((s) => s + 1)}
              >
                Continue
              </button>
            ) : (
              <button
                className="btn btn-primary"
                type="button"
                disabled={releasing || times.length === 0 || previewDates.length === 0}
                onClick={releaseSlots}
              >
                {releasing ? 'Releasing…' : `Release ${previewCount} Slot${previewCount === 1 ? '' : 's'}`}
              </button>
            )}
          </>
        }
      >
        <div className="avail-wizard">
          <div className="avail-wizard-steps">
            <span className={releaseStep === 1 ? 'active' : ''}>1 · Dates</span>
            <span className={releaseStep === 2 ? 'active' : ''}>2 · Type</span>
            <span className={releaseStep === 3 ? 'active' : ''}>3 · Times</span>
          </div>

          {releaseStep === 1 ? (
            <div className="admin-form">
              <label className="field">
                Add date
                <div className="avail-date-add">
                  <input type="date" value={dateInput} onChange={(e) => setDateInput(e.target.value)} />
                  <button className="btn btn-secondary" type="button" onClick={addDate}>
                    Add
                  </button>
                </div>
              </label>
              {dates.length > 0 ? (
                <ul className="avail-date-list">
                  {dates.map((d) => (
                    <li key={d}>
                      <span>{formatDate(d)}</span>
                      <button
                        type="button"
                        className="icon-btn"
                        aria-label={`Remove ${d}`}
                        onClick={() => setDates((prev) => prev.filter((x) => x !== d))}
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="meta">Add one or more dates for the times you want to release.</p>
              )}
            </div>
          ) : null}

          {releaseStep === 2 ? (
            <div className="avail-type-grid">
              {SLOT_TYPE_OPTIONS.map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  className={`avail-type-chip ${appointmentType === value ? 'selected' : ''}`}
                  onClick={() => setAppointmentType(value)}
                >
                  {label}
                </button>
              ))}
            </div>
          ) : null}

          {releaseStep === 3 ? (
            <div className="admin-form">
              <div className="avail-presets">
                {Object.keys(PRESETS).map((key) => (
                  <button key={key} type="button" className="btn btn-ghost" onClick={() => applyPreset(key)}>
                    {key}
                  </button>
                ))}
              </div>
              <div className="avail-time-chips">
                {TIME_OPTIONS.map((t) => (
                  <button
                    key={t}
                    type="button"
                    className={`time-chip ${times.includes(t) ? 'selected' : ''}`}
                    onClick={() => toggleTime(t)}
                  >
                    {t}
                  </button>
                ))}
              </div>

              <div className="row two">
                <label className="field">
                  Duration (minutes)
                  <input
                    type="number"
                    min={15}
                    step={15}
                    value={duration}
                    onChange={(e) => setDuration(Number(e.target.value))}
                  />
                </label>
                <label className="field">
                  Travel buffer override
                  <input
                    type="number"
                    min={0}
                    placeholder={`Default ${settings?.default_travel_buffer_minutes ?? 30}`}
                    value={bufferOverride}
                    onChange={(e) =>
                      setBufferOverride(e.target.value === '' ? '' : Number(e.target.value))
                    }
                  />
                </label>
              </div>

              <fieldset className="avail-services">
                <legend>Restrict to services (optional)</legend>
                <div className="avail-service-list">
                  {services.map((s) => (
                    <label key={s.id} className="avail-service-check">
                      <input
                        type="checkbox"
                        checked={serviceIds.includes(s.id)}
                        onChange={() => toggleService(s.id)}
                      />
                      {s.name}
                    </label>
                  ))}
                </div>
              </fieldset>

              <label className="field">
                Admin note (optional)
                <textarea value={adminNote} onChange={(e) => setAdminNote(e.target.value)} rows={2} />
              </label>

              <label className="avail-recurring-toggle">
                <input
                  type="checkbox"
                  checked={recurringOn}
                  onChange={(e) => setRecurringOn(e.target.checked)}
                />
                Repeat weekly
              </label>
              {recurringOn ? (
                <div className="avail-recurring">
                  <div className="action-row">
                    <button
                      type="button"
                      className={`btn ${recurringMode === 'weeks' ? 'btn-secondary' : 'btn-ghost'}`}
                      onClick={() => setRecurringMode('weeks')}
                    >
                      For N weeks
                    </button>
                    <button
                      type="button"
                      className={`btn ${recurringMode === 'until' ? 'btn-secondary' : 'btn-ghost'}`}
                      onClick={() => setRecurringMode('until')}
                    >
                      Until date
                    </button>
                  </div>
                  {recurringMode === 'weeks' ? (
                    <label className="field">
                      Number of weeks (including first)
                      <input
                        type="number"
                        min={2}
                        max={26}
                        value={recurringWeeks}
                        onChange={(e) => setRecurringWeeks(Number(e.target.value))}
                      />
                    </label>
                  ) : (
                    <label className="field">
                      Until
                      <input
                        type="date"
                        value={recurringUntil}
                        onChange={(e) => setRecurringUntil(e.target.value)}
                      />
                    </label>
                  )}
                </div>
              ) : null}

              {previewCount > 0 ? (
                <div className="avail-preview">
                  <h3>
                    Preview · {previewCount} slot{previewCount === 1 ? '' : 's'}
                  </h3>
                  <ul>
                    {previewDates.slice(0, 8).map((d) => (
                      <li key={d}>
                        {formatDate(d)} · {times.map(formatTime).join(', ')}
                      </li>
                    ))}
                    {previewDates.length > 8 ? (
                      <li className="meta">…and {previewDates.length - 8} more dates</li>
                    ) : null}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </Modal>

      <Modal
        open={copyOpen}
        title="Copy slots to another date"
        onClose={() => setCopyOpen(false)}
        actions={
          <>
            <button className="btn btn-ghost" type="button" onClick={() => setCopyOpen(false)}>
              Cancel
            </button>
            <button
              className="btn btn-primary"
              type="button"
              disabled={copying || !copyFromDate || !copyToDate}
              onClick={copySlots}
            >
              {copying ? 'Copying…' : 'Copy slots'}
            </button>
          </>
        }
      >
        <div className="admin-form">
          <label className="field">
            Copy from date
            <select value={copyFromDate} onChange={(e) => setCopyFromDate(e.target.value)}>
              <option value="">Select a day with slots</option>
              {datesWithSlots.map((d) => (
                <option key={d} value={d}>
                  {formatDate(d)}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Copy to date
            <input type="date" value={copyToDate} onChange={(e) => setCopyToDate(e.target.value)} />
          </label>
        </div>
      </Modal>

      <Modal
        open={!!editing}
        title={editing ? `Edit ${formatTime(editing.start_time)} · ${formatDate(editing.slot_date)}` : 'Edit slot'}
        onClose={() => setEditing(null)}
        actions={
          <>
            <button className="btn btn-danger" type="button" disabled={editBusy} onClick={() => setSlotStatus('removed')}>
              Remove
            </button>
            <button className="btn btn-ghost" type="button" disabled={editBusy} onClick={() => setSlotStatus('blocked')}>
              Block
            </button>
            <button className="btn btn-primary" type="button" disabled={editBusy} onClick={saveEdit}>
              Save
            </button>
          </>
        }
      >
        {editing ? (
          <div className="admin-form">
            <div className="kv">
              <span>Status</span>
              <strong>
                <SlotStatusBadge status={editing.status} />
              </strong>
            </div>
            {editing.booking_id ? (
              <p className="meta">
                Linked booking:{' '}
                <Link to={`/admin/bookings/${editing.booking_id}`}>{editing.booking_id.slice(0, 8)}…</Link>
              </p>
            ) : null}
            <div className="avail-type-grid">
              {SLOT_TYPE_OPTIONS.map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  className={`avail-type-chip ${editType === value ? 'selected' : ''}`}
                  onClick={() => setEditType(value)}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="row two">
              <label className="field">
                Duration
                <input
                  type="number"
                  min={15}
                  value={editDuration}
                  onChange={(e) => setEditDuration(Number(e.target.value))}
                />
              </label>
              <label className="field">
                Travel buffer
                <input
                  type="number"
                  min={0}
                  value={editBuffer}
                  onChange={(e) => setEditBuffer(Number(e.target.value))}
                />
              </label>
            </div>
            <fieldset className="avail-services">
              <legend>Service restriction</legend>
              <div className="avail-service-list">
                {services.map((s) => (
                  <label key={s.id} className="avail-service-check">
                    <input
                      type="checkbox"
                      checked={editServiceIds.includes(s.id)}
                      onChange={() =>
                        setEditServiceIds((prev) =>
                          prev.includes(s.id) ? prev.filter((x) => x !== s.id) : [...prev, s.id],
                        )
                      }
                    />
                    {s.name}
                  </label>
                ))}
              </div>
            </fieldset>
            <label className="field">
              Admin note
              <textarea value={editNote} onChange={(e) => setEditNote(e.target.value)} rows={2} />
            </label>
          </div>
        ) : null}
      </Modal>
    </>
  )
}
