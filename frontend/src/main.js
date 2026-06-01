import '@fontsource-variable/inter/wght.css'
import './assets/main.css'
import 'primeicons/primeicons.css'
import 'primeflex/primeflex.css'

import { createApp } from 'vue'
import App from './App.vue'

import Aura from '@primeuix/themes/aura'
import { definePreset } from '@primeuix/themes'
import PrimeVue from 'primevue/config'

const AuraDarkGreen = definePreset(Aura, {
  semantic: {
    primary: {
      50: '{green.50}',
      100: '{green.100}',
      200: '{green.200}',
      300: '{green.300}',
      400: '{green.400}',
      500: '{green.500}',
      600: '{green.600}',
      700: '{green.700}',
      800: '{green.800}',
      900: '{green.900}',
      950: '{green.950}'
    }
  }
})
import Button from "primevue/button"
import FloatLabel from "primevue/floatlabel"
import DataTable from "primevue/datatable"
import Column from "primevue/column"
import InputNumber from 'primevue/inputnumber'
import InputText from 'primevue/inputtext'
import Textarea from 'primevue/textarea'
import InputSwitch from 'primevue/inputswitch'
import AutoComplete from 'primevue/autocomplete'
import Toast from 'primevue/toast'
import ToastService from 'primevue/toastservice'
import Tooltip from 'primevue/tooltip';

import { install as VueMonacoEditorPlugin } from '@guolao/vue-monaco-editor'

createApp(App)
  .component('Button', Button)
  .component('FloatLabel', FloatLabel)
  .component('DataTable', DataTable)
  .component('Column', Column)
  .component('InputNumber', InputNumber)
  .component('InputText', InputText)
  .component('Textarea', Textarea)
  .component('InputSwitch', InputSwitch)
  .component('AutoComplete', AutoComplete)
  .component('Toast', Toast)
  .directive('tooltip', Tooltip)
  .use(PrimeVue, {
    ripple: true,
    theme: {
      preset: AuraDarkGreen,
      options: {
        darkModeSelector: '.dark'
      }
    }
  })
  .use(ToastService)
  .use(VueMonacoEditorPlugin, {
    paths: {
      vs: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.55.1/min/vs'
    },
  })
  .mount('#app')
