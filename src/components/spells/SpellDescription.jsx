import ErrorBoundary from '../ErrorBoundary'
import { PrintingBlock } from './SpellPrinting'

// A spell's full reference entry — every printing, exactly as the Spells
// tab shows it — for the collapsible block under a prepared-spell slot.
// Its own file so the slot can lazy-load it along with the spell data.
export default function SpellDescription({ group }) {
  return (
    <ErrorBoundary label={`"${group.name}"`}>
      {group.printings.map((p) => (
        <PrintingBlock key={p.source} printing={p} />
      ))}
    </ErrorBoundary>
  )
}
