<script setup>
import { computed, ref, shallowRef } from 'vue'
import { SelectLanguage, HeaderTable, StatusField } from '@/components'
import { CORS_HEADERS, HEADER_ALIAS, SNIPPETS, TIPS, hasCORS } from '@/utils'

import { useToast } from 'primevue/usetoast'
import { emmetHTML, emmetCSS } from 'emmet-monaco-es'
import { useMonacoEx } from 'monaco-editor-ex'
import mime from 'mime'

const previewChecked = ref(false)
const base64Checked = ref(false)
const code = ref(`<h1>Hello, world!</h1>`)
const language = ref('html')
const filename = ref('poc.html')
const status = ref(200)
const delay = ref(0)
const headers = ref(
  new Map([
    ['Content-Type', 'text/html'],
    ['', '']
  ])
)
const url = computed(() => getFinalURL())
const toast = useToast()
const currentTip = ref(0)

const MONACO_EDITOR_OPTIONS = {
  automaticLayout: true,
  autoIndent: true,
  formatOnPaste: false,
  tabSize: 2,
  insertSpaces: true,
  wordWrap: 'on'
}

const editorRef = shallowRef()
const handleMount = (editor, monaco) => {
  useMonacoEx(monaco)
  // For some reason need to load the languages once
  const languageId = editor.getModel().getLanguageId()
  editor.getModel().setLanguage('javascript')
  editor.getModel().setLanguage('css')
  editor.getModel().setLanguage(languageId)
  emmetHTML(monaco)
  emmetCSS(monaco)

  editorRef.value = editor
  monaco.editor.addKeybindingRule({
    keybinding: monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS,
    command: 'editor.action.formatDocument',
    when: 'textInputFocus'
  })
  editor.addAction({
    id: 'open-url',
    label: 'Open URL',
    keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter],
    precondition: 'textInputFocus',
    run: () => {
      open(url.value)
    }
  })

  for (const [snippetLanguage, snippet] of Object.entries(SNIPPETS)) {
    for (const [name, value] of Object.entries(snippet)) {
      monaco.languages.registerCompletionItemProvider(snippetLanguage, {
        provideCompletionItems: () => {
          return {
            suggestions: [
              {
                label: name,
                documentation: value['description'],
                kind: monaco.languages.CompletionItemKind.Snippet,
                insertTextRules:
                  monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                insertText: value['code']
              }
            ]
          }
        }
      })
    }
  }
}

function changeLanguage() {
  editorRef.value.getModel().setLanguage(language.value)

  let ext = language.value
  if (ext == 'javascript') ext = 'js'
  if (ext == 'plain') ext = 'txt'
  filename.value = filename.value.replace(/\.\w+$/, `.${ext}`)

  if (mime.getType(ext)) {
    headers.value.set('Content-Type', mime.getType(ext))
  }
}

function open(url) {
  window.open(url, '_blank')
}

function getFinalURL() {
  const body = base64Checked.value ? btoa(code.value) : code.value

  const url = new URL(location.origin)

  url.pathname = filename.value || ''
  if (body) {
    const body_param = base64Checked.value ? 'b64' : 'body'
    url.searchParams.set(body_param, body)
  }

  if (status.value !== 200) {
    url.searchParams.set('status', status.value)
  }
  if (delay.value > 0) {
    url.searchParams.set('delay', delay.value)
  }

  const headers_ = new Map(headers.value)
  if (hasCORS(headers)) {
    url.searchParams.set('cors', 'true')
    Object.keys(CORS_HEADERS).forEach((name) => headers_.delete(name))
  }

  for (let [name, value] of headers_) {
    if (name.toLowerCase() === 'content-type') {
      const mimeGuess = mime.getType(filename.value.split('.').pop())
      if (mimeGuess == value) {
        continue // skip if implied by file extension
      }
    }

    if (HEADER_ALIAS[name.toLowerCase()]) {
      name = HEADER_ALIAS[name.toLowerCase()]
    }
    if (name.trim()) {
      url.searchParams.set(`h[${name}]`, value)
    }
  }

  const search = url.search || '?'
  return url.pathname + search.replace(/%5B/g, '[').replace(/%5D/g, ']')
}
function copyFinalURL() {
  // Cell edits commit on a document click listener that runs after this button's click handler.
  setTimeout(() => {
    navigator.clipboard.writeText(location.origin + url.value)
  }, 0)
}

function showRandomTip() {
  const tip = TIPS[currentTip.value]
  currentTip.value = (currentTip.value + 1) % TIPS.length
  toast.add({
    severity: 'info',
    life: 15000,
    summary: tip.title,
    detail: tip.description
  })
}

addEventListener(
  'keydown',
  () => {
    addEventListener('beforeunload', (event) => {
      event.preventDefault()
    })
  },
  { once: true }
)
</script>

