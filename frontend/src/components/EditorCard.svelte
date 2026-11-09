<script>
  import { onDestroy } from 'svelte'
  import { emmetCSS, emmetHTML } from 'emmet-monaco-es'
  import { useMonacoEx } from 'monaco-editor-ex'
  import { SNIPPETS } from '@/utils/snippets'
  import { registerSvgAutocomplete } from '@/utils/svgComplete'
  import { registerSvgEmmet } from '@/utils/svgEmmet'
  import CsrfPanel from './CsrfPanel.svelte'
  import EditorToolbar from './EditorToolbar.svelte'
  import GistPanel from './GistPanel.svelte'
  import MonacoEditor from './MonacoEditor.svelte'

  let {
    code = $bindable(''),
    language = $bindable('html'),
    activePanel = $bindable(null),
    previewOpen = $bindable(false),
    gistUrl = $bindable(''),
    previewResponseUrl,
    onlanguagechange,
    onfilename,
    ontoast
  } = $props()

  const encoder = new TextEncoder()

  let selectedByteCount = $state(0)
  let previewUrl = $state('')
  let previewWasOpen = false
  let editorResources = []

  let totalBytes = $derived(encoder.encode(code).length)
  let byteCountLabel = $derived(
    selectedByteCount
      ? `${selectedByteCount.toLocaleString()} / ${totalBytes.toLocaleString()} bytes`
      : `${totalBytes.toLocaleString()} ${totalBytes === 1 ? 'byte' : 'bytes'}`
  )

  $effect(() => {
    const open = previewOpen
    const nextUrl = previewResponseUrl

    if (!open) {
      previewWasOpen = false
      return
    }

    if (!previewWasOpen) {
      previewWasOpen = true
      previewUrl = nextUrl
      return
    }

    const timer = setTimeout(() => (previewUrl = nextUrl), 180)
    return () => clearTimeout(timer)
  })

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

  function disposeEditorResources() {
    editorResources.forEach((resource) => {
      if (typeof resource === 'function') resource()
      else resource.dispose()
    })
    editorResources = []
  }

  function handleEditorMount({ editor, monaco }) {
    configureHtmlFormatter(monaco)
    disposeEditorResources()

    // Warm up the language workers before applying the initial language.
    const languageId = editor.getModel().getLanguageId()
    monaco.editor.setModelLanguage(editor.getModel(), 'javascript')
    monaco.editor.setModelLanguage(editor.getModel(), 'css')
    monaco.editor.setModelLanguage(editor.getModel(), languageId)
    registerSvgEmmet(monaco)
    registerSvgAutocomplete(monaco)

    updateSelectedByteCount(editor)
    editorResources = [
      emmetHTML(monaco),
      emmetCSS(monaco),
      editor.onDidChangeCursorSelection(() => updateSelectedByteCount(editor)),
      editor.onDidChangeModelContent(() => updateSelectedByteCount(editor)),
      monaco.editor.addKeybindingRule({
        keybinding: monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS,
        command: 'editor.action.formatDocument',
        when: 'textInputFocus'
      })
    ]

    for (const [snippetLanguage, snippets] of Object.entries(SNIPPETS)) {
      for (const [name, snippet] of Object.entries(snippets)) {
        editorResources.push(
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

  function togglePanel(panel) {
    activePanel = activePanel === panel ? null : panel
  }

  function generateCsrf(codeValue) {
    code = codeValue
    language = 'html'
    onlanguagechange?.('html')
  }

  onDestroy(disposeEditorResources)
</script>

<section
  class="editor-card"
  class:panel-open={activePanel}
  class:gist-panel-open={activePanel === 'gist'}
  class:preview-open={previewOpen}
  aria-label="Response body editor"
>
  <div class="editor-area">
    <MonacoEditor
      bind:value={code}
      {language}
      readOnly={activePanel === 'gist'}
      onmount={handleEditorMount}
    />
    <span class="byte-count">{byteCountLabel}</span>
  </div>

  {#if activePanel === 'csrf'}
    <CsrfPanel ongenerate={generateCsrf} {ontoast} />
  {:else if activePanel === 'gist'}
    <GistPanel bind:gistUrl onfile={onfilename} />
  {/if}

  {#if previewOpen}
    <div class="subpanel preview-panel">
      <iframe title="Response preview" src={previewUrl} sandbox="allow-scripts allow-forms"
      ></iframe>
    </div>
  {/if}

  <EditorToolbar
    bind:language
    {activePanel}
    {previewOpen}
    {onlanguagechange}
    onpanelchange={togglePanel}
    onpreviewtoggle={() => (previewOpen = !previewOpen)}
  />
</section>

<style>
  .editor-card {
    display: grid;
    overflow: hidden;
    min-width: 0;
    height: calc(100vh - 7.5rem);
    min-height: 40rem;
    grid-template-rows: minmax(0, 1fr) auto;
    border: 1px solid var(--border-strong);
  }

  .editor-card.panel-open,
  .editor-card.preview-open {
    grid-template-rows: minmax(14rem, 1fr) minmax(12rem, 0.62fr) auto;
  }

  .editor-card.panel-open.gist-panel-open {
    grid-template-rows: minmax(14rem, 1fr) auto auto;
  }

  .editor-card.panel-open.preview-open {
    grid-template-rows:
      minmax(10rem, 1fr) minmax(9rem, 0.45fr) minmax(9rem, 0.62fr)
      auto;
  }

  .editor-card.gist-panel-open.preview-open {
    grid-template-rows: minmax(10rem, 1fr) auto minmax(10rem, 0.62fr) auto;
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

  @media (max-width: 980px) {
    .editor-card {
      width: 100%;
      height: 70vh;
      min-height: 34rem;
    }
  }
</style>
