<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Check } from 'lucide-vue-next'

const props = defineProps<{
  initialBackend?: string
  initialFrontend?: string
}>()

const emit = defineEmits(['updated'])

const backendPath = ref('')
const frontendPath = ref('')

onMounted(() => {
  backendPath.value = props.initialBackend || ''
  frontendPath.value = props.initialFrontend || ''
})

import { useToast } from '../../composables/useToast'

const { showToast } = useToast()

const applyPaths = async () => {
  try {
    const res = await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        backendRoot: backendPath.value.trim(), 
        frontendRoot: frontendPath.value.trim() 
      })
    })
    const data = await res.json()
    if (data.ok) {
      emit('updated', data)
    } else {
      showToast(data.error || 'Failed to update paths', 'error')
    }
  } catch (e) {
    console.error('Failed to update paths', e)
    showToast('Failed to update paths', 'error')
  }
}
</script>

<template>
  <div class="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-5 py-3 flex gap-5 shrink-0 shadow-sm items-center">
    <!-- Combined Paths Grid -->
    <div class="flex-1 grid grid-cols-2 gap-4">
      <!-- Backend Path -->
      <div class="flex flex-col gap-1">
        <div class="flex items-stretch shadow-sm">
          <label for="backend-path-input" class="relative inline-flex items-center justify-center text-[10px] font-bold tracking-[0.15em] text-gray-900 bg-gray-200 border border-r-0 border-gray-300 rounded-l-lg dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 min-w-[105px] uppercase cursor-pointer">
            <div class="w-1.5 h-[50%] absolute left-0 top-1/2 -translate-y-1/2 bg-orange-400 dark:bg-orange-500 rounded-r-sm" aria-hidden="true"></div>
            BACKEND
          </label>
          <input 
            id="backend-path-input"
            v-model="backendPath"
            type="text" 
            placeholder="Path to Backend root"
            class="rounded-r-lg bg-white border border-gray-300 text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 block flex-1 min-w-0 w-full text-xs font-mono p-2.5 dark:bg-gray-800 dark:border-gray-600 dark:placeholder-gray-400 dark:text-cyan-400 dark:focus:ring-blue-500 dark:focus:border-blue-500 placeholder:italic transition-all"
          />
        </div>
        <div v-if="initialBackend" class="flex items-center gap-1.5 px-1 mt-0.5">
          <span class="flex w-1.5 h-1.5 bg-green-500 rounded-full shadow-[0_0_5px_rgba(34,197,94,0.5)]"></span>
          <span class="text-[10px] text-gray-500 dark:text-gray-400 font-medium tracking-tight">Active: <span class="font-mono text-gray-600 dark:text-gray-400">{{ initialBackend }}</span></span>
        </div>
      </div>

      <!-- Frontend Path -->
      <div class="flex flex-col gap-1">
        <div class="flex items-stretch shadow-sm">
          <label for="frontend-path-input" class="relative inline-flex items-center justify-center text-[10px] font-bold tracking-[0.15em] text-gray-900 bg-gray-200 border border-r-0 border-gray-300 rounded-l-lg dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 min-w-[105px] uppercase cursor-pointer">
            <div class="w-1.5 h-[50%] absolute left-0 top-1/2 -translate-y-1/2 bg-green-400 dark:bg-green-500 rounded-r-sm" aria-hidden="true"></div>
            FRONTEND
          </label>
          <input 
            id="frontend-path-input"
            v-model="frontendPath"
            type="text" 
            placeholder="Path to Frontend root"
            class="rounded-r-lg bg-white border border-gray-300 text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 block flex-1 min-w-0 w-full text-xs font-mono p-2.5 dark:bg-gray-800 dark:border-gray-600 dark:placeholder-gray-400 dark:text-cyan-400 dark:focus:ring-blue-500 dark:focus:border-blue-500 placeholder:italic transition-all"
          />
        </div>
        <div v-if="initialFrontend" class="flex items-center gap-1.5 px-1 mt-0.5">
          <span class="flex w-1.5 h-1.5 bg-green-500 rounded-full shadow-[0_0_5px_rgba(34,197,94,0.5)]"></span>
          <span class="text-[10px] text-gray-500 dark:text-gray-400 font-medium tracking-tight">Active: <span class="font-mono text-gray-600 dark:text-gray-400">{{ initialFrontend }}</span></span>
        </div>
      </div>
    </div>

    <!-- Single Action Button -->
    <div class="self-start">
      <button 
        @click="applyPaths"
        type="button"
        class="group relative inline-flex items-center justify-center px-6 py-2.5 text-xs font-bold tracking-[0.1em] text-white transition-all duration-200 bg-blue-600 rounded-lg hover:bg-blue-700 focus:ring-4 focus:outline-none focus:ring-blue-300 dark:bg-blue-600 dark:hover:bg-blue-700 dark:focus:ring-blue-800 shadow-md hover:shadow-lg active:scale-95"
      >
        <Check class="w-4 h-4 mr-2 -ml-1 transition-transform group-hover:rotate-12" aria-hidden="true" />
        APPLY CHANGES
        <div class="absolute inset-0 rounded-lg bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
      </button>
    </div>
  </div>
</template>
