<script>
  import { onDestroy } from 'svelte'
  import { SvelteMap } from 'svelte/reactivity'
  import EditorCard from '@/components/EditorCard.svelte'
  import HeaderEditor from '@/components/HeaderEditor.svelte'
  import ResponseDelivery from '@/components/ResponseDelivery.svelte'
  import ToastRegion from '@/components/ToastRegion.svelte'
  import { getContentTypeForExtension, getContentTypeForPath } from '@/utils/mimeTypes'
  import { buildResponsePath } from '@/utils/responseUrl'

  const LANGUAGE_EXTENSIONS = {
    javascript: 'js',
    plain: 'txt'
  }
  const responseOrigin = typeof location === 'undefined' ? 'https://example.com' : location.origin
  const initialCode = '<h1>Hello, world!</h1>'
  const initialFilename = 'poc.html'
  const initialStatus = 200
  const initialDelay = 0
  const initialHeaders = [['Content-Type', 'text/html; charset=utf-8']]
  const encoder = new TextEncoder()

  let code = $state(initialCode)
  let gistUrl = $state('')
  let language = $state('html')
  let filename = $state(initialFilename)
  let status = $state(initialStatus)
  let delay = $state(initialDelay)
  let headers = $state(initialHeaders.map((row) => [...row]))
  let activePanel = $state(null)
  let previewOpen = $state(false)
  let toasts = $state([])
  let bodyLength = $derived(encoder.encode(code).length)

  let nextToastId = 1
  const toastTimers = new SvelteMap()

  let url = $derived(
    buildResponsePath({
      body: code,
      gist: activePanel === 'gist' ? gistUrl : undefined,
      filename,
      status,
      delay,
      headers,
      origin: responseOrigin
    })
  )

  let previewResponseUrl = $derived(
    previewOpen
      ? delay === 0
        ? url
        : buildResponsePath({
            body: code,
            gist: activePanel === 'gist' ? gistUrl : undefined,
            filename,
            status,
            delay: 0,
            headers,
            origin: responseOrigin
          })
      : ''
  )

  const initialUrl = buildResponsePath({
    body: initialCode,
    filename: initialFilename,
    status: initialStatus,
    delay: initialDelay,
    headers: initialHeaders,
    origin: responseOrigin
  })
  let dirty = $derived(url !== initialUrl)

  function setContentType(contentType) {
    if (!contentType) return

    const index = headers.findIndex(([name]) => name.trim().toLowerCase() === 'content-type')
    headers =
      index < 0
        ? [...headers, ['Content-Type', contentType]]
        : headers.map((row, rowIndex) => (rowIndex === index ? [row[0], contentType] : [...row]))
  }

  function setFilename(value) {
    filename = value.replace(/^\/+/, '')
    setContentType(getContentTypeForPath(filename))
  }

  function setLanguage(nextLanguage) {
    language = nextLanguage
    const extension = LANGUAGE_EXTENSIONS[nextLanguage] ?? nextLanguage
    filename = /\.[^./]+$/.test(filename)
      ? filename.replace(/\.[^./]+$/, `.${extension}`)
      : `${filename || 'poc'}.${extension}`
    setContentType(getContentTypeForExtension(extension))
  }

  function openResponse() {
    window.open(url, '_blank', 'noopener')
  }

  function showToast(title, detail, type = 'info', life = 5000) {
    const id = nextToastId++
    toasts = [...toasts, { id, title, detail, type }]
    toastTimers.set(
      id,
      setTimeout(() => dismissToast(id), life)
    )
  }

  function dismissToast(id) {
    clearTimeout(toastTimers.get(id))
    toastTimers.delete(id)
    toasts = toasts.filter((toast) => toast.id !== id)
  }

  function handleKeydown(event) {
    if (
      (event.ctrlKey || event.metaKey) &&
      !event.altKey &&
      !event.shiftKey &&
      event.key === 'Enter'
    ) {
      if (event.target?.closest?.('.csrf-panel textarea')) return

      event.preventDefault()
      event.stopPropagation()
      // Defer opening so the browser does not detect Ctrl/Meta and apply its "open in new tab" behavior.
      if (!event.repeat) setTimeout(openResponse, 0)
      return
    }

    if (
      (!event.ctrlKey && !event.metaKey) ||
      event.altKey ||
      event.shiftKey ||
      event.key.toLowerCase() !== 'p'
    )
      return

    event.preventDefault()
    if (!event.repeat) previewOpen = !previewOpen
  }

  function handleBeforeUnload(event) {
    if (!dirty) return
    event.preventDefault()
    event.returnValue = ''
  }

  onDestroy(() => {
    toastTimers.forEach((timer) => clearTimeout(timer))
    toastTimers.clear()
  })
