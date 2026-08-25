import { useEffect, useState } from 'react'
import { spellGroups, spellNameToFile } from '../lib/spellReferenceData'
import {
  applyCardPatch,
  applyMechPatch,
  blankCardBlock,
  buildCardSpell,
  buildCardToSave,
  canonicalMechFields,
  cleanCard,
  initialMechDraft,
} from './cardRender'
import { copyCardJSON, loadDraft, loadQueue, saveCardToFile, saveDraft, saveQueue } from './persist'
import SpellPicker from './SpellPicker'
import PasteToFill from './PasteToFill'
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
  const [mechFields, setMechFields] = useState(null)
  const [mechDraft, setMechDraft] = useState(null)
  const [draft, setDraft] = useState(null)
  const [queue, setQueue] = useState(() => loadQueue())
  const [saveStatus, setSaveStatus] = useState(null)

  useEffect(() => {
    saveQueue(queue)
  }, [queue])

  useEffect(() => {
    if (!mechFields || !draft) return
    saveDraft(mechFields.name, draft)
  }, [mechFields, draft])

  function loadSpell(group) {
    const mech = canonicalMechFields(group)
    const initial = loadDraft(mech.name) ?? mech.existingCard ?? blankCardBlock()
    setMechFields(mech)
    setMechDraft(initialMechDraft(mech))
    setDraft({ ...blankCardBlock(), ...initial })
    setSaveStatus(null)
    return mech
  }

  function handleSelect(group) {
    loadSpell(group)
  }

  // Paste to Fill's single-spell path: find the spell by its parsed name
  // (a faster alternative to searching for it manually — you've already
  // got the full text), load it exactly like handleSelect, then layer the
  // parsed mech/description fields on top of whatever that load produced.
  function handleFillSingle(name, mechPatch, cardPatch) {
    const group = findGroupByName(name)
    if (!group) return { ok: false, reason: 'not found in data/spells/' }
    const mech = loadSpell(group)
    setMechDraft((prev) => applyMechPatch(prev ?? initialMechDraft(mech), mechPatch))
    setDraft((prev) => applyCardPatch(prev ?? blankCardBlock(), cardPatch))
    return { ok: true }
  }

  // Paste to Fill's multi-spell path: same lookup, but skips the editor
  // entirely and pushes straight to the print queue, best-effort-saving
  // each to its file too (silently — see persistCurrent for why a failed
  // save there isn't an error worth surfacing per spell in a bulk import).
  function handleBulkAdd(name, mechPatch, cardPatch) {
    const group = findGroupByName(name)
    if (!group) return { ok: false, reason: 'not found in data/spells/' }
    const mech = canonicalMechFields(group)
    const mechFull = applyMechPatch(initialMechDraft(mech), mechPatch)
    const cardFull = applyCardPatch(blankCardBlock(), cardPatch)
    const cleaned = buildCardToSave(cardFull, mechFull, mech)

    setQueue((q) => [...q, buildCardSpell({ name: mech.name, ...mechFull }, cleanCard(cardFull))])

    const fileName = spellNameToFile[mech.name]
    if (fileName) saveCardToFile({ fileName, spellName: mech.name, card: cleaned }).catch(() => {})
    return { ok: true }
  }

  // Saves to data/spells/<file>.json via the local dev/preview-only endpoint;
  // falls back to a clipboard copy of the card JSON when that's unavailable,
  // which is the expected outcome on the deployed static site. Returns the
  // cleaned card (or null if nothing was typed/overridden) either way, for
  // the queue.
  async function persistCurrent() {
    if (!mechFields || !mechDraft) return null
    const cleaned = buildCardToSave(draft, mechDraft, mechFields)
    const fileName = spellNameToFile[mechFields.name]
    if (!fileName) {
      setSaveStatus({ type: 'err', message: 'No source file found for this spell — nothing saved.' })
      return cleaned
    }
    try {
      await saveCardToFile({ fileName, spellName: mechFields.name, card: cleaned })
      setSaveStatus({ type: 'ok', message: `Saved to data/spells/${fileName}.` })
    } catch {
      try {
        await copyCardJSON(cleaned ?? {})
        setSaveStatus({
          type: 'err',
          message: 'Local save unavailable (expected on the deployed site) — card JSON copied to clipboard instead.',
        })
      } catch {
        setSaveStatus({ type: 'err', message: 'Local save unavailable and clipboard copy failed.' })
      }
    }
    return cleaned
  }

  async function handleSave() {
    await persistCurrent()
  }

  async function handleAddToQueue() {
    const cleaned = await persistCurrent()
    setQueue((q) => [...q, buildCardSpell({ name: mechFields.name, ...mechDraft }, cleaned)])
  }

  function handleRemove(i) {
    setQueue((q) => q.filter((_, idx) => idx !== i))
  }

  const previewSpell =
    mechFields && mechDraft && draft ? buildCardSpell({ name: mechFields.name, ...mechDraft }, draft) : null

  return (
    <div className="cards-app">
      <div className="cards-header no-print">
        <h1>Spell Cards</h1>
        <p>Search a spell, compose its card, add it to the print queue, then print.</p>
      </div>

      <div className="cards-layout no-print">
        <div>
          <SpellPicker onSelect={handleSelect} />
          <PasteToFill onFillSingle={handleFillSingle} onBulkAdd={handleBulkAdd} />
          {mechFields && mechDraft && draft && (
            <CardEditor
              mechFields={mechFields}
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
        </div>
      </div>

      <PrintSheets queue={queue} />
    </div>
  )
}
