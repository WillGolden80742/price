import { createServer } from 'http'
import { join, extname } from 'path'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const PORT = 3333

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
}

function serveFile(res, path, type) {
  try {
    const data = readFileSync(path)
    res.writeHead(200, { 'Content-Type': type })
    res.end(data)
  } catch {
    res.writeHead(404)
    res.end('Not found')
  }
}

let cache = { models: [], updated_at: null }
let rates = { USD: 1, BRL: 5.09, EUR: 0.92, GBP: 0.78, updated_at: null }

async function fetchJson(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'price-app/1.0' },
    signal: AbortSignal.timeout(15000),
  })
  if (!res.ok) throw new Error(`${url} -> ${res.status}`)
  return res.json()
}

function normalizeId(id) {
  const strip = id.includes('/') ? id.slice(id.indexOf('/') + 1) : id
  return strip.replace(/\./g, '-').toLowerCase()
}

async function refreshRates() {
  try {
    const data = await fetchJson('https://api.exchangerate-api.com/v4/latest/USD')
    rates = { USD: 1, ...data.rates, updated_at: new Date().toISOString() }
    console.log('Rates updated')
  } catch (err) {
    console.error('Rates failed:', err.message)
  }
}

async function refreshCache() {
  try {
    const [zenRaw, orRaw] = await Promise.all([
      fetchJson('https://opencode.ai/zen/v1/models').catch(() => ({ data: [] })),
      fetchJson('https://openrouter.ai/api/v1/models'),
    ])

    const zenMap = {}
    for (const m of (zenRaw.data || [])) {
      zenMap[normalizeId(m.id)] = { originalId: m.id }
    }

    const orMap = {}
    for (const m of (orRaw.data || [])) {
      const norm = normalizeId(m.id)
      const pricing = m.pricing || {}
      const arch = m.architecture
      const family = typeof arch === 'object' && arch ? (arch.tokenizer || arch.modality?.split('-')[0] || null) : (typeof arch === 'string' ? arch : null)
      orMap[norm] = {
        originalId: m.id,
        name: m.name || m.id,
        input: pricing.prompt ? Number(pricing.prompt) * 1_000_000 : null,
        output: pricing.completion ? Number(pricing.completion) * 1_000_000 : null,
        context: m.context_length ?? null,
        family,
      }
    }

    const allIds = new Set([...Object.keys(zenMap), ...Object.keys(orMap)])
    const models = []

    for (const normId of allIds) {
      const zen = zenMap[normId]
      const or = orMap[normId]

      const prices = {}
      if (or) {
        prices.openrouter = { input: or.input, output: or.output }
        if (or.input !== null || or.output !== null) prices.openrouter = { input: or.input, output: or.output }
      }
      if (zen) prices.zen = { input: null, output: null }

      const providers = []
      if (zen) providers.push('zen')
      if (or) providers.push('openrouter')

      models.push({
        id: or?.originalId || zen?.originalId || normId,
        name: or?.name || normId,
        prices: Object.keys(prices).length > 0 ? prices : null,
        context: or?.context ?? null,
        family: or?.family ?? null,
        providers,
      })
    }

    cache = { models, updated_at: new Date().toISOString() }
    console.log(`OK — ${models.length} models (${Object.keys(zenMap).length} zen, ${Object.keys(orMap).length} or)`)
  } catch (err) {
    console.error('Refresh failed:', err.message)
  }
}

await Promise.all([refreshCache(), refreshRates()])
setInterval(refreshCache, 5 * 60_000)
setInterval(refreshRates, 30 * 60_000)

createServer((req, res) => {
  const headers = { 'Access-Control-Allow-Origin': '*' }

  if (req.url === '/api/prices') {
    res.writeHead(200, { ...headers, 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ updated_at: cache.updated_at, models: cache.models }))
    return
  }

  if (req.url === '/api/rates') {
    res.writeHead(200, { ...headers, 'Content-Type': 'application/json' })
    res.end(JSON.stringify(rates))
    return
  }

  if (req.url === '/favicon.ico') { res.writeHead(204); res.end(); return }

  let filePath = join(__dirname, 'public', req.url === '/' ? 'index.html' : req.url)
  serveFile(res, filePath, MIME[extname(filePath)] || 'application/octet-stream')
}).listen(PORT, () => {
  console.log(`http://localhost:${PORT}`)
})
