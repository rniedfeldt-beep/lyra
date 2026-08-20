import CharacterSheet from './components/CharacterSheet'
import { LiveStateProvider } from './lib/liveState/LiveStateContext'
import { character, resolvedItems, progressionTable, spellSlotsBaseTable, companion } from './lib/lyraSheet'

function App() {
  return (
    <LiveStateProvider
      character={character}
      items={resolvedItems}
      progressionTable={progressionTable}
      spellSlotsBaseTable={spellSlotsBaseTable}
      companion={companion}
    >
      <CharacterSheet />
    </LiveStateProvider>
  )
}

export default App
