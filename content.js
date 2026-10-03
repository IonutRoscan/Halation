// Halation: content script.
// Samples the playing video into a tiny canvas, then stretches and blurs
// that canvas behind the player (or behind the whole page in "fill" mode).
// No network access, no data leaves the page.

;(() => {
  'use strict'

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
  const COLS = 64 // sample width in pixels; height follows the video's aspect ratio
  const canvasFilter = 'filter' in CanvasRenderingContext2D.prototype

  let cfg = {...DEFAULTS}
  let video = null
  let canvas = null
  let ctx = null
  let rows = 36
  let pending = false
  let lastDraw = 0
  let inView = true
  let resizeObs = null
  let viewObs = null
  const touched = new Map() // mount element -> its original inline styles

  const VIDEO_EVENTS = ['play', 'pause', 'seeked', 'loadeddata']

  const isWatchPage = () => location.pathname === '/watch'
  const mountFor = v => v.closest('ytd-player')?.parentElement ?? null
  const active = () =>
    Boolean(
      cfg.enabled &&
      video &&
      canvas &&
      (inView || cfg.fill) &&
      document.visibilityState === 'visible'
    )

  // content.css only does anything when these classes are present on <html>.
  function syncClasses() {
    const root = document.documentElement
    const fillOn = Boolean(cfg.enabled && cfg.fill && canvas)
    root.classList.toggle('halation-soft', Boolean(cfg.enabled && cfg.softBar))
    root.classList.toggle('halation-fill', fillOn)
    root.classList.toggle('halation-on', Boolean(cfg.enabled && canvas))
    root.classList.toggle('halation-shadow', Boolean(cfg.enabled && cfg.shadow > 0))
    root.style.setProperty('--halation-shadow', String(cfg.shadow / 100))
  }

  // Contained mode: the glow lives in the player's parent, in its own
  // stacking context, so it sits behind the player and spills past its edges.
  function prepMount(m) {
    if (!touched.has(m)) {
      touched.set(m, {
        position: m.style.position,
        isolation: m.style.isolation,
        overflow: m.style.overflow
      })
    }
    if (getComputedStyle(m).position === 'static') m.style.position = 'relative'
    m.style.isolation = 'isolate'
    m.style.overflow = 'visible'
  }

  function restoreMounts() {
    for (const [m, o] of touched) {
      m.style.position = o.position
      m.style.isolation = o.isolation
      m.style.overflow = o.overflow
    }
    touched.clear()
  }

  // Fill mode scales up a little so the blurred edges never show the page color.
  const fillScale = () => Math.max(cfg.size / 100, 1.1)
  // In fill mode the blur happens inside the 64-pixel canvas, which is nearly
  // free. A CSS blur on a viewport-sized layer is heavy and rendered unreliably.
  const blurInCanvas = () => cfg.fill && canvasFilter

  function applyStyle() {
    if (!canvas) return
    canvas.style.opacity = String(cfg.intensity / 100)
    canvas.style.filter = blurInCanvas()
      ? 'none'
      : `blur(${cfg.blur}px) saturate(${cfg.saturation / 100})`
    canvas.style.transform = `scale(${cfg.fill ? fillScale() : cfg.size / 100})`
  }

  // Contained mode keeps the canvas exactly over the video and re-parents it
  // if YouTube moves the player (default <-> theater). Fill mode pins it to
  // the viewport, behind everything.
  function layout() {
    if (!video || !canvas) return
    const parent = cfg.fill ? document.documentElement : mountFor(video)
    if (!parent) return

    if (canvas.parentElement !== parent) {
      restoreMounts()
      if (!cfg.fill) prepMount(parent)
      if (cfg.fill) parent.insertBefore(canvas, parent.firstChild)
      else parent.appendChild(canvas)
    }

    if (cfg.fill) {
      Object.assign(canvas.style, {
        position: 'fixed',
        top: '0px',
        left: '0px',
        width: '100%',
        height: '100%',
        transformOrigin: 'center center'
      })
    } else {
      const vr = video.getBoundingClientRect()
      const mr = parent.getBoundingClientRect()
      Object.assign(canvas.style, {
        position: 'absolute',
        left: `${vr.left - mr.left}px`,
        top: `${vr.top - mr.top}px`,
        width: `${vr.width}px`,
        height: `${vr.height}px`
      })
    }

    if (video.videoWidth) {
      const r = Math.max(
        8,
        Math.round((COLS * video.videoHeight) / video.videoWidth)
      )
      if (r !== rows) {
        rows = r
        canvas.height = rows
      }
    }
  }

  function drawNow() {
    if (!active() || video.readyState < 2) return
    try {
      if (blurInCanvas()) {
        // Convert the CSS-pixel blur setting into sample-canvas pixels.
        const px = Math.max(1.5, (cfg.blur * COLS) / (innerWidth * fillScale()))
        const pad = Math.ceil(px * 2) // overdraw so the blur doesn't darken the edges
        ctx.imageSmoothingQuality = 'high'
        ctx.filter = `blur(${px}px) saturate(${cfg.saturation / 100})`
        ctx.drawImage(video, -pad, -pad, COLS + pad * 2, rows + pad * 2)
      } else {
        if (canvasFilter) ctx.filter = 'none'
        ctx.drawImage(video, 0, 0, COLS, rows)
      }
    } catch (_) {
      // Protected (DRM) frames can't be sampled; the glow just stays dark.
    }
  }

  function frame(now) {
    pending = false
    if (!active()) return
    if (now - lastDraw >= 1000 / cfg.fps - 2) {
      lastDraw = now
      drawNow()
    }
    schedule()
  }

  // Runs once per presented video frame and skips the draw if the fps cap
  // says it's too soon. Stops while paused, hidden, or (contained) offscreen.
  function schedule() {
    if (pending || !active() || video.paused || video.ended) return
    pending = true
    if ('requestVideoFrameCallback' in video)
      video.requestVideoFrameCallback(frame)
    else requestAnimationFrame(frame)
  }

  function kick() {
    drawNow()
    schedule()
  }

  function onVideoEvent() {
    layout()
    kick()
  }

  function attach(v) {
    detach()
    video = v
    canvas = document.createElement('canvas')
    canvas.id = 'halation-glow'
    canvas.width = COLS
    canvas.height = rows
    canvas.setAttribute('aria-hidden', 'true')
    Object.assign(canvas.style, {
      position: 'absolute',
      zIndex: '-1',
      pointerEvents: 'none'
    })
    ctx = canvas.getContext('2d', {alpha: false})
    applyStyle()
    layout()
    syncClasses()

    for (const e of VIDEO_EVENTS) video.addEventListener(e, onVideoEvent)
    document.addEventListener('visibilitychange', kick)
    resizeObs = new ResizeObserver(onVideoEvent)
    resizeObs.observe(video)
    viewObs = new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting
      kick()
    })
    viewObs.observe(video)
    kick()
  }

  function detach() {
    if (video)
      for (const e of VIDEO_EVENTS) video.removeEventListener(e, onVideoEvent)
    document.removeEventListener('visibilitychange', kick)
    resizeObs?.disconnect()
    viewObs?.disconnect()
    resizeObs = null
    viewObs = null
    canvas?.remove()
    restoreMounts()
    video = null
    canvas = null
    ctx = null
    pending = false
    inView = true
    syncClasses()
  }

  // YouTube builds the player after load, so retry for up to ~20 seconds.
  function tryAttach(attempt = 0) {
    if (!cfg.enabled || !isWatchPage()) return
    const v = document.querySelector('#movie_player video')
    if (v && mountFor(v)) {
      attach(v)
      return
    }
    if (attempt < 40) setTimeout(() => tryAttach(attempt + 1), 500)
  }

  // YouTube is a single-page app, so listen for its own navigation event.
  window.addEventListener('yt-navigate-finish', () => {
    detach()
    tryAttach()
  })

  chrome.storage.local.get(DEFAULTS, stored => {
    cfg = {...DEFAULTS, ...stored}
    syncClasses()
    tryAttach()
  })

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return
    for (const [key, {newValue}] of Object.entries(changes)) {
      if (newValue !== undefined) cfg[key] = newValue
    }
    if (!cfg.enabled) detach()
    else if (!video) tryAttach()
    else {
      applyStyle()
      layout()
      kick()
    }
    syncClasses()
  })
})()
