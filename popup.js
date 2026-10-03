// Halation: popup. Settings are stored locally (chrome.storage.local) only.

const DEFAULTS = {
  enabled: true,
  intensity: 80,
  blur: 40,
  saturation: 140,
  size: 112,
  fps: 24,
  fill: false,
  softBar: false,
  shadow: 60
}

const FORMAT = {
  intensity: v => `${v}%`,
  blur: v => `${v} px`,
  saturation: v => `${v}%`,
  size: v => `${v}%`,
  shadow: v => `${v}%`,
  fps: v => `${v} fps`
}

const previewEl = document.querySelector('.preview')
const sliders = Object.keys(FORMAT).map(id => document.getElementById(id))
const toggles = ['enabled', 'fill', 'softBar'].map(id =>
  document.getElementById(id)
)

let cfg = {...DEFAULTS}

function render() {
  document.body.classList.toggle('off', !cfg.enabled)

  for (const el of toggles) el.checked = Boolean(cfg[el.id])

  for (const el of sliders) {
    const v = Number(cfg[el.id])
    el.value = v
    document.getElementById(`${el.id}Out`).textContent = FORMAT[el.id](v)
    el.style.setProperty(
      '--pct',
      `${((v - el.min) / (el.max - el.min)) * 100}%`
    )
  }

  // The preview is small, so the blur is scaled down to match.
  previewEl.style.setProperty('--op', cfg.intensity / 100)
  previewEl.style.setProperty('--blur', `${cfg.blur * 0.35}px`)
  previewEl.style.setProperty('--sat', cfg.saturation / 100)
  previewEl.style.setProperty('--size', cfg.size / 100)
}

function save() {
  render()
  chrome.storage.local.set(cfg)
}

for (const el of toggles) {
  el.addEventListener('change', () => {
    cfg[el.id] = el.checked
    save()
  })
}

for (const el of sliders) {
  el.addEventListener('input', () => {
    cfg[el.id] = Number(el.value)
    save()
  })
}

document.getElementById('reset').addEventListener('click', () => {
  cfg = {...DEFAULTS, enabled: cfg.enabled}
  save()
})

chrome.storage.local.get(DEFAULTS, stored => {
  cfg = {...DEFAULTS, ...stored}
  render()
})
