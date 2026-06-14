let allModels = []
let rates = { USD: 1, BRL: 5.09 }
let currentQuery = ''
let currency = 'BRL'
let chart = null
let selectedComparison = []
let searchTimeout = null

function toast(message, type = 'info') {
  const icons = { info: 'mdi-information', success: 'mdi-check-circle', error: 'mdi-alert-circle', warning: 'mdi-alert' }
  const existing = document.querySelector('.toast')
  if (existing) existing.remove()
  const el = document.createElement('div')
  el.className = `toast ${type}`
  el.innerHTML = `<span class="mdi ${icons[type] || icons.info}"></span><span>${esc(message)}</span>`
  document.body.appendChild(el)
  setTimeout(() => el.remove(), 3000)
}

function debouncedSearch(fn, ms = 150) {
  clearTimeout(searchTimeout)
  searchTimeout = setTimeout(fn, ms)
}

function c(val) {
  if (val == null) return null
  return val * (rates[currency] || 1)
}

function f(val) {
  if (val == null) return '—'
  const converted = c(val)
  const sym = currency === 'BRL' ? 'R$' : currency === 'USD' ? '$' : currency === 'EUR' ? '€' : currency === 'GBP' ? '£' : currency === 'JPY' ? '¥' : currency === 'CAD' ? 'C$' : currency === 'AUD' ? 'A$' : currency === 'CNY' ? '¥' : currency === 'ARS' ? '$' : '$'
  if (converted === 0) return sym + '0'
  if (converted < 0.01) return '~' + sym + '0'
  if (converted < 1) return sym + converted.toFixed(2)
  if (converted < 100) return sym + converted.toFixed(2)
  return sym + converted.toLocaleString(undefined, { maximumFractionDigits: 2 })
}

function cc(val) {
  if (val == null) return ''
  const conv = c(val)
  if (conv === 0) return 'free'
  if (conv < 1) return 'green'
  if (conv < 5) return 'yellow'
  if (conv < 15) return 'orange'
  return 'red'
}

function ctxF(ctx) {
  if (!ctx) return '—'
  if (ctx >= 1_000_000) return (ctx / 1_000_000).toFixed(0) + 'M'
  if (ctx >= 1000) return (ctx / 1000).toFixed(0) + 'K'
  return ctx.toLocaleString()
}

function iconOf(family, id) {
  const map = [
    ['claude', 'mdi-fire'], ['gemini', 'mdi-google'], ['gpt', 'mdi-openai'], ['deepseek', 'mdi-deepseek'],
    ['qwen', 'mdi-robot'], ['minimax', 'mdi-alpha-m-circle'], ['kimi', 'mdi-alpha-k-circle'],
    ['glm', 'mdi-alpha-g-circle'], ['nemotron', 'mdi-nvidia'], ['grok', 'mdi-alpha-x-circle'],
    ['north', 'mdi-weather-night'], ['mimo', 'mdi-cellphone'], ['big-pickle', 'mdi-emoticon'],
    ['mistral', 'mdi-weather-windy'], ['liquid', 'mdi-water'], ['mercury', 'mdi-mercury'],
    ['seed', 'mdi-seed'], ['arcee', 'mdi-alpha-a-circle'], ['ring', 'mdi-ring'],
    ['ling', 'mdi-alpha-l'], ['granite', 'mdi-diamond'], ['kat', 'mdi-cat'],
    ['perceptron', 'mdi-brain'], ['laguna', 'mdi-water'], ['poolside', 'mdi-pool'],
    ['step', 'mdi-alpha-s-circle'], ['aion', 'mdi-alpha-a'], ['reka', 'mdi-alpha-r'],
    ['hy3', 'mdi-alpha-h'], ['nex', 'mdi-alpha-n-circle'],
  ]
  const s = (family || id || '').toLowerCase()
  for (const [k, ic] of map) { if (s.includes(k)) return ic }
  return 'mdi-chip'
}

function esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML }

function getProviders(m) {
  return Object.keys(m.prices || {}).filter(k => m.prices[k])
}

