<script setup>
import Select from 'primevue/select'

const model = defineModel()

const languages = ['html', 'javascript', 'json', 'xml', 'css', 'plain']
</script>

<template>
  <Select
    v-model="model"
    filter
    autoFilterFocus
    :options="languages"
    placeholder="Select Language"
    class="w-14rem"
  />
</template>
