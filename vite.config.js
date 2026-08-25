import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import fs from 'node:fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const spellsDir = path.join(__dirname, 'data', 'spells')

// Dev/preview-only endpoint the spell-card tool (/cards) uses to persist a
// composed card straight into its spell's data/spells/*.json entry. Only
// wired into configureServer/configurePreviewServer — i.e. only exists while
// running `vite dev` or `vite preview` locally, never in the static build
// shipped to GitHub Pages, since there's no server there to host it. The
// cards app feature-detects this and falls back to a clipboard copy when the
// request fails, which is the expected (only) outcome in production.
function cardSavePlugin() {
  function handleSave(req, res) {
    if (req.method !== 'POST') {
      res.statusCode = 405
      res.end('Method not allowed')
      return
    }
    let body = ''
    req.on('data', (chunk) => {
      body += chunk
    })
    req.on('end', () => {
      try {
        const { fileName, spellName, card } = JSON.parse(body)
        if (typeof fileName !== 'string' || !/^[a-z0-9-]+\.json$/.test(fileName)) {
          throw new Error('Invalid file name')
        }
        const filePath = path.join(spellsDir, fileName)
        if (path.dirname(filePath) !== spellsDir) throw new Error('Invalid path')
        const entries = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
        const entry = entries.find((e) => e.name === spellName)
        if (!entry) throw new Error(`Spell "${spellName}" not found in ${fileName}`)
        if (card == null) delete entry.card
        else entry.card = card
        fs.writeFileSync(filePath, JSON.stringify(entries, null, 2) + '\n')
        res.statusCode = 200
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ ok: true }))
      } catch (err) {
        res.statusCode = 400
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ ok: false, error: String(err?.message ?? err) }))
      }
    })
  }
  return {
    name: 'card-save-endpoint',
    configureServer(server) {
      server.middlewares.use('/api/cards/save', handleSave)
    },
    configurePreviewServer(server) {
      server.middlewares.use('/api/cards/save', handleSave)
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  base: '/lyra/',
  plugins: [react(), cardSavePlugin()],
  build: {
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html'),
        cards: path.resolve(__dirname, 'cards/index.html'),
      },
    },
  },
})