function hasPrice(m) {
  if (!m.prices) return false
  for (const p of Object.values(m.prices)) {
    if (p.input != null || p.output != null) return true
  }
  return false
}

function getBestPrice(m) {
  if (!m.prices) return { input: null, output: null }
  let inp = null, out = null
  for (const p of Object.values(m.prices)) {
    if (p.input != null && (inp == null || p.input < inp)) inp = p.input
    if (p.output != null && (out == null || p.output < out)) out = p.output
  }
  return { input: inp, output: out }
}

function filterModels() {
  const q = currentQuery.toLowerCase().trim()
  const minP = parseFloat(document.getElementById('minRange').value)
  const maxP = parseFloat(document.getElementById('maxRange').value)
  const maxLimit = parseFloat(document.getElementById('maxRange').max)
  let list = allModels.filter(m => (m.providers || []).length >= 2)
  if (q) list = list.filter(m => (m.name || m.id || '').toLowerCase().includes(q))
  if (minP > 0 || maxP < maxLimit) {
    list = list.filter(m => {
      const p = getBestPrice(m)
      const val = p.input != null ? c(p.input) : (p.output != null ? c(p.output) : null)
      if (val == null) return false
      if (minP > 0 && val < minP) return false
      if (maxP < maxLimit && val > maxP) return false
      return true
    })
  }
  return list
}

function skeleton() {
  document.getElementById('grid').innerHTML = Array.from({ length: 12 }, () =>
    `<div class="card skel-card skeleton"><div class="skel-row"></div><div class="skel-row w40"></div><div class="skel-row w60"></div></div>`
  ).join('')
}

function renderCard(m) {
  const icon = iconOf(m.family, m.id)
  const provs = getProviders(m)
  const price = getBestPrice(m)
  const inp = price.input, out = price.output
  const sel = selectedComparison.includes(m.id) ? 'selected' : ''

  let priceHTML = `<div class="prices">
    <div class="price-item"><div class="label">Input</div><div class="value ${cc(inp)}">${f(inp)}</div><div class="sub">/1M</div></div>
    <div class="price-item"><div class="label">Output</div><div class="value ${cc(out)}">${f(out)}</div><div class="sub">/1M</div></div>
  </div>`

  if (provs.length >= 2) {
    const extras = provs.filter(p => m.prices[p].input != null || m.prices[p].output != null)
    if (extras.length >= 2) {
      const orP = m.prices.openrouter
      if (orP) {
        const orInp = orP.input, orOut = orP.output
        priceHTML += `<div class="price-range">OR: ${f(orInp)} / ${f(orOut)} · Zen: —</div>`
      }
    }
  }

  let provTags = (m.providers || []).map(p => `<span class="prov-tag ${p}">${p}</span>`).join('')

  return `<div class="card ${sel}" data-id="${esc(m.id)}">
    <div class="top">
      <div>
        <h3><span class="mdi ${icon}"></span> ${esc(m.name || m.id)}</h3>
        ${m.family ? `<div class="family">${esc(m.family)}</div>` : ''}
      </div>
    </div>
    <div class="providers">${provTags}</div>
    ${priceHTML}
    <div class="meta">
      ${m.context ? `<span><span class="mdi mdi-counter"></span> ${ctxF(m.context)}</span>` : ''}
      ${provs.length >= 2 ? `<span class="meta-purple"><span class="mdi mdi-layers"></span> ${provs.join('+')}</span>` : ''}
    </div>
  </div>`
}

function render() {
  const list = filterModels()
  const grid = document.getElementById('grid')
  if (list.length === 0) {
    grid.innerHTML = `<div class="empty"><div class="mdi mdi-robot-off"></div><p>No models</p></div>`
  } else {
    grid.innerHTML = list.map(renderCard).join('')
    document.querySelectorAll('.card[data-id]').forEach(el => {
      el.addEventListener('click', () => {
        const id = el.dataset.id
        const idx = selectedComparison.indexOf(id)
        if (idx >= 0) selectedComparison.splice(idx, 1)
        else if (selectedComparison.length < 6) selectedComparison.push(id)
        el.classList.toggle('selected')
        updateChips()
        if (selectedComparison.length >= 2) updateComparison()
      })
    })
  }
  renderChart(list)
  renderMatches()
  document.getElementById('c-all').textContent = allModels.length
  document.getElementById('currencyLabel').textContent = `(${currency}) · merged view`
}

