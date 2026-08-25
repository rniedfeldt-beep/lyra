import { useEffect } from 'react'
import { fitWithin, fontsReady } from './cardRender'

// Runs the auto-fitter against containerRef.current whenever `deps` changes,
// always waiting on document.fonts.ready first — measuring against fallback
// metrics before Fira Sans loads sizes cards for the wrong typeface, and text
// overflows once the real font swaps in. fontsReady() resolves once and stays
// resolved, so every re-run after the first is effectively synchronous.
export function useFitCards(containerRef, deps) {
  useEffect(() => {
    let cancelled = false
    fontsReady().then(() => {
      if (!cancelled && containerRef.current) fitWithin(containerRef.current)
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
}
