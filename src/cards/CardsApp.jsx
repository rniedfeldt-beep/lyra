import { useEffect, useState } from 'react'
import { spellNameToFile } from '../lib/spellReferenceData'
import { blankCardBlock, buildCardSpell, canonicalMechFields, cleanCard } from './cardRender'
import { copyCardJSON, loadDraft, loadQueue, saveCardToFile, saveDraft, saveQueue } from './persist'
import SpellPicker from './SpellPicker'
import CardEditor from './CardEditor'
import CardPreview from './CardPreview'
import QueueList from './QueueList'
import PrintSheets from './PrintSheets'
import './spellCards.css'

export default function CardsApp() {
  const [mechFields, setMechFields] = useState(null)
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

  function handleSelect(group) {
    const mech = canonicalMechFields(group)
    const initial = loadDraft(mech.name) ?? mech.existingCard ?? blankCardBlock()
    setMechFields(mech)
    setDraft({ ...blankCardBlock(), ...initial })
    setSaveStatus(null)
  }

  // Saves to data/spells/<file>.json via the local dev/preview-only endpoint;
  // falls back to a clipboard copy of the card JSON when that's unavailable,
  // which is the expected outcome on the deployed static site. Returns the
  // cleaned card (or null if nothing was typed) either way, for the queue.
  async function persistCurrent() {
    if (!mechFields) return null
    const cleaned = cleanCard(draft)
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
    setQueue((q) => [...q, buildCardSpell(mechFields, cleaned)])
  }

  function handleRemove(i) {
    setQueue((q) => q.filter((_, idx) => idx !== i))
  }

  const previewSpell = mechFields && draft ? buildCardSpell(mechFields, draft) : null

  return (
    <div className="cards-app">
      <div className="cards-header no-print">
        <h1>Spell Cards</h1>
        <p>Search a spell, compose its card, add it to the print queue, then print.</p>
      </div>

      <div className="cards-layout no-print">
        <div>
          <SpellPicker onSelect={handleSelect} />
          {mechFields && draft && (
            <CardEditor
              mechFields={mechFields}
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
