<script setup lang="ts">
import { ref, onMounted } from 'vue'
import StatusDot from '../common/StatusDot.vue'

defineProps<{ isConnected: boolean }>()

type Theme = 'light' | 'dark' | 'system'
const theme = ref<Theme>((localStorage.getItem('color-theme') as Theme) || 'system')
const isDebug = ref(localStorage.getItem('debug-mode') === 'true')

import { logger } from '../../utils/logger'

const applyTheme = (newTheme: Theme) => {
  theme.value = newTheme
  localStorage.setItem('color-theme', newTheme)
  
  let actualTheme = newTheme
  if (newTheme === 'system') {
    actualTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  
  if (actualTheme === 'dark') {
    document.documentElement.classList.add('dark')
  } else {
    document.documentElement.classList.remove('dark')
  }
}

onMounted(() => {
  applyTheme(theme.value)
  
  // Listen for system theme changes
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (theme.value === 'system') {
      applyTheme('system')
    }
  })
})

const cycleTheme = () => {
    const modes: Theme[] = ['light', 'dark', 'system']
    const nextIndex = (modes.indexOf(theme.value) + 1) % modes.length
    applyTheme(modes[nextIndex])
}

const toggleDebug = async () => {
    try {
        const res = await fetch('/api/debug/toggle', { method: 'POST' })
        const data = await res.json()
        isDebug.value = data.debugMode
        logger.setEnabled(data.debugMode)
    } catch (e) {
        console.error('Failed to toggle debug mode', e)
    }
}
</script>

<template>
  <header class="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-5 h-[52px] shrink-0 flex items-center shadow-sm">
    <div class="flex items-center gap-3">
      <div class="text-green-500 dark:text-green-400 text-xl drop-shadow-[0_0_6px_rgba(34,197,94,0.6)]">⬡</div>
      <span class="font-display text-[13px] tracking-[0.12em] text-gray-900 dark:text-white font-bold">PROYECTO TALLER</span>
    </div>
    
    <div class="ml-auto flex items-center gap-4 text-[11px] text-gray-500 dark:text-gray-400">
      <button 
        @click="toggleDebug" 
        type="button" 
        :class="['flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all font-bold uppercase tracking-widest text-[10px]', 
          isDebug ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800 shadow-sm' : 'bg-gray-50 dark:bg-gray-800 text-gray-400 border-gray-200 dark:border-gray-700 opacity-60 hover:opacity-100']"
        title="Toggle Debug Mode"
      >
        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"></path></svg>
        Debug {{ isDebug ? 'On' : 'Off' }}
      </button>

      <button 
        @click="cycleTheme" 
        type="button" 
        class="text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-4 focus:ring-gray-200 dark:focus:ring-gray-700 rounded-lg text-sm p-2.5 transition-colors flex items-center justify-center min-w-[38px]"
        :title="'Current Theme: ' + theme.charAt(0).toUpperCase() + theme.slice(1)"
      >
        <!-- Light Mode -->
        <svg v-if="theme === 'light'" class="w-4 h-4" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 20 20">
            <path d="M10 15a5 5 0 1 0 0-10 5 5 0 0 0 0 10Zm0-11a1 1 0 0 0 1-1V1a1 1 0 0 0-2 0v2a1 1 0 0 0 1 1Zm0 12a1 1 0 0 0-1 1v2a1 1 0 1 0 2 0v-2a1 1 0 0 0-1-1ZM4.343 5.757a1 1 0 0 0 1.414-1.414L4.343 2.929a1 1 0 0 0-1.414 1.414l1.414 1.414Zm11.314 8.486a1 1 0 0 0-1.414 1.414l1.414 1.414a1 1 0 0 0 1.414-1.414l-1.414-1.414ZM4 10a1 1 0 0 0-1-1H1a1 1 0 0 0 0 2h2a1 1 0 0 0 1-1Zm15-1h-2a1 1 0 1 0 0 2h2a1 1 0 0 0 0-2ZM4.343 14.243l-1.414 1.414a1 1 0 1 0 1.414 1.414l1.414-1.414a1 1 0 0 0-1.414-1.414ZM14.95 6.05a1 1 0 0 0 .707-.293l1.414-1.414a1 1 0 1 0-1.414-1.414l-1.414 1.414a1 1 0 0 0 .707 1.707Z"></path>
        </svg>
        <!-- Dark Mode -->
        <svg v-else-if="theme === 'dark'" class="w-4 h-4" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 18 20">
            <path d="M17.8 13.75a1 1 0 0 0-.859-.5A7.488 7.488 0 0 1 10.52 2a1 1 0 0 0 0-.969A1.035 1.035 0 0 0 9.687.5h-.113a9.5 9.5 0 1 0 8.222 14.247 1 1 0 0 0 .004-.997Z"></path>
        </svg>
        <!-- System Mode -->
        <svg v-else class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path>
        </svg>
      </button>

      <div class="flex items-center gap-2">
        <StatusDot :active="isConnected" />
        <span class="uppercase font-semibold tracking-wider">{{ isConnected ? 'connected' : 'connecting...' }}</span>
      </div>
    </div>
  </header>
</template>
