import CharacterSheet from './components/CharacterSheet'
import { LiveStateProvider } from './lib/liveState/LiveStateContext'
import { lyraSheet, dailyAbilities, companion } from './lib/lyraSheet'

function App() {
  return (
    <LiveStateProvider sheet={lyraSheet} dailyAbilities={dailyAbilities} companion={companion}>
      <CharacterSheet />
    </LiveStateProvider>
  )
}

export default App
