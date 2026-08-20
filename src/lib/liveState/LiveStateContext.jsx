import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { loadState, saveState, isSupabaseConfigured } from '../storage/storageAdapter'
import { getDefaultLiveState, getDefaultCharacterProgress, mergeWithDefaults } from './defaultLiveState'
import { computeEffectiveSheet } from './computeEffectiveSheet'

const LiveStateContext = createContext(null)
const SAVE_DEBOUNCE_MS = 400

// sheet and dailyAbilities are no longer precomputed props — they're derived
// here from characterProgress (level, xp, hpRolls, skills, feats, ability
// adjustments, wild shape uses), which is itself part of the live state. So
// a level-up (which only ever edits characterProgress) recomputes the whole
// sheet for free, with no separate "apply level-up effects" step anywhere.
export function LiveStateProvider({ children, character, items, progressionTable, spellSlotsBaseTable, companion }) {
  const [state, setState] = useState(null)
  const [syncStatus, setSyncStatus] = useState('loading')
  const readyRef = useRef(false)
  const saveTimer = useRef(null)

  const ingredients = { character, items, progressionTable, spellSlotsBaseTable }

  useEffect(() => {
    let cancelled = false
    loadState().then(({ state: loaded, source }) => {
      if (cancelled) return
      const characterProgress = loaded?.characterProgress ?? getDefaultCharacterProgress(character)
      const { sheet, dailyAbilities } = computeEffectiveSheet({ ...ingredients, characterProgress })
      const defaults = getDefaultLiveState({ sheet, dailyAbilities, companion, characterProgress })
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

  const { sheet, dailyAbilities } = useMemo(() => {
    if (!state) return { sheet: null, dailyAbilities: null }
    return computeEffectiveSheet({ ...ingredients, characterProgress: state.characterProgress })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.characterProgress])

  function update(updater) {
    setState((prev) => updater(prev))
  }

  function longRest() {
    setState((prev) => getDefaultLiveState({ sheet, dailyAbilities, companion, characterProgress: prev.characterProgress }))
  }

  function replaceAll(nextState) {
    const characterProgress = nextState.characterProgress ?? state.characterProgress
    const effective = computeEffectiveSheet({ ...ingredients, characterProgress })
    const defaults = getDefaultLiveState({ ...effective, companion, characterProgress })
    setState(mergeWithDefaults(nextState, defaults))
  }

  if (!state || !sheet) {
    return <p className="loading-note">Loading saved state…</p>
  }

  return (
    <LiveStateContext.Provider
      value={{ state, update, longRest, replaceAll, syncStatus, isSupabaseConfigured, sheet, dailyAbilities, companion }}
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
