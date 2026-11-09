<script>
  import { createEventDispatcher, onMount } from 'svelte'
  import * as monaco from 'monaco-editor'
  import editorWorker from 'monaco-editor/editor/editor.worker?worker&inline'
  import cssWorker from 'monaco-editor/language/css/css.worker?worker&inline'
  import htmlWorker from 'monaco-editor/language/html/html.worker?worker&inline'
  import jsonWorker from 'monaco-editor/language/json/json.worker?worker&inline'
  import typescriptWorker from 'monaco-editor/language/typescript/ts.worker?worker&inline'

  export let value = ''
  export let language = 'html'

  const dispatch = createEventDispatcher()
  self.MonacoEnvironment = {
    getWorker(_moduleId, label) {
      if (label === 'json') return new jsonWorker()
      if (label === 'css' || label === 'scss' || label === 'less') return new cssWorker()
      if (label === 'html' || label === 'handlebars' || label === 'razor') return new htmlWorker()
      if (label === 'typescript' || label === 'javascript') return new typescriptWorker()
      return new editorWorker()
    }
  }

  let container
  let editor
  let loading = true
  let loadError = ''
  let changingInternally = false

  onMount(() => {
    let disposed = false
    let contentListener

    try {
      editor = monaco.editor.create(container, {
        value,
        language,
        theme: 'vs-dark',
        automaticLayout: true,
        autoIndent: 'full',
        formatOnPaste: false,
        tabSize: 2,
        insertSpaces: true,
        detectIndentation: false,
        wordWrap: 'on',
        minimap: { enabled: false },
        padding: { top: 14, bottom: 14 },
        fontSize: 14,
        lineHeight: 22,
        fontFamily: "'Fira Code', 'SFMono-Regular', Consolas, 'Liberation Mono', monospace",
        smoothScrolling: true,
        scrollBeyondLastLine: false,
        renderLineHighlight: 'gutter',
        overviewRulerBorder: false,
        bracketPairColorization: { enabled: true }
      })

      contentListener = editor.onDidChangeModelContent(() => {
        changingInternally = true
        value = editor.getValue()
        dispatch('change', value)
        changingInternally = false
      })
      document.fonts?.load('14px "Fira Code"').then(() => {
        if (!disposed) monaco.editor.remeasureFonts()
      })
      loading = false
      dispatch('mount', { editor, monaco })
    } catch (error) {
      loading = false
      loadError = error.message
    }

    return () => {
      disposed = true
      contentListener?.dispose()
      editor?.getModel()?.dispose()
      editor?.dispose()
    }
  })

  $: if (editor && !changingInternally && editor.getValue() !== value) {
    editor.setValue(value)
  }

  $: if (editor && editor.getModel()?.getLanguageId() !== language) {
    monaco.editor.setModelLanguage(editor.getModel(), language)
  }
</script>

<div class="editor-shell">
  <div class="editor" bind:this={container}></div>
  {#if loading}
    <div class="editor-state">
      <span class="spinner"></span>
      Loading editor…
    </div>
  {:else if loadError}
    <div class="editor-state error">{loadError}. Check your connection and reload.</div>
  {/if}
</div>

<style>
  .editor-shell,
  .editor {
    position: absolute;
    inset: 0;
  }

  .editor-state {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.65rem;
    color: var(--text-muted);
    background: #1e1e1e;
    font-size: 0.85rem;
  }

  .editor-state.error {
    color: var(--danger);
  }

  .spinner {
    width: 0.9rem;
    height: 0.9rem;
    border: 2px solid #3d443f;
    border-top-color: var(--accent);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>
