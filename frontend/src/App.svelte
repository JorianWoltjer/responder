<script>
  import { onDestroy, onMount } from 'svelte'
  import { emmetCSS, emmetHTML } from 'emmet-monaco-es'
  import { useMonacoEx } from 'monaco-editor-ex'
  import HeaderEditor from '@/components/HeaderEditor.svelte'
  import Icon from '@/components/Icon.svelte'
  import MonacoEditor from '@/components/MonacoEditor.svelte'
  import { buildCsrfFormHtml, parseRequest } from '@/utils/csrfPoc'
  import { getContentTypeForExtension } from '@/utils/mimeTypes'
  import { buildResponsePath } from '@/utils/responseUrl'
  import { SNIPPETS } from '@/utils/snippets'
  import { registerSvgAutocomplete } from '@/utils/svgComplete'
  import { registerSvgEmmet } from '@/utils/svgEmmet'

  const languages = [
    { value: 'html', label: 'HTML' },
    { value: 'javascript', label: 'JavaScript' },
    { value: 'json', label: 'JSON' },
    { value: 'xml', label: 'XML / SVG' },
    { value: 'css', label: 'CSS' },
    { value: 'plain', label: 'Plain text' }
  ]
  const csrfExampleRequest =
    'POST /path HTTP/1.1\nHost: example.com\nContent-Type: application/x-www-form-urlencoded\n\nname=value'
  const csrfRequestPlaceholder = `${csrfExampleRequest}\n\n--- or “Copy as fetch” ---\n\nfetch(...)`
  const encoder = new TextEncoder()

  let code = '<h1>Hello, world!</h1>'
  let language = 'html'
  let filename = 'poc.html'
  let status = 200
  let delay = 0
  let headers = [['Content-Type', 'text/html; charset=utf-8']]
  let activePanel = null
  let rawHttpRequest = csrfExampleRequest
  let lastGeneratedHttpRequest = null
  let selectedByteCount = 0
  let editorDisposables = []
  let toasts = []
  let nextToastId = 1
  let copied = false
  let previewUrl = ''
  let previewTimer

  $: url = buildResponsePath({
    body: code,
    filename,
    status,
    delay,
    headers,
    origin: typeof location === 'undefined' ? 'https://example.com' : location.origin
  })
  $: absoluteUrl = `${typeof location === 'undefined' ? '' : location.origin}${url}`
  $: previewResponseUrl = buildResponsePath({
    body: code,
    filename,
    status,
    delay: 0,
    headers,
    origin: typeof location === 'undefined' ? 'https://example.com' : location.origin
  })
  const initialUrl = buildResponsePath({
    body: code,
    filename,
    status,
    delay,
    headers,
    origin: typeof location === 'undefined' ? 'https://example.com' : location.origin
  })
  $: dirty = url !== initialUrl
  $: urlTooLong = url.length > 8192
  $: totalBytes = encoder.encode(code).length
  $: byteCountLabel = selectedByteCount
    ? `${selectedByteCount.toLocaleString()} / ${totalBytes.toLocaleString()} bytes`
    : `${totalBytes.toLocaleString()} ${totalBytes === 1 ? 'byte' : 'bytes'}`
  $: csrfGenerateDirty =
    lastGeneratedHttpRequest === null || rawHttpRequest !== lastGeneratedHttpRequest
  $: if (activePanel === 'preview') schedulePreview(previewResponseUrl)

  function schedulePreview(nextUrl) {
    clearTimeout(previewTimer)
    previewTimer = setTimeout(() => {
      previewUrl = nextUrl
    }, 180)
  }

  function indentationTabsToSpaces(text, tabSize) {
    const spaces = ' '.repeat(tabSize)
    return text.replace(/^\t+/gm, (tabs) => spaces.repeat(tabs.length))
  }

  function configureHtmlFormatter(monaco) {
    const { htmlDefaults } = monaco.html
    htmlDefaults.setOptions({
      ...htmlDefaults.options,
      format: { ...htmlDefaults.options.format, tabSize: 2, insertSpaces: true }
    })

    const register = monaco.languages.registerDocumentFormattingEditProvider.bind(monaco.languages)
    monaco.languages.registerDocumentFormattingEditProvider = (languageId, provider) => {
      if (languageId === 'html' && provider?.provideDocumentFormattingEdits) {
        const provide = provider.provideDocumentFormattingEdits.bind(provider)
        provider = {
          async provideDocumentFormattingEdits(model, options, token) {
            const edits = await provide(model, options, token)
            const tabSize = options?.tabSize || 2
            return edits?.map((edit) => ({
              ...edit,
              text:
                typeof edit.text === 'string'
                  ? indentationTabsToSpaces(edit.text, tabSize)
                  : edit.text
            }))
          }
        }
      }
      return register(languageId, provider)
    }

    try {
      useMonacoEx(monaco)
    } finally {
      monaco.languages.registerDocumentFormattingEditProvider = register
    }
  }

  function updateSelectedByteCount(editor) {
    const model = editor.getModel()
    selectedByteCount = model
      ? (editor.getSelections() || []).reduce(
          (total, selection) => total + encoder.encode(model.getValueInRange(selection)).length,
          0
        )
      : 0
  }

  function disposeEditorListeners() {
    editorDisposables.forEach((disposable) => disposable.dispose())
    editorDisposables = []
  }

  function handleEditorMount(event) {
    const { editor, monaco } = event.detail
    configureHtmlFormatter(monaco)

    // Warm up the language workers before applying the initial language.
    const languageId = editor.getModel().getLanguageId()
    monaco.editor.setModelLanguage(editor.getModel(), 'javascript')
    monaco.editor.setModelLanguage(editor.getModel(), 'css')
    monaco.editor.setModelLanguage(editor.getModel(), languageId)
    emmetHTML(monaco)
    emmetCSS(monaco)
    registerSvgEmmet(monaco)
    registerSvgAutocomplete(monaco)

    disposeEditorListeners()
    updateSelectedByteCount(editor)
    editorDisposables = [
      editor.onDidChangeCursorSelection(() => updateSelectedByteCount(editor)),
      editor.onDidChangeModelContent(() => updateSelectedByteCount(editor))
    ]

    monaco.editor.addKeybindingRule({
      keybinding: monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS,
      command: 'editor.action.formatDocument',
      when: 'textInputFocus'
    })
    for (const [snippetLanguage, snippets] of Object.entries(SNIPPETS)) {
      for (const [name, snippet] of Object.entries(snippets)) {
        editorDisposables.push(
          monaco.languages.registerCompletionItemProvider(snippetLanguage, {
            provideCompletionItems: () => ({
              suggestions: [
                {
                  label: name,
                  documentation: snippet.description,
                  kind: monaco.languages.CompletionItemKind.Snippet,
                  insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                  insertText: snippet.code
                }
              ]
            })
          })
        )
      }
    }
  }

  function changeLanguage() {
    let extension = language
    if (extension === 'javascript') extension = 'js'
    if (extension === 'plain') extension = 'txt'

    filename = /\.[^./]+$/.test(filename)
      ? filename.replace(/\.[^./]+$/, `.${extension}`)
      : `${filename || 'poc'}.${extension}`

    const contentType = getContentTypeForExtension(extension)
    if (contentType) {
      headers = headers.map((row) => [...row])
      const contentTypeIndex = headers.findIndex(
        ([name]) => name.trim().toLowerCase() === 'content-type'
      )
      if (contentTypeIndex >= 0) headers[contentTypeIndex][1] = contentType
      else headers.push(['Content-Type', contentType])
    }
  }

  function updateFilename(event) {
    filename = event.currentTarget.value.replace(/^\/+/, '')
  }

  function setPanel(panel) {
    activePanel = activePanel === panel ? null : panel
    if (activePanel === 'preview') previewUrl = previewResponseUrl
  }

  function openResponse() {
    window.open(url, '_blank', 'noopener')
  }

  async function copyUrl() {
    try {
      await navigator.clipboard.writeText(absoluteUrl)
      copied = true
      setTimeout(() => (copied = false), 1600)
    } catch {
      showToast('Could not copy URL', 'Select the URL and copy it manually.', 'warning', 5000)
    }
  }

  function generateCsrfPoC() {
    try {
      code = buildCsrfFormHtml(parseRequest(rawHttpRequest))
      language = 'html'
      changeLanguage()
      lastGeneratedHttpRequest = rawHttpRequest
    } catch (error) {
      showToast('Could not parse request', error.message, 'warning', 6000)
    }
  }

  function handleCsrfKeydown(event) {
    if (
      (!event.ctrlKey && !event.metaKey) ||
      event.altKey ||
      event.shiftKey ||
      event.key !== 'Enter'
    )
      return

    event.preventDefault()
    if (!event.repeat) generateCsrfPoC()
  }

  function showToast(title, detail, type = 'info', life = 5000) {
    const id = nextToastId++
    toasts = [...toasts, { id, title, detail, type }]
    setTimeout(() => dismissToast(id), life)
  }

  function dismissToast(id) {
    toasts = toasts.filter((toast) => toast.id !== id)
  }

  function selectUrl(event) {
    event.currentTarget.select()
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
    if (!event.repeat) setPanel('preview')
  }

  function handleBeforeUnload(event) {
    if (!dirty) return
    event.preventDefault()
    event.returnValue = ''
  }

  onMount(() => {
    window.addEventListener('beforeunload', handleBeforeUnload)
  })

  onDestroy(() => {
    clearTimeout(previewTimer)
    disposeEditorListeners()
    window.removeEventListener('beforeunload', handleBeforeUnload)
  })
