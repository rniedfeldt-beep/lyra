import CharacterSheet from './components/CharacterSheet'
import { LiveStateProvider } from './lib/liveState/LiveStateContext'
import { character, resolvedItems, spellSlotsBaseTable, companion } from './lib/lyraSheet'

function App() {
  return (
    <LiveStateProvider
      character={character}
      items={resolvedItems}
      spellSlotsBaseTable={spellSlotsBaseTable}
      companion={companion}
    >
      <CharacterSheet />
    </LiveStateProvider>
  )
}

export default App
