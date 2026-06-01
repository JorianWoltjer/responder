<script setup>
import { getReasonPhrase } from 'http-status-codes'

const status = defineModel()

function codeToReasonPhrase(code) {
  try {
    return `"${getReasonPhrase(code)}"`
  } catch {
    return `???`
  }
}
</script>

<template>
  <div>
    <strong class="mr-2 text-primary">Status:</strong>
    <InputNumber
      inputClass="status h-2rem"
      highlightOnFocus
      :useGrouping="false"
      v-model="status"
      :min="100"
      :max="699"
    />
    - {{ codeToReasonPhrase(status) }}
  </div>
</template>

<style>
.status {
  width: 6ch;
  text-align: center;
}
</style>