<template>
  <Toast position="bottom-left"></Toast>
  <div class="mx-4">
    <h1 class="hover-flip inline-block">
      <a href="https://github.com/JorianWoltjer/responder" target="_blank">
        <img src="./favicon.svg" class="image-in-text mr-1"
      /></a>
      <span class="bg-primary">Responder</span>
    </h1>
    <div class="app-layout flex flex-wrap">
      <div class="editor-pane border-round mr-4 mb-3 relative">
        <vue-monaco-editor
          v-model:value="code"
          theme="vs-dark"
          language="html"
          :options="MONACO_EDITOR_OPTIONS"
          @mount="handleMount"
          :height="previewChecked ? 'var(--editor-height-preview)' : 'var(--editor-height)'"
          class="mb-2"
        />
        <iframe
          v-if="previewChecked"
          :src="previewChecked ? url : '/?body='"
          sandbox="allow-scripts allow-forms"
          class="preview-frame"
        ></iframe>
        <div class="mx-2">
          <hr />
          <div>
            <SelectLanguage v-model="language" @change="changeLanguage" />
            <div class="inline absolute right-0 mx-2">
              <Button
                class="mr-2"
                title="Show a random tip"
                icon="pi pi-bell"
                aria-label="Preview"
                severity="secondary"
                @click="showRandomTip()"
              />
              <Button
                :icon="previewChecked ? 'pi pi-eye' : 'pi pi-eye-slash'"
                title="Live Preview"
                aria-label="Live Preview"
                :severity="previewChecked ? 'primary' : 'secondary'"
                @click="previewChecked = !previewChecked"
              />
            </div>
          </div>
        </div>
      </div>
      <div class="config-pane flex flex-column mb-3">
        <StatusField v-model="status" />
        <HeaderTable v-model="headers" class="mb-3" />
        <div class="mt-auto w-full">
          <hr />
          <div class="mb-2 flex">
            <InputText
              class="filename-field flex-1"
              v-tooltip.top="{ value: 'Filename' }"
              placeholder="/"
              v-model="filename"
            />
            <div
              class="delay-group flex align-items-center ml-2 flex-shrink-0"
              v-tooltip.top="{ value: 'Response delay' }"
            >
              <i class="pi pi-clock mr-2 text-primary" aria-hidden="true" />
              <InputNumber
                inputClass="h-2rem"
                :inputStyle="{
                  width: '8ch',
                  minWidth: '8ch',
                  maxWidth: '8ch',
                  flex: '0 0 auto',
                  textAlign: 'center'
                }"
                highlightOnFocus
                :useGrouping="false"
                v-model="delay"
                :min="0"
                :max="300000"
                @input="({ value }) => (delay = value ?? 0)"
              />
              <span class="ml-2">ms</span>
            </div>
            <div class="flex-1 align-self-end text-right">
              <Button
                class="ml-2 w-5rem"
                v-tooltip.top="{ value: 'Base64 body?' }"
                icon="pi pi-barcode"
                :severity="base64Checked ? 'primary' : 'secondary'"
                aria-label="Base64"
                @click="base64Checked = !base64Checked"
              />
              <Button
                class="ml-2 w-5rem"
                v-tooltip.top="{ value: 'Open window' }"
                icon="pi pi-external-link"
                :severity="'secondary'"
                aria-label="Open window"
                @click="open(url)"
              />
            </div>
          </div>
          <div>
            <InputText
              v-tooltip.bottom="{ value: 'Final URL' }"
              :modelValue="url"
              readonly
              placeholder="Disabled"
              class="mr-2"
              style="width: calc(100% - 3rem)"
              @focus="$event.target.select()"
            />
            <Button
              v-tooltip.focus.top="{
                value: 'Copied!',
                pt: {
                  arrow: {
                    style: {
                      borderTopColor: 'var(--primary-color)'
                    }
                  },
                  text: 'bg-primary font-medium'
                }
              }"
              style="float: right"
              icon="pi pi-clipboard"
              severity="secondary"
              aria-label="Copy to Clipboard"
              @click="copyFinalURL"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.app-layout {
  container-type: inline-size;
  container-name: app-layout;
}

.app-layout > .editor-pane,
.app-layout > .config-pane {
  flex: 1 1 0;
  min-width: 0;
}

.editor-pane {
  --editor-height: 80vh;
  --editor-height-preview: 50vh;
  --preview-frame-height: calc(30vh - 0.5rem);
}

.preview-frame {
  width: 100%;
  height: var(--preview-frame-height);
}

@container app-layout (max-width: 56rem) {
  .app-layout {
    flex-direction: column;
    flex-wrap: nowrap;
  }

  .app-layout > .editor-pane,
  .app-layout > .config-pane {
    flex: 0 0 auto;
    width: 100%;
  }

  .editor-pane {
    --editor-height: clamp(12rem, calc(100dvh - 26rem), 42vh);
    --editor-height-preview: clamp(10rem, calc(55dvh - 14rem), 32vh);
    --preview-frame-height: clamp(8rem, calc(45dvh - 14rem), 20vh);
    margin-right: 0 !important;
  }
}

.image-in-text {
  height: 25px;
}
.hover-flip img {
  transition: transform 0.2s ease;
}
.hover-flip:hover img {
  transform: scale(-1, 1);
}
.filename-field {
  min-width: 0;
}

.delay-group :deep(.p-inputnumber) {
  width: auto;
  flex: 0 0 auto;
}

.delay-group :deep(.p-inputnumber-input) {
  width: 8ch !important;
  min-width: 8ch;
  max-width: 8ch;
  flex: 0 0 auto !important;
  text-align: center;
}
</style>
