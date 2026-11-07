<script setup>
import { ref } from 'vue'
import { BrowseAiCore } from 'browse-ai-core/vue'

const open = ref(false)
const config = {
  palette: 'violet',
  strings: { inputPlaceholder: 'Ask about this page' }
}
</script>

<template>
  <h1>My app</h1>
  <button @click="open = true">Ask AI</button>

  <BrowseAiCore
    v-model:open="open"
    :config="config"
    theme="dark"
    @message-sent="(event) => console.log('User asked:', event.text)"
  />
</template>