</script>

<svelte:window onkeydowncapture={handleKeydown} onbeforeunload={handleBeforeUnload} />

<div class="app-shell">
  <header class="site-header">
    <a
      class="brand"
      href="https://github.com/JorianWoltjer/responder"
      target="_blank"
      rel="noreferrer"
      aria-label="Responder on GitHub"
    >
      <span class="brand-mark"><img src="/favicon.ico" alt="" /></span>
      <span class="brand-name">Responder</span>
    </a>
  </header>

  <main class="workspace">
    <EditorCard
      bind:code
      bind:language
      bind:activePanel
      bind:previewOpen
      bind:gistUrl
      {previewResponseUrl}
      onlanguagechange={setLanguage}
      onfilename={setFilename}
      ontoast={showToast}
    />

    <aside class="config-card" aria-label="Response configuration">
      <div class="config-content">
        <HeaderEditor bind:headers bind:status {bodyLength} />
        <div class="config-spacer" aria-hidden="true"></div>
      </div>

      <ResponseDelivery
        {filename}
        bind:delay
        {url}
        onfilename={setFilename}
        onopen={openResponse}
        onusegist={() => (activePanel = 'gist')}
        ontoast={showToast}
      />
    </aside>
  </main>
</div>

<ToastRegion {toasts} ondismiss={dismissToast} />

<style>
  .app-shell {
    width: 100%;
    min-height: 100vh;
    margin: 0 auto;
    padding: 0 2rem 2rem;
  }

  .site-header {
    display: flex;
    align-items: center;
    height: 5.5rem;
  }

  .brand {
    display: inline-flex;
    align-items: center;
    gap: 0.75rem;
    width: fit-content;
    color: inherit;
    text-decoration: none;
  }

  .brand-mark {
    display: grid;
    place-items: center;
    transition: transform 180ms ease;
  }

  .brand:hover .brand-mark {
    transform: scaleX(-1);
  }

  .brand-mark img {
    width: 2rem;
    height: 2rem;
  }

  .brand-name {
    color: var(--accent);
    font-size: 2rem;
    font-weight: 720;
    letter-spacing: -0.025em;
    transition: color 160ms ease;
  }

  .brand:hover .brand-name {
    color: var(--accent-hover);
  }

  .workspace {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(28rem, 1fr);
    gap: 2rem;
    min-height: calc(100vh - 7.5rem);
  }

  .config-card {
    display: flex;
    overflow-y: auto;
    min-width: 0;
    height: calc(100vh - 7.5rem);
    min-height: 40rem;
    flex-direction: column;
    padding-left: 2rem;
    border-left: 1px solid var(--border);
  }

  .config-content {
    display: flex;
    overflow-y: auto;
    flex: 1;
    min-height: 0;
    flex-direction: column;
  }

  .config-spacer {
    flex: 1;
    min-height: 1.5rem;
    user-select: none;
  }

  @media (max-width: 980px) {
    .app-shell {
      padding: 0 1rem 1.5rem;
    }

    .workspace {
      grid-template-columns: 1fr;
      gap: 1.5rem;
    }

    .config-card {
      overflow: visible;
      width: 100%;
      height: auto;
      min-height: 0;
      padding: 0;
      border-left: 0;
    }
  }

  @media (max-width: 620px) {
    .site-header {
      height: 4.5rem;
    }

    .brand-name {
      font-size: 1.6rem;
    }

    .brand-mark img {
      width: 1.65rem;
      height: 1.65rem;
    }

    .config-content {
      padding-right: 0;
      padding-left: 0;
    }
  }
</style>
