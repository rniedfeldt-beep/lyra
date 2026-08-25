import { useEffect, useMemo, useRef, useState } from 'react'
import { fitWithin, fontsReady, paginate, sheetsHTMLFromPages } from './cardRender'

// The actual printable output — six upright cards per sheet, fold pairs kept
// together — built from the whole queue exactly like the reference's
// pagination loop. Always rendered (not just while printing) so it doubles
// as a WYSIWYG preview of what "Print" will produce. Not wrapped in
// .no-print: this is the one thing that should still be visible when
// window.print() fires.
export default function PrintSheets({ queue }) {
  const ref = useRef(null)
  const pages = useMemo(() => paginate(queue), [queue])
  const html = useMemo(() => sheetsHTMLFromPages(pages), [pages])
  const [overflowCount, setOverflowCount] = useState(0)

  useEffect(() => {
    let cancelled = false
    fontsReady().then(() => {
      if (cancelled || !ref.current) return
      setOverflowCount(fitWithin(ref.current).size)
    })
    return () => {
      cancelled = true
    }
  }, [html])

  // Re-fit right before printing, in case anything shifted (e.g. a font
  // finished loading, or the window was resized).
  useEffect(() => {
    function refit() {
      if (ref.current) setOverflowCount(fitWithin(ref.current).size)
    }
    window.addEventListener('beforeprint', refit)
    return () => window.removeEventListener('beforeprint', refit)
  }, [])

  return (
    <div className="print-sheets-wrap">
      <p className="no-print sheets-count">
        {queue.length} card{queue.length === 1 ? '' : 's'} · {pages.length} sheet{pages.length === 1 ? '' : 's'} · 6
        per page
        {overflowCount > 0 ? ` · ${overflowCount} overflowing` : ''}
      </p>
      {/* eslint-disable-next-line react/no-danger */}
      <div ref={ref} dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  )
}