</script>

<svelte:window on:keydown|capture={handleKeydown} />

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
    <section class:panel-open={activePanel} class="editor-card" aria-label="Response body editor">
      <div class="editor-area">
        <MonacoEditor bind:value={code} {language} on:mount={handleEditorMount} />
        <span class="byte-count">{byteCountLabel}</span>
      </div>

      {#if activePanel === 'preview'}
        <div class="subpanel preview-panel">
          <iframe title="Response preview" src={previewUrl} sandbox="allow-scripts allow-forms"
          ></iframe>
        </div>
      {:else if activePanel === 'csrf'}
        <div class="subpanel csrf-panel">
          <textarea
            bind:value={rawHttpRequest}
            placeholder={csrfRequestPlaceholder}
            spellcheck="false"
            aria-label="Raw HTTP request"
            aria-keyshortcuts="Control+Enter Meta+Enter"
            on:keydown={handleCsrfKeydown}
          ></textarea>
        </div>
      {/if}

      <div class="card-bar editor-bar">
        <div class="editor-actions">
          <label class="language-select">
            <span class="sr-only">Language</span>
            <Icon name="code" size={17} />
            <select class="syntax-select" bind:value={language} on:change={changeLanguage}>
              <button type="button">
                <selectedcontent></selectedcontent>
              </button>
              <div class="syntax-options-header" aria-hidden="true">LANGUAGE</div>
              {#each languages as item (item.value)}
                <option class="language-option" value={item.value}>
                  <span class="language-label">{item.label}</span>
                </option>
              {/each}
            </select>
          </label>
          <button
            class="tool-button text-button"
            type="button"
            on:click={() => setPanel('csrf')}
            class:active={activePanel === 'csrf'}
            title="Generate a CSRF proof of concept"
          >
            <Icon name="wand" size={15} />
            <span>CSRF PoC</span>
          </button>
          {#if activePanel === 'csrf'}
            <button
              class="primary-button compact csrf-generate-button"
              class:quiet={!csrfGenerateDirty}
              type="button"
              on:click={generateCsrfPoC}
              title="Generate CSRF PoC (Ctrl+Enter)"
            >
              <Icon name="wand" size={15} />
              <span>Generate</span>
            </button>
          {/if}
          <button
            class="tool-button preview-button"
            class:active={activePanel === 'preview'}
            type="button"
            on:click={() => setPanel('preview')}
            title="Toggle live preview (Ctrl+P)"
            aria-label="Toggle live preview"
            aria-keyshortcuts="Control+P Meta+P"
            aria-pressed={activePanel === 'preview'}
          >
            <Icon name={activePanel === 'preview' ? 'eye' : 'eye-off'} size={17} />
          </button>
        </div>
      </div>
    </section>

    <aside class="config-card" aria-label="Response configuration">
      <div class="config-content">
        <HeaderEditor bind:headers bind:status />
      </div>

      <section class="delivery" aria-labelledby="delivery-title">
        <div class="delivery-heading">
          <h2 id="delivery-title">Response URL</h2>
        </div>
        <div class="delivery-options">
          <label class="compact-field path-field">
            <span>Path</span>
            <span class="input-prefix-wrap">
              <span class="input-prefix">/</span>
              <input
                value={filename}
                placeholder="poc.html"
                aria-label="Response path"
                on:input={updateFilename}
              />
            </span>
          </label>
          <label class="compact-field">
            <span>Delay</span>
            <span class="delay-wrap">
              <Icon name="clock" size={17} />
              <input
                bind:value={delay}
                type="number"
                min="0"
                max="300000"
                aria-label="Response delay in milliseconds"
              />
              <span>ms</span>
            </span>
          </label>
        </div>
        <div class="url-box">
          <input value={url} readonly aria-label="Generated response URL" on:focus={selectUrl} />
          <button
            class="copy-button"
            type="button"
            on:click={copyUrl}
            title="Copy full URL"
            aria-label="Copy full URL"
          >
            <Icon name={copied ? 'check' : 'copy'} size={17} />
          </button>
          <button class="open-response-button" type="button" on:click={openResponse}>
            Open response
            <Icon name="external" size={15} />
          </button>
        </div>
        {#if urlTooLong}
          <p class="url-warning">
            This URL is longer than 8,192 characters and may not work everywhere.
          </p>
        {/if}
      </section>
    </aside>
  </main>
</div>

<div class="toast-region" aria-live="polite" aria-atomic="false">
  {#each toasts as toast (toast.id)}
    <div class="toast" class:warning={toast.type === 'warning'}>
      <span class="toast-icon">
        <Icon name="info" size={16} />
      </span>
      <div>
        <strong>{toast.title}</strong>
        <p>{toast.detail}</p>
      </div>
      <button
        type="button"
        on:click={() => dismissToast(toast.id)}
        aria-label="Dismiss notification"
      >
        <Icon name="close" size={14} />
      </button>
    </div>
  {/each}
</div>

<style>
  .app-shell {
    width: 100%;
    max-width: none;
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
    width: auto;
    height: auto;
    place-items: center;
    border: 0;
    border-radius: 0;
    background: transparent;
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

  .editor-card,
  .config-card {
    overflow: hidden;
    min-width: 0;
    border: 0;
    border-radius: 0;
    background: transparent;
    box-shadow: none;
  }

  .editor-card {
    display: grid;
    grid-template-rows: minmax(0, 1fr) auto;
    height: calc(100vh - 7.5rem);
    min-height: 40rem;
    border: 1px solid var(--border-strong);
  }

  .editor-card.panel-open {
    grid-template-rows: minmax(14rem, 1fr) minmax(12rem, 0.62fr) auto;
  }

  .config-card {
    display: flex;
    flex-direction: column;
    height: calc(100vh - 7.5rem);
    min-height: 40rem;
    padding-left: 2rem;
    border-left: 1px solid var(--border);
    overflow-y: auto;
  }

  .card-bar {
    min-height: 4rem;
    border-bottom: 1px solid var(--border);
    background: transparent;
  }

  .editor-bar {
    display: flex;
    align-items: stretch;
    justify-content: flex-start;
    gap: 0;
    height: 3.25rem;
    min-height: 3.25rem;
    padding: 0;
    border-top: 1px solid var(--border);
    border-bottom: 0;
  }

  .editor-actions,
  .language-select,
  .tool-button {
    display: flex;
    align-items: center;
  }

  .editor-actions {
    align-items: stretch;
    width: 100%;
    height: 100%;
    gap: 0;
  }

  .language-select {
    position: relative;
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    gap: 0.55rem;
    min-width: 10.5rem;
    height: 100%;
    padding-left: 1rem;
    border: 0;
    border-right: 1px solid var(--border);
    border-radius: 0;
    color: var(--text-muted);
    background: transparent;
    transition:
      border-color 140ms ease,
      background 140ms ease,
      box-shadow 140ms ease;
  }

  .language-select::after {
    position: absolute;
    top: 50%;
    right: 0.9rem;
    width: 0.45rem;
    height: 0.45rem;
    border-right: 1.5px solid currentColor;
    border-bottom: 1.5px solid currentColor;
    content: '';
    pointer-events: none;
    transform: translateY(-70%) rotate(45deg);
    transition: color 140ms ease;
  }

  .language-select:hover {
    border-color: var(--border-strong);
    color: var(--text);
    background: var(--surface-raised);
  }

  .language-select:focus-within {
    border-color: var(--border-strong);
    color: var(--accent);
    background: var(--surface-raised);
    box-shadow: inset 0 -2px var(--accent);
  }

  .language-select select {
    min-width: 8rem;
    width: 100%;
    height: 100%;
    padding: 0 2.5rem 0 0;
    border: 0;
    appearance: none;
    color: var(--text);
    background: transparent;
    box-shadow: none;
    font-size: 0.84rem;
    font-weight: 560;
    letter-spacing: -0.01em;
    outline: 0;
  }

  .language-select select:focus {
    box-shadow: none;
  }

  .language-select option {
    color: var(--text);
    background: #181818;
  }

  @supports (appearance: base-select) {
    .language-select::after {
      display: none;
    }

    .language-select .syntax-select,
    .language-select .syntax-select::picker(select) {
      appearance: base-select;
    }

    .language-select .syntax-select {
      display: flex;
      align-items: center;
      gap: 0.55rem;
      padding-right: 0.85rem;
    }

    .language-select .syntax-select > button {
      display: flex;
      flex: 1;
      align-items: center;
      align-self: stretch;
      width: auto;
      min-width: 0;
      padding: 0;
      border: 0;
      color: inherit;
      background: transparent;
    }

    .language-select .syntax-select selectedcontent,
    .language-select .language-option {
      display: flex;
      align-items: center;
      gap: 0.65rem;
    }

    .language-select .syntax-select selectedcontent .language-label {
      color: var(--accent);
    }

    .language-select .syntax-select::picker-icon {
      flex: none;
      align-self: center;
      color: var(--text-subtle);
      transition:
        color 140ms ease,
        rotate 180ms ease;
    }

    .language-select .syntax-select:hover::picker-icon,
    .language-select .syntax-select:focus::picker-icon {
      color: var(--accent);
    }

    .language-select .syntax-select:open::picker-icon {
      rotate: 180deg;
    }

    .language-select .syntax-select::picker(select) {
      min-width: 13.5rem;
      max-height: min(22rem, 60vh);
      margin-block: 0.4rem;
      padding: 0.35rem;
      border: 1px solid var(--border-strong);
      border-radius: 6px;
      color: var(--text);
      background: #181818;
      box-shadow: 0 18px 48px rgba(0, 0, 0, 0.42);
      opacity: 0;
      transform: translateY(-0.25rem);
      transition:
        opacity 140ms ease,
        transform 140ms ease,
        display 140ms allow-discrete,
        overlay 140ms allow-discrete;
    }

    .language-select .syntax-select:open::picker(select) {
      opacity: 1;
      transform: translateY(0);
    }

    .language-select .syntax-options-header {
      margin: 0 0.4rem 0.25rem;
      padding: 0.35rem 0.35rem 0.5rem;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      color: var(--text-subtle);
      font-size: 0.62rem;
      font-weight: 750;
      letter-spacing: 0.12em;
      line-height: 1;
      pointer-events: none;
    }

    @starting-style {
      .language-select .syntax-select:open::picker(select) {
        opacity: 0;
        transform: translateY(-0.25rem);
      }
    }

    .language-select .language-option {
      min-height: 2.6rem;
      padding: 0.65rem 0.75rem;
      border: 0;
      border-radius: 3px;
      color: var(--text-muted);
      background: transparent;
      font-size: 0.82rem;
      font-weight: 560;
      cursor: pointer;
      transition:
        color 100ms ease,
        background 100ms ease;
    }

    .language-select .language-option:hover,
    .language-select .language-option:focus {
      color: var(--text);
      background: rgba(255, 255, 255, 0.055);
    }

    .language-select .language-option:checked {
      color: #07140c;
      background: var(--accent);
    }

    .language-select .language-option::checkmark {
      order: 1;
      margin-left: auto;
      color: #07140c;
      content: '✓';
      font-size: 0.8rem;
      font-weight: 800;
    }

  }

  .tool-button {
    justify-content: center;
    width: 3.25rem;
    height: 100%;
    border: 0;
    border-right: 1px solid var(--border);
    border-radius: 0;
    color: var(--text-muted);
    background: transparent;
  }

  .tool-button.text-button {
    gap: 0.4rem;
    width: auto;
    padding: 0 0.85rem;
    font-size: 0.82rem;
    font-weight: 600;
  }

  .preview-button {
    margin-left: auto;
    border-right: 0;
    border-left: 1px solid var(--border);
  }

  .tool-button:hover,
  .tool-button.active {
    border-color: var(--border-strong);
    color: var(--text);
    background: var(--surface-raised);
  }

  .tool-button.active {
    color: var(--accent);
    border-color: var(--accent-muted);
    background: rgba(94, 232, 139, 0.07);
    box-shadow: inset 0 -2px var(--accent);
  }

  .editor-area {
    position: relative;
    min-height: 0;
    background: #1e1e1e;
  }

  .byte-count {
    position: absolute;
    z-index: 5;
    right: 0.7rem;
    bottom: 0.5rem;
    padding: 0.18rem 0.35rem;
    border-radius: 3px;
    color: rgba(220, 226, 222, 0.45);
    background: rgba(30, 30, 30, 0.86);
    font-family: var(--font-mono);
    font-size: 0.72rem;
    font-variant-numeric: tabular-nums;
    cursor: text;
    user-select: text;
  }

  .subpanel {
    min-height: 0;
    border-top: 1px solid var(--border);
    background: var(--surface-inset);
  }

  .preview-panel {
    display: grid;
    grid-template-rows: 1fr;
  }

  iframe {
    width: 100%;
    height: 100%;
    border: 0;
  }

  .csrf-panel {
    display: grid;
    grid-template-rows: 1fr;
    padding: 0.75rem 0.75rem 0.7rem;
  }

  .csrf-panel textarea {
    width: 100%;
    min-height: 5rem;
    padding: 0.7rem;
    resize: none;
    font-family: var(--font-mono);
    font-size: 0.9rem;
    line-height: 1.5;
  }

  .config-content {
    flex: 1;
    min-height: 0;
    padding: 0 0 1.5rem;
    overflow-y: auto;
  }

  .input-prefix-wrap,
  .delay-wrap {
    display: flex;
    align-items: center;
  }

  .input-prefix-wrap {
    position: relative;
    min-width: 0;
  }

  .input-prefix {
    position: absolute;
    left: 0.7rem;
    z-index: 1;
    color: var(--text-subtle);
    font-family: var(--font-mono);
    font-size: 0.95rem;
    pointer-events: none;
  }

  .input-prefix-wrap input {
    min-width: 0;
    width: 100%;
    min-height: 2.75rem;
    padding: 0.52rem 0.65rem 0.52rem 1.25rem;
    font-family: var(--font-mono);
    font-size: 0.95rem;
  }

  .delay-wrap {
    gap: 0.5rem;
    color: var(--text-subtle);
  }

  .delay-wrap input {
    width: 7.5rem;
    min-height: 2.75rem;
    padding: 0.5rem 0.6rem;
    text-align: right;
    font-family: var(--font-mono);
    font-size: 0.95rem;
  }

  .delay-wrap span {
    font-family: var(--font-mono);
    font-size: 0.85rem;
  }

  .delivery {
    margin-top: auto;
    padding: 1.5rem 0 0;
    border-top: 1px solid var(--border);
    background: transparent;
  }

  .delivery-heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
  }

  .delivery-heading h2 {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 650;
  }

  .url-box {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 3rem auto;
    margin: 1rem 0;
    border: 1px solid var(--border-strong);
    border-radius: 0;
    background: var(--surface-inset);
    transition:
      border-color 140ms ease,
      box-shadow 140ms ease;
  }

  .url-box:hover {
    border-color: rgba(231, 255, 239, 0.25);
  }

  .url-box:focus-within {
    border-color: var(--accent-muted);
    box-shadow: 0 0 0 3px rgba(94, 232, 139, 0.07);
  }

  .url-box input {
    min-width: 0;
    min-height: 3rem;
    padding: 0.75rem 0.9rem;
    border: 0;
    border-radius: 0;
    color: #b8c4bc;
    background: transparent;
    box-shadow: none;
    font-family: var(--font-mono);
    font-size: 0.85rem;
  }

  .url-box button {
    display: grid;
    place-items: center;
    border: 0;
    border-left: 1px solid var(--border);
    color: var(--text-muted);
    background: transparent;
  }

  .url-box button:hover {
    color: var(--accent);
    background: rgba(94, 232, 139, 0.05);
  }

  .url-box .open-response-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.45rem;
    min-height: 3rem;
    padding: 0 1rem;
    border: 0;
    border-left: 1px solid rgba(0, 0, 0, 0.25);
    color: #06120a;
    background: var(--accent);
    font-size: 0.9rem;
    font-weight: 700;
    white-space: nowrap;
  }

  .url-box .open-response-button:hover {
    color: #06120a;
    background: var(--accent-hover);
  }

  .url-warning {
    margin: 0.5rem 0 0;
    color: var(--warning);
    font-size: 0.75rem;
    line-height: 1.4;
  }

  .primary-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.45rem;
    min-height: 2.75rem;
    padding: 0.65rem 1rem;
    border: 1px solid var(--accent);
    border-radius: var(--radius-sm);
    color: #06120a;
    background: var(--accent);
    font-size: 0.9rem;
    font-weight: 700;
  }

  .primary-button:hover {
    border-color: var(--accent-hover);
    background: var(--accent-hover);
  }

  .primary-button.compact {
    flex: none;
    padding: 0.42rem 0.68rem;
  }

  .primary-button.quiet {
    border-color: var(--border-strong);
    color: var(--text-muted);
    background: var(--surface-raised);
  }

  .editor-actions .csrf-generate-button {
    flex: none;
    height: 100%;
    min-height: 0;
    padding: 0 0.85rem;
    border: 0;
    border-right: 1px solid var(--border);
    border-radius: 0;
    font-size: 0.82rem;
  }

  .editor-actions .csrf-generate-button.quiet {
    border-color: var(--border);
    background: transparent;
  }

  .editor-actions .csrf-generate-button.quiet:hover {
    border-color: var(--border-strong);
    color: var(--text);
    background: var(--surface-raised);
  }

  .delivery-options {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 1rem;
    margin: 1rem 0;
  }

  .compact-field {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    align-items: center;
    gap: 0.65rem;
    color: var(--text-muted);
    font-size: 0.85rem;
    font-weight: 600;
  }

  .compact-field input {
    font-weight: 400;
  }

  .path-field {
    min-width: 0;
  }

  .delivery-options .input-prefix-wrap input {
    width: 100%;
  }

  .delivery-options .delay-wrap input {
    width: 6.5rem;
  }

  .toast-region {
    position: fixed;
    z-index: 100;
    left: 1.25rem;
    bottom: 1.25rem;
    display: grid;
    gap: 0.55rem;
    width: min(24rem, calc(100vw - 2.5rem));
    pointer-events: none;
  }

  .toast {
    display: grid;
    grid-template-columns: auto 1fr auto;
    gap: 0.7rem;
    align-items: start;
    padding: 0.8rem;
    border: 1px solid var(--border-strong);
    border-radius: 9px;
    background: rgba(23, 27, 24, 0.97);
    box-shadow: 0 12px 35px rgba(0, 0, 0, 0.4);
    animation: toast-in 180ms ease-out;
    pointer-events: auto;
    backdrop-filter: blur(12px);
  }

  .toast-icon {
    display: grid;
    width: 1.75rem;
    height: 1.75rem;
    place-items: center;
    border-radius: 5px;
    color: var(--accent);
    background: rgba(94, 232, 139, 0.08);
  }

  .toast.warning .toast-icon {
    color: var(--warning);
    background: rgba(246, 200, 108, 0.08);
  }

  .toast strong {
    display: block;
    margin-top: 0.05rem;
    font-size: 0.78rem;
  }

  .toast p {
    margin: 0.25rem 0 0;
    color: var(--text-muted);
    font-size: 0.7rem;
    line-height: 1.45;
  }

  .toast button {
    display: grid;
    padding: 0.2rem;
    border: 0;
    border-radius: var(--radius-sm);
    place-items: center;
    color: var(--text-subtle);
    background: transparent;
  }

  .toast button:hover {
    color: var(--text);
    background: var(--interactive-hover);
  }

  .sr-only {
    position: absolute;
    overflow: hidden;
    width: 1px;
    height: 1px;
    padding: 0;
    border: 0;
    margin: -1px;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
  }

  @keyframes toast-in {
    from {
      opacity: 0;
      transform: translateY(6px);
    }
  }

  @media (max-width: 980px) {
    .app-shell {
      padding: 0 1rem 1.5rem;
    }

    .workspace {
      grid-template-columns: 1fr;
      gap: 1.5rem;
    }

    .editor-card {
      width: 100%;
      height: 70vh;
      min-height: 34rem;
    }

    .config-card {
      width: 100%;
      height: auto;
      min-height: 0;
      padding: 0;
      border-left: 0;
      overflow: visible;
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

    .editor-bar {
      padding: 0;
    }

    .language-select {
      min-width: 9rem;
      margin-right: 0;
    }

    .language-select select {
      min-width: 6rem;
    }

    .tool-button.text-button {
      width: auto;
      padding: 0 0.7rem;
    }

    .tool-button.text-button span {
      display: inline;
    }

    .config-content,
    .delivery {
      padding-right: 0;
      padding-left: 0;
    }
  }

  @media (max-width: 440px) {
    .tool-button.text-button,
    .editor-actions .csrf-generate-button {
      width: 2.75rem;
      padding: 0;
    }

    .tool-button.text-button span,
    .csrf-generate-button span {
      display: none;
    }
  }
</style>