function chartColors() {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark'
  return {
    text: isDark ? '#8b949e' : '#5f6368',
    grid: isDark ? '#30363d' : '#e8eaed',
    pieBorder: isDark ? '#0d1117' : '#fff',
    bar1: isDark ? '#58a6ff' : '#1a73e8',
    bar2: isDark ? '#3fb950' : '#188038',
    pie: isDark
      ? ['#58a6ff', '#3fb950', '#d29922', '#f85149', '#b392f0', '#db6d28', '#79c0ff', '#56d364', '#e3b341', '#ff7b72', '#bc8cff', '#f0883e', '#7ee787', '#ffa657', '#a5d6ff']
      : ['#1a73e8', '#188038', '#ea8600', '#d93025', '#9334e6', '#e37400', '#4285f4', '#34a853', '#fbbc04', '#ea4335', '#a142f4', '#fa7b17', '#24c17b', '#f8632e', '#46bdc6']
  }
}

let chartType = 'bar'

function renderChart(models) {
  const ctx = document.getElementById('priceChart').getContext('2d')
  if (chart) { chart.destroy(); chart = null }

  const withP = models.filter(m => { const p = getBestPrice(m); return p.input != null || p.output != null })

  if (withP.length === 0) return

  if (chartType === 'pie') {
    const sorted = [...withP].sort((a, b) => (getBestPrice(b).output || 0) - (getBestPrice(a).output || 0)).slice(0, 15)
    const labels = sorted.map(m => m.name || m.id)
    const outputData = sorted.map(m => c(getBestPrice(m).output) || 0)
    const cc = chartColors()

    chart = new Chart(ctx, {
      type: 'pie',
      data: {
        labels,
        datasets: [{ data: outputData, backgroundColor: cc.pie.slice(0, sorted.length), borderColor: cc.pieBorder, borderWidth: 2 }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { position: 'right', labels: { color: cc.text, font: { size: 10 }, boxWidth: 12, padding: 8 } },
          tooltip: { callbacks: { label: ctx => ctx.label + ': ' + f(sorted[ctx.dataIndex] ? getBestPrice(sorted[ctx.dataIndex]).output : 0) } }
        }
      }
    })
    return
  }

  const sorted = [...withP].sort((a, b) => (getBestPrice(b).output || 0) - (getBestPrice(a).output || 0)).slice(0, 25)
  const labels = sorted.map(m => m.name || m.id)
  const inputData = sorted.map(m => c(getBestPrice(m).input) || 0)
  const outputData = sorted.map(m => c(getBestPrice(m).output) || 0)
  const cc = chartColors()

  chart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: 'Input', data: inputData, backgroundColor: cc.bar1 + '80', borderColor: cc.bar1, borderWidth: 1, borderRadius: 3 },
        { label: 'Output', data: outputData, backgroundColor: cc.bar2 + '80', borderColor: cc.bar2, borderWidth: 1, borderRadius: 3 },
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { labels: { color: cc.text, font: { size: 11 } } } },
      scales: {
        x: { ticks: { color: cc.text, font: { size: 9 } }, grid: { color: cc.grid } },
        y: { ticks: { color: cc.text, font: { size: 10 } }, grid: { color: cc.grid }, beginAtZero: true },
      }
    }
  })
}

