import { useMemo, useRef } from 'react'
import { unitHTML } from './cardRender'
import { useFitCards } from './useFitCards'

// The live, true-print-size preview of whatever's currently in the editor —
// a single card, or a fold pair once "continue on second card" is on. Not
// part of the .row grid the print sheets use, so a plain centering wrapper
// around the raw card/fold markup is safe here (see PrintSheets for why that
// wrapper matters more there).
export default function CardPreview({ spellForCard }) {
  const ref = useRef(null)
  const html = useMemo(() => unitHTML(spellForCard), [spellForCard])
  useFitCards(ref, [html])

  return (
    <div className="preview-frame">
      {/* eslint-disable-next-line react/no-danger */}
      <div ref={ref} dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  )
}
