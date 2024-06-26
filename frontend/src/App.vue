<script setup>
import { computed, ref, shallowRef } from 'vue'
import { SelectLanguage, HeaderTable, StatusField } from '@/components'
import { CORS_HEADERS, HEADER_ALIAS, SNIPPETS, TIPS, hasCORS } from '@/utils'

import { useToast } from 'primevue/usetoast'
import { emmetHTML } from 'emmet-monaco-es'
import mime from 'mime'

const previewChecked = ref(false)
const base64Checked = ref(false)
const code = ref(`<h1>Hello, world!</h1>`)
const language = ref('html')
const filename = ref('poc.html')
const status = ref(200)
const headers = ref(
  new Map([
    ['Content-Type', 'text/html'],
    ['', '']
  ])
)
const url = ref(computed(() => getFinalURL()))
const toast = useToast()
const currentTip = ref(0)

const MONACO_EDITOR_OPTIONS = {
  automaticLayout: true,
  formatOnType: true,
  formatOnPaste: true,
  autoIndent: true,
  wordWrap: 'on'
}

const editorRef = shallowRef()
const handleMount = (editor) => {
  emmetHTML(window.monaco)

  editorRef.value = editor
  editor.onKeyDown((e) => {
    if (e.ctrlKey && e.code === 'KeyS') {
      e.preventDefault()
      formatCode()
    }
  })

  for (const [language, snippet] of Object.entries(SNIPPETS)) {
    for (const [name, value] of Object.entries(snippet)) {
      window.monaco.languages.registerCompletionItemProvider(language, {
        provideCompletionItems: () => {
          return {
            suggestions: [
              {
                label: name,
                documentation: value['description'],
                kind: window.monaco.languages.CompletionItemKind.Snippet,
                insertTextRules:
                  window.monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                insertText: value['code']
              }
            ]
          }
        }
      })
    }
  }
}

function formatCode() {
  editorRef.value?.getAction('editor.action.formatDocument').run()
}

function changeLanguage() {
  editorRef.value.getModel().setLanguage(language.value)

  let ext = language.value
  if (ext == 'javascript') ext = 'js'
  if (ext == 'plain') ext = 'txt'
  filename.value = filename.value.replace(/\.\w+$/, `.${ext}`)
  url.value = getFinalURL()

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
function copyFinalURL(text) {
  navigator.clipboard.writeText(location.origin + text)
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

addEventListener('beforeunload', (event) => {
  event.preventDefault()
})
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
    <div class="flex flex-wrap">
      <div class="flex-1 border-round mr-4 mb-3 relative">
        <vue-monaco-editor
          v-model:value="code"
          theme="vs-dark"
          language="html"
          :options="MONACO_EDITOR_OPTIONS"
          @mount="handleMount"
          :height="previewChecked ? '50vh' : '80vh'"
          class="mb-2"
        />
        <iframe
          v-if="previewChecked"
          :src="previewChecked ? url : '/?body='"
          sandbox="allow-scripts allow-forms"
          style="width: 100%; height: calc(30vh - 0.5rem)"
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
      <div class="flex-1 flex flex-column mb-3">
        <StatusField v-model="status" />
        <HeaderTable v-model="headers" class="mb-3" />
        <div class="mt-auto w-full">
          <hr />
          <div class="mb-2 flex">
            <InputText
              v-tooltip.top="{ value: 'Filename' }"
              placeholder="/"
              v-model="filename"
              @input="url = getFinalURL()"
            />
            <div class="flex-1 align-self-end text-right">
              <Button
                class="ml-2 w-5rem"
                v-tooltip.top="{ value: 'Base64 body?' }"
                icon="pi pi-barcode"
                :severity="base64Checked ? 'primary' : 'secondary'"
                aria-label="Base64"
                @click="
                  () => {
                    base64Checked = !base64Checked
                    url = getFinalURL()
                  }
                "
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
              v-model="url"
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
              @click="copyFinalURL(url)"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.image-in-text {
  height: 25px;
}
.hover-flip img {
  transition: transform 0.2s ease;
}
.hover-flip:hover img {
  transform: scale(-1, 1);
}
</style>