function updateComparison() {
  const view = document.getElementById('compareView')
  if (selectedComparison.length < 2) { view.classList.remove('active'); view.innerHTML = ''; return }

  const models = selectedComparison.map(id => allModels.find(m => m.id === id)).filter(Boolean)
  if (models.length < 2) return

  view.classList.add('active')
  view.innerHTML = models.map(m => {
    const icon = iconOf(m.family, m.id)
    const provs = getProviders(m)
    let rows = provs.map(p => {
      const pr = m.prices?.[p]
      if (!pr) return ''
      return `<tr><td class="label">${esc(p)} Input</td><td style="color:${cc(pr.input)}">${f(pr.input)}</td></tr>
              <tr><td class="label">${esc(p)} Output</td><td style="color:${cc(pr.output)}">${f(pr.output)}</td></tr>`
    }).join('')
    return `<div class="comp-card">
      <h3><span class="mdi ${icon}"></span> ${esc(m.name || m.id)}</h3>
      <table class="comp-table">
        ${rows}
        ${m.context ? `<tr><td class="label">Context</td><td>${ctxF(m.context)}</td></tr>` : ''}
        ${m.family ? `<tr><td class="label">Family</td><td>${esc(m.family)}</td></tr>` : ''}
        <tr><td class="label">Providers</td><td>${provs.join(', ')}</td></tr>
      </table>
    </div>`
  }).join('')
}

function updateChips() {
  document.getElementById('compChips').innerHTML = selectedComparison.map(id => {
    const m = allModels.find(x => x.id === id)
    return `<span class="chip"><span class="mdi mdi-close" data-id="${esc(id)}"></span> ${esc(m ? (m.name || m.id) : id)}</span>`
  }).join('')
  document.querySelectorAll('.chip .mdi-close').forEach(el => {
    el.addEventListener('click', () => {
      const id = el.dataset.id
      const idx = selectedComparison.indexOf(id)
      if (idx >= 0) selectedComparison.splice(idx, 1)
      document.querySelectorAll(`.card[data-id="${CSS.escape(id)}"]`).forEach(c => c.classList.remove('selected'))
      updateChips()
      if (selectedComparison.length < 2) { document.getElementById('compareView').classList.remove('active'); document.getElementById('compareView').innerHTML = '' }
      else updateComparison()
    })
  })
}

function renderMatches() {
  const groups = {}
  for (const m of allModels) {
    if (!hasPrice(m)) continue
    const best = getBestPrice(m)
    const key = best.input + '|' + best.output
    if (!groups[key]) groups[key] = []
    groups[key].push(m)
  }
  const matches = Object.entries(groups).filter(([, l]) => l.length >= 2).sort((a, b) => b[1].length - a[1].length).slice(0, 12)
  const el = document.getElementById('matchList')
  if (matches.length === 0) {
    el.innerHTML = '<div class="empty-text">No price matches</div>'
    return
  }
  el.innerHTML = matches.map(([key, list]) => {
    const [inp, out] = key.split('|')
    return `<div class="match-item">
      <span class="mdi mdi-link-variant match-link-icon"></span>
      <span class="match-names">${list.map(m => `<span class="match-name-item">${esc(m.name || m.id)}</span>`).join(' <span class="mdi mdi-chevron-right match-chevron"></span> ')}</span>
      <span class="match-price">${f(Number(inp))} / ${f(Number(out))}</span>
    </div>`
  }).join('')
}

let compareData = []
let sdFocus = null

