import './partySection.css'

// A visually distinct, color-coded block with a sticky header, so whoever's
// stats you're looking at (Lyra, Quen, a summon) stays legible while you
// scroll the rest of the single long page.
export default function PartySection({ color, title, subtitle, children }) {
  return (
    <div className={`party-section party-section-${color}`}>
      <div className="party-section-header">
        <span className="party-section-title">{title}</span>
        {subtitle && <span className="party-section-subtitle">{subtitle}</span>}
      </div>
      <div className="party-section-body">{children}</div>
    </div>
  )
}
