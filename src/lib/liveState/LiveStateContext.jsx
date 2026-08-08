import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { loadState, saveState, isSupabaseConfigured } from '../storage/storageAdapter'
import { getDefaultLiveState, mergeWithDefaults } from './defaultLiveState'

const LiveStateContext = createContext(null)
const SAVE_DEBOUNCE_MS = 400

export function LiveStateProvider({ children, sheet, dailyAbilities, companion }) {
  const [state, setState] = useState(null)
  const [syncStatus, setSyncStatus] = useState('loading')
  const readyRef = useRef(false)
  const saveTimer = useRef(null)

  useEffect(() => {
    let cancelled = false
    loadState().then(({ state: loaded, source }) => {
      if (cancelled) return
      const defaults = getDefaultLiveState({ sheet, dailyAbilities, companion })
      setState(mergeWithDefaults(loaded, defaults))
      setSyncStatus(source === 'supabase' ? 'synced' : isSupabaseConfigured ? 'error' : 'offline')
      readyRef.current = true
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!readyRef.current || !state) return
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      saveState({ ...state, updatedAt: new Date().toISOString() }).then(({ source, error }) => {
        setSyncStatus(error ? 'error' : source === 'supabase' ? 'synced' : 'offline')
      })
    }, SAVE_DEBOUNCE_MS)
    return () => clearTimeout(saveTimer.current)
  }, [state])

  function update(updater) {
    setState((prev) => updater(prev))
  }

  function longRest() {
    setState(getDefaultLiveState({ sheet, dailyAbilities, companion }))
  }

  function replaceAll(nextState) {
    setState(mergeWithDefaults(nextState, getDefaultLiveState({ sheet, dailyAbilities, companion })))
  }

  if (!state) {
    return <p className="loading-note">Loading saved state…</p>
  }

  return (
    <LiveStateContext.Provider
      value={{ state, update, longRest, replaceAll, syncStatus, isSupabaseConfigured }}
    >
      {children}
    </LiveStateContext.Provider>
  )
}

export function useLiveState() {
  const ctx = useContext(LiveStateContext)
  if (!ctx) throw new Error('useLiveState must be used within a LiveStateProvider')
  return ctx
}