function buildSD(id, inputId, listId) {
  const input = document.getElementById(inputId)
  const list = document.getElementById(listId)
  let highlightIdx = -1

  function positionDropdown() {
    const rect = input.getBoundingClientRect()
    list.style.top = rect.bottom + 'px'
    list.style.left = rect.left + 'px'
    list.style.width = rect.width + 'px'
    list.style.maxHeight = Math.min(280, window.innerHeight - rect.bottom - 24) + 'px'
  }

  function close() {
    list.classList.remove('open')
    list.parentElement.classList.remove('sd-open')
    highlightIdx = -1
  }
  function open() {
    if (list.children.length > 0) {
      positionDropdown()
      list.classList.add('open')
      list.parentElement.classList.add('sd-open')
    }
  }

  function reposition() {
    if (list.classList.contains('open')) positionDropdown()
  }
  window.addEventListener('scroll', reposition, true)
  window.addEventListener('resize', reposition)

  function renderSuggestions(q) {
    const query = q.toLowerCase().trim()
    const items = query ? compareData.filter(m => (m.name || m.id).toLowerCase().includes(query)).slice(0, 30) : compareData.slice(0, 50)
    if (items.length === 0) {
      list.innerHTML = '<div class="sd-empty">No matches</div>'
    } else {
      list.innerHTML = items.map((m, i) => `<div class="sd-item" data-id="${esc(m.id)}" data-idx="${i}"><span class="mdi ${iconOf(m.family, m.id)}"></span> ${esc(m.name || m.id)} <span class="sd-item-price">${f(getBestPrice(m).output)}</span></div>`).join('')
    }
    highlightIdx = -1
    open()
  }

  input.addEventListener('focus', () => { sdFocus = id; renderSuggestions(input.value) })
  input.addEventListener('input', () => { renderSuggestions(input.value) })

  input.addEventListener('keydown', e => {
    const items = list.querySelectorAll('.sd-item')
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      highlightIdx = Math.min(highlightIdx + 1, items.length - 1)
      items.forEach((el, i) => el.classList.toggle('highlight', i === highlightIdx))
      if (items[highlightIdx]) items[highlightIdx].scrollIntoView({ block: 'nearest' })
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      highlightIdx = Math.max(highlightIdx - 1, -1)
      items.forEach((el, i) => el.classList.toggle('highlight', i === highlightIdx))
    } else if (e.key === 'Enter' && highlightIdx >= 0 && items[highlightIdx]) {
      items[highlightIdx].click()
    } else if (e.key === 'Escape') {
      close()
    }
  })

  list.addEventListener('mousedown', e => {
    const item = e.target.closest('.sd-item')
    if (!item) return
    e.preventDefault()
    const modelId = item.dataset.id
    const m = compareData.find(x => x.id === modelId)
    if (!m) return
    input.value = m.name || m.id
    input.dataset.value = modelId
    close()
    checkCompareReady()
  })

  document.addEventListener('click', e => {
    if (!e.target.closest('.search-dropdown')) close()
  })
}

function checkCompareReady() {
  const a = document.getElementById('sdA').dataset.value
  const b = document.getElementById('sdB').dataset.value
  document.getElementById('compBtn').style.opacity = (a && b) ? '1' : '.4'
}

function populateCompare() {
  compareData = allModels.filter(hasPrice).sort((a, b) => (a.name || a.id).localeCompare(b.name || b.id))
  buildSD('A', 'sdA', 'sdListA')
  buildSD('B', 'sdB', 'sdListB')
}

document.getElementById('chartSkel').style.display = 'block'

Promise.all([
  fetch('/api/prices').then(r => r.json()),
  fetch('/api/rates').then(r => r.json()),
]).then(([priceData, rateData]) => {
  allModels = priceData.models || []
  rates = rateData
  document.getElementById('updated').textContent = new Date(priceData.updated_at).toLocaleString()
  const s = syms[currency] || '$'
  document.getElementById('coinInd').textContent = s
  document.getElementById('coinInd2').textContent = s
  document.getElementById('rateInfo').textContent = `USD 1 = ${currency === 'USD' ? '1' : rates[currency] ? rates[currency].toFixed(2) : '?'} ${currency}`
  document.getElementById('chartSkel').style.display = 'none'
  populateCompare()
  const prices = allModels.map(m => { const p = getBestPrice(m); return p.input != null ? p.input : p.output }).filter(v => v != null)
  const maxPrice = prices.length ? Math.ceil(Math.max(...prices)) : 100
  document.getElementById('minRange').max = maxPrice
  document.getElementById('maxRange').max = maxPrice
  document.getElementById('maxRange').value = maxPrice
  updateRangeLabels()
  render()
  toast(`Loaded ${allModels.length} models`, 'success')
  updateHeaderPadding()
})

document.getElementById('search').addEventListener('input', () => {
  debouncedSearch(() => {
    currentQuery = document.getElementById('search').value
    render()
  }, 100)
})

