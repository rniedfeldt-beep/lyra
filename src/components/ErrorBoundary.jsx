import { Component } from 'react'

// A class component is the only way React lets you catch a render error
// from *inside* your own tree — there's no hook equivalent. Used at two
// granularities around the Spell Reference tab: once per spell card, so one
// malformed entry disappears with a note instead of blanking the whole
// list, and once around the tab as a whole, as a second safety net for
// anything outside an individual card (filters, the load report, a future
// addition nobody thought to wrap).
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error(`${this.props.label ?? 'A component'} failed to render and was skipped:`, error, info)
  }

  render() {
    if (this.state.error) {
      return (
        this.props.fallback ?? (
          <p className="warning">⚠ {this.props.label ?? 'This section'} failed to render and was skipped.</p>
        )
      )
    }
    return this.props.children
  }
}
