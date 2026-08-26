import { useEffect, useRef } from 'react'
import { isSupabaseConfigured, supabase } from '../lib/supabase'

/**
 * Debounced Supabase Realtime (postgres_changes) + optional tab-focus refresh.
 * Safe for multi-tab demos: one channel, many tables, no auth/logic changes.
 *
 * @param {string[]} tables - public table names (Realtime must be enabled in dashboard)
 * @param {() => void} onChange - usually a load/refresh function
 */
export function useRealtimeTables(
  tables,
  onChange,
  {
    channelName = 'es-live',
    debounceMs = 450,
    refreshOnFocus = true,
    enabled = true,
  } = {},
) {
  const cbRef = useRef(onChange)
  cbRef.current = onChange

  const list = (Array.isArray(tables) ? tables : [])
    .map((t) => String(t || '').trim())
    .filter(Boolean)
  const tablesKey = list.slice().sort().join('|')

  useEffect(() => {
    if (!enabled || !isSupabaseConfigured || !tablesKey) return undefined

    let timer = null
    const kick = () => {
      if (timer) window.clearTimeout(timer)
      timer = window.setTimeout(() => {
        try {
          cbRef.current?.()
        } catch (err) {
          console.warn('[useRealtimeTables] refresh failed', err)
        }
      }, debounceMs)
    }

    const name = `${channelName}:${tablesKey}`.slice(0, 120)
    let channel = supabase.channel(name)
    for (const table of list) {
      channel = channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table },
        kick,
      )
    }

    channel.subscribe((status) => {
      if (status === 'CHANNEL_ERROR') {
        console.warn(
          `[useRealtimeTables] channel error for ${tablesKey} — check Realtime is ON for these tables`,
        )
      }
    })

    const onVis = () => {
      if (!refreshOnFocus) return
      if (document.visibilityState === 'visible') kick()
    }
    if (refreshOnFocus) {
      document.addEventListener('visibilitychange', onVis)
      window.addEventListener('focus', onVis)
    }

    return () => {
      if (timer) window.clearTimeout(timer)
      if (refreshOnFocus) {
        document.removeEventListener('visibilitychange', onVis)
        window.removeEventListener('focus', onVis)
      }
      supabase.removeChannel(channel)
    }
    // list is derived from tablesKey; intentional
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tablesKey, channelName, debounceMs, refreshOnFocus, enabled])
}