document.getElementById('search').addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    e.target.value = ''
    currentQuery = ''
    render()
    e.target.blur()
  }
})

document.getElementById('search').addEventListener('focus', () => {
  document.querySelector('.search-wrap .mdi-magnify').style.color = 'var(--accent)'
})
document.getElementById('search').addEventListener('blur', () => {
  document.querySelector('.search-wrap .mdi-magnify').style.color = ''
})

function updateRangeLabels() {
  const min = parseFloat(document.getElementById('minRange').value)
  const max = parseFloat(document.getElementById('maxRange').value)
  const pct = (parseFloat(document.getElementById('maxRange').max))
  document.getElementById('rangeLabelMin').value = min.toFixed(2)
  document.getElementById('rangeLabelMax').value = max >= pct ? '' : max.toFixed(2)
  const fill = document.getElementById('rangeFill')
  const minPct = (min / pct) * 100
  const maxPct = (max / pct) * 100
  fill.style.left = minPct + '%'
  fill.style.width = (maxPct - minPct) + '%'
}

document.getElementById('minRange').addEventListener('input', function () {
  if (parseFloat(this.value) >= parseFloat(document.getElementById('maxRange').value)) {
    this.value = (parseFloat(document.getElementById('maxRange').value) - 0.01).toFixed(2)
  }
  updateRangeLabels()
  render()
})
document.getElementById('maxRange').addEventListener('input', function () {
  if (parseFloat(this.value) <= parseFloat(document.getElementById('minRange').value)) {
    this.value = (parseFloat(document.getElementById('minRange').value) + 0.01).toFixed(2)
  }
  updateRangeLabels()
  render()
})

document.getElementById('rangeLabelMin').addEventListener('change', function () {
  const max = parseFloat(document.getElementById('maxRange').value)
  const pct = parseFloat(document.getElementById('maxRange').max)
  let val = parseFloat(this.value)
  if (isNaN(val)) val = 0
  val = Math.max(0, Math.min(val, max - 0.01, pct))
  document.getElementById('minRange').value = val
  updateRangeLabels()
  render()
})
document.getElementById('rangeLabelMax').addEventListener('change', function () {
  const min = parseFloat(document.getElementById('minRange').value)
  const pct = parseFloat(document.getElementById('maxRange').max)
  let val = parseFloat(this.value)
  if (isNaN(val)) val = pct
  val = Math.max(min + 0.01, Math.min(val, pct))
  document.getElementById('maxRange').value = val
  updateRangeLabels()
  render()
})
document.getElementById('rangeLabelMin').addEventListener('focus', function () { this.select() })
document.getElementById('rangeLabelMax').addEventListener('focus', function () { this.select() })

const syms = { BRL: 'R$', USD: '$', EUR: '€', GBP: '£', JPY: '¥', CAD: 'C$', AUD: 'A$', CNY: '¥', ARS: '$' }

document.getElementById('currency').addEventListener('change', function () {
  currency = this.value
  const s = syms[currency] || '$'
  document.getElementById('coinInd').textContent = s
  document.getElementById('coinInd2').textContent = s
  document.getElementById('rateInfo').textContent = `USD 1 = ${currency === 'USD' ? '1' : rates[currency] ? rates[currency].toFixed(2) : '?'} ${currency}`
  const prices = allModels.map(m => { const p = getBestPrice(m); return p.input != null ? c(p.input) : (p.output != null ? c(p.output) : null) }).filter(v => v != null)
  const maxP = prices.length ? Math.ceil(Math.max(...prices)) : 100
  document.getElementById('minRange').max = maxP
  document.getElementById('maxRange').max = maxP
  document.getElementById('maxRange').value = maxP
  document.getElementById('minRange').value = 0
  updateRangeLabels()
  render()
})

let currentView = 'chart'
document.querySelectorAll('#mainTabs .tab').forEach(t => {
  t.addEventListener('click', () => {
    switchView(t.dataset.view)
  })
})

