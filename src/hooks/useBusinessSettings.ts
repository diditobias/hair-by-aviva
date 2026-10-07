import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { BusinessSettings } from '../lib/types'

export function useBusinessSettings() {
  const [settings, setSettings] = useState<BusinessSettings | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    supabase
      .from('business_settings')
      .select('*')
      .eq('id', 1)
      .maybeSingle()
      .then(({ data }) => {
        if (!mounted) return
        setSettings((data as BusinessSettings) ?? null)
        setLoading(false)
      })
    return () => {
      mounted = false
    }
  }, [])

  return { settings, loading, setSettings }
}
