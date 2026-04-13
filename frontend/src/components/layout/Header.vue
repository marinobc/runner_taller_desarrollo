<script setup lang="ts">
import { ref, onMounted } from 'vue'
import StatusDot from '../common/StatusDot.vue'

defineProps<{ isConnected: boolean }>()

type Theme = 'light' | 'dark' | 'system'
const theme = ref<Theme>((localStorage.getItem('color-theme') as Theme) || 'system')
const isDebug = ref(localStorage.getItem('debug-mode') === 'true')

import { logger } from '../../utils/logger'
import { Code, Sun, Moon, Monitor } from 'lucide-vue-next'

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
      <div class="text-green-500 dark:text-green-400 text-xl drop-shadow-[0_0_6px_rgba(34,197,94,0.6)]" aria-hidden="true">⬡</div>
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
        <Code class="w-3.5 h-3.5" aria-hidden="true" />
        Debug {{ isDebug ? 'On' : 'Off' }}
      </button>

      <button 
        @click="cycleTheme" 
        type="button" 
        :aria-label="'Current Theme: ' + theme.charAt(0).toUpperCase() + theme.slice(1)"
      >
        <!-- Light Mode -->
        <Sun v-if="theme === 'light'" class="w-4 h-4" aria-hidden="true" />
        <!-- Dark Mode -->
        <Moon v-else-if="theme === 'dark'" class="w-4 h-4" aria-hidden="true" />
        <!-- System Mode -->
        <Monitor v-else class="w-4 h-4" aria-hidden="true" />
      </button>

      <div class="flex items-center gap-2">
        <StatusDot :active="isConnected" />
        <span class="uppercase font-semibold tracking-wider">{{ isConnected ? 'connected' : 'connecting...' }}</span>
      </div>
    </div>
  </header>
</template>
