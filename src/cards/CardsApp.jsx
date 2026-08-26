import { useEffect, useMemo, useState } from 'react'
import { spellGroups } from '../lib/spellReferenceData'
import {
  applyCardPatch,
  applyMechPatch,
  blankCardBlock,
  blankMechDraft,
  buildCardSpell,
  canonicalMechFields,
  cleanCard,
  pickMechFields,
} from './cardRender'
import { loadDraft, loadQueue, saveDraft, saveQueue } from './persist'
import { fetchCardsForCharacter, fetchCharacters, saveCard } from './supabaseCards'
import CharacterPicker from './CharacterPicker'
import SpellPicker from './SpellPicker'
import PasteToFill from './PasteToFill'
import SavedCards from './SavedCards'
import CardEditor from './CardEditor'
import CardPreview from './CardPreview'
import QueueList from './QueueList'
import PrintSheets from './PrintSheets'
import './spellCards.css'

function findGroupByName(name) {
  const key = (name || '').trim().toLowerCase()
  return spellGroups.find((g) => g.name.toLowerCase() === key) ?? null
}

export default function CardsApp() {
  const [character, setCharacter] = useState('Lyra')
  const [characters, setCharacters] = useState(['Lyra', 'Vaelith'])
  const [savedCards, setSavedCards] = useState([])
  const [mechDraft, setMechDraft] = useState(null)
  const [draft, setDraft] = useState(null)
  const [queue, setQueue] = useState(() => loadQueue())
  const [saveStatus, setSaveStatus] = useState(null)

  useEffect(() => {
    fetchCharacters().then((list) => setCharacters((cs) => [...new Set([...cs, ...list])]))
  }, [])

  useEffect(() => {
    let cancelled = false
    fetchCardsForCharacter(character).then((rows) => {
      if (!cancelled) setSavedCards(rows)
    })
    return () => {
      cancelled = true
    }
  }, [character])

  useEffect(() => {
    saveQueue(queue)
  }, [queue])

  useEffect(() => {
    if (!mechDraft?.name || !draft) return
    saveDraft(character, mechDraft.name, draft)
  }, [character, mechDraft, draft])

  const savedByName = useMemo(
    () => new Map(savedCards.map((row) => [row.spell_name.toLowerCase(), row])),
    [savedCards],
  )
  const savedNames = useMemo(() => new Set(savedByName.keys()), [savedByName])

  // The single "what do we know about this spell already" lookup, used by
  // every entry point below (search, paste-fill, saved-card load): a
  // previously-saved card for *this* character always wins, since it's the
  // most specific and most recently intentional thing we know; the
  // druid-only data/spells/ match (if any) is only a fallback for a spell
  // that's never been saved before, and blank is the fallback under that.
  function baseFor(name, group) {
    const saved = savedByName.get((name || '').toLowerCase())
    if (saved) {
      return {
        mech: pickMechFields(saved.mech),
        card: { ...blankCardBlock(), ...saved.card },
      }
    }
    if (group) {
      return { mech: pickMechFields(canonicalMechFields(group)), card: blankCardBlock() }
    }
    return { mech: blankMechDraft(), card: blankCardBlock() }
  }

  function loadInto(name, group) {
    const base = baseFor(name, group)
    setMechDraft({ name, ...base.mech })
    setDraft(loadDraft(character, name) ?? base.card)
    setSaveStatus(null)
  }

  // Closes the editor entirely rather than leaving whatever was last in it
  // on screen — used wherever the "current card" stops meaning anything:
  // switching character (a different character's cards, nothing about the
  // old one applies) and after queueing (that card is done; the next
  // action should be an explicit pick, paste, or "New card", not editing
  // leftover fields). Nothing from a previous card should survive unless
  // it's an explicit load (loadInto/handleFillSingle, both of which start
  // from a fresh baseFor() every time, or "New card" below).
  function clearEditor() {
    setMechDraft(null)
    setDraft(null)
    setSaveStatus(null)
  }

  function handleCharacterChange(next) {
    setCharacter(next)
    clearEditor()
  }

  // An explicit blank slate for typing a card by hand — a spell with
  // neither a data/spells/ entry nor pasteable text still needs a way in.
  function handleNewCard() {
    setMechDraft({ name: '', ...blankMechDraft() })
    setDraft(blankCardBlock())
    setSaveStatus(null)
  }

  function handleSelect(group) {
    loadInto(group.name, group)
  }

  function handleLoadSaved(row) {
    loadInto(row.spell_name, findGroupByName(row.spell_name))
  }

  // Paste to Fill's single-spell path. Never gated on data/spells/ — a
  // match there (or a previously-saved card for this character) is used to
  // fill in whatever the paste itself didn't find, but the paste always
  // succeeds and always populates the form on its own.
  function handleFillSingle(name, mechPatch, cardPatch) {
    const group = findGroupByName(name)
    const base = baseFor(name, group)
    setMechDraft({ name, ...applyMechPatch(base.mech, mechPatch) })
    setDraft(applyCardPatch(base.card, cardPatch))
    setSaveStatus(null)
    return { ok: true, foundInData: !!group }
  }

  // Paste to Fill's multi-spell path: same "always works" rule, straight
  // to the print queue and a Supabase save per spell, no editor round-trip.
  function handleBulkAdd(name, mechPatch, cardPatch) {
    const group = findGroupByName(name)
    const base = baseFor(name, group)
    const mech = applyMechPatch(base.mech, mechPatch)
    const card = cleanCard(applyCardPatch(base.card, cardPatch)) ?? {}

    setQueue((q) => [...q, buildCardSpell({ name, ...mech }, card)])
    saveCard(character, name, mech, card).catch((err) => console.warn('Bulk save to Supabase failed:', err.message))
    return { ok: true }
  }

  async function persistCurrent() {
    if (!mechDraft?.name) {
      setSaveStatus({ type: 'err', message: 'Nothing to save — no spell name.' })
      return null
    }
    const { name, ...mech } = mechDraft
    const card = cleanCard(draft) ?? {}
    try {
      await saveCard(character, name, mech, card)
      setSaveStatus({ type: 'ok', message: `Saved for ${character}.` })
      setSavedCards(await fetchCardsForCharacter(character))
    } catch (err) {
      setSaveStatus({ type: 'err', message: `Save failed: ${err.message}` })
    }
    return card
  }

  async function handleSave() {
    await persistCurrent()
  }

  async function handleAddToQueue() {
    const card = await persistCurrent()
    if (card == null) return
    const { name, ...mech } = mechDraft
    setQueue((q) => [...q, buildCardSpell({ name, ...mech }, card)])
    clearEditor()
  }

  function handleRemove(i) {
    setQueue((q) => q.filter((_, idx) => idx !== i))
  }

  function handleAddCharacter(name) {
    setCharacters((cs) => (cs.includes(name) ? cs : [...cs, name]))
    setCharacter(name)
    clearEditor()
  }

  const previewSpell = mechDraft && draft ? buildCardSpell(mechDraft, draft) : null

  return (
    <div className="cards-app">
      <div className="cards-header no-print">
        <h1>Spell Cards</h1>
        <p>Search a spell, compose its card, add it to the print queue, then print.</p>
        <button type="button" className="btn btn-small" onClick={handleNewCard}>
          New Card
        </button>
      </div>

      <div className="cards-layout no-print">
        <div>
          <CharacterPicker character={character} characters={characters} onChange={handleCharacterChange} onAdd={handleAddCharacter} />
          <SpellPicker onSelect={handleSelect} savedNames={savedNames} />
          <PasteToFill onFillSingle={handleFillSingle} onBulkAdd={handleBulkAdd} />
          {mechDraft && draft && (
            <CardEditor
              mechDraft={mechDraft}
              onMechChange={setMechDraft}
              draft={draft}
              onChange={setDraft}
              onSave={handleSave}
              onAddToQueue={handleAddToQueue}
              saveStatus={saveStatus}
            />
          )}
        </div>
        <div>
          <div className="panel">
            <h2>Live Preview</h2>
            {previewSpell ? (
              <CardPreview spellForCard={previewSpell} />
            ) : (
              <p className="queue-empty">Pick a spell to preview its card.</p>
            )}
          </div>
          <QueueList queue={queue} onRemove={handleRemove} />
          <SavedCards character={character} savedCards={savedCards} onLoad={handleLoadSaved} />
        </div>
      </div>

      <PrintSheets queue={queue} />
    </div>
  )
}