function switchView(view) {
  document.querySelectorAll('#mainTabs .tab').forEach(x => x.classList.remove('active'))
  document.querySelector(`#mainTabs .tab[data-view="${view}"]`).classList.add('active')
  document.querySelectorAll('.view').forEach(v => {
    v.style.animation = 'none'
    v.classList.add('hidden')
    v.offsetHeight
  })
  const target = document.getElementById('view-' + view)
  target.classList.remove('hidden')
  target.style.animation = 'slideUp 0.3s cubic-bezier(0.4, 0, 0.2, 1) ease-out'
  currentView = view
  if (view === 'chart') render()
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

function regenerateChart() {
  if (currentView === 'chart') {
    render()
    toast('Chart regenerated', 'success')
  }
}

document.addEventListener('keydown', e => {
  if (e.ctrlKey || e.metaKey || e.altKey) return
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return
  const views = ['chart', 'compare', 'matches', 'list']
  const idx = views.indexOf(currentView)
  if (e.key === '1') switchView('chart')
  else if (e.key === '2') switchView('compare')
  else if (e.key === '3') switchView('matches')
  else if (e.key === '4') switchView('list')
  else if (e.key === 'ArrowRight' && idx < views.length - 1) switchView(views[idx + 1])
  else if (e.key === 'ArrowLeft' && idx > 0) switchView(views[idx - 1])
  else if (e.key === 'r' || e.key === 'R') regenerateChart()
  else if (e.key === 'Escape') {
    document.getElementById('search').value = ''
    currentQuery = ''
    render()
    toast('Search cleared', 'info')
  }
})

document.querySelectorAll('.chart-type-btn').forEach(b => {
  b.addEventListener('click', () => {
    document.querySelectorAll('.chart-type-btn').forEach(x => x.classList.remove('active'))
    b.classList.add('active')
    chartType = b.dataset.chart
    render()
  })
})

document.getElementById('compBtn').style.opacity = '.4'

document.getElementById('compBtn').addEventListener('click', () => {
  const a = document.getElementById('sdA').dataset.value
  const b = document.getElementById('sdB').dataset.value
  if (!a || !b) return
  selectedComparison = [a, b]
  document.querySelectorAll('.card.selected').forEach(c => c.classList.remove('selected'))
  document.querySelectorAll(`.card[data-id="${CSS.escape(a)}"], .card[data-id="${CSS.escape(b)}"]`).forEach(c => c.classList.add('selected'))
  updateChips()
  updateComparison()
  const aName = allModels.find(m => m.id === a)?.name || a
  const bName = allModels.find(m => m.id === b)?.name || b
  toast(`Comparing ${esc(aName)} vs ${esc(bName)}`, 'info')
})

const themeBtn = document.getElementById('themeToggle')
const themeIcon = themeBtn.querySelector('.mdi')
const saved = localStorage.getItem('theme')
if (saved === 'dark') {
  document.documentElement.setAttribute('data-theme', 'dark')
  themeIcon.className = 'mdi mdi-white-balance-sunny'
}
themeBtn.addEventListener('click', () => {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark'
  if (isDark) {
    document.documentElement.removeAttribute('data-theme')
    themeIcon.className = 'mdi mdi-weather-night'
    localStorage.setItem('theme', 'light')
    toast('Light mode', 'info')
  } else {
    document.documentElement.setAttribute('data-theme', 'dark')
    themeIcon.className = 'mdi mdi-white-balance-sunny'
    localStorage.setItem('theme', 'dark')
    toast('Dark mode', 'info')
  }
  if (chart) render()
})

function updateHeaderPadding() {
  const header = document.querySelector('header')
  if (header) document.body.style.paddingTop = header.offsetHeight + 'px'
}

window.addEventListener('resize', updateHeaderPadding)
window.addEventListener('load', updateHeaderPadding)

document.getElementById('filterToggle').addEventListener('click', () => {
  const panel = document.getElementById('filterPanel')
  const btn = document.getElementById('filterToggle')
  panel.classList.toggle('open')
  btn.classList.toggle('active')
  setTimeout(updateHeaderPadding, 350)
})
