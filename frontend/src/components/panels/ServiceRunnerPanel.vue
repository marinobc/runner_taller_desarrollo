<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import ServiceCard from '../runner/ServiceCard.vue'
import ServiceLogsModal from '../runner/ServiceLogsModal.vue'
import type { Service } from '../../App.vue'

const props = defineProps<{
  services: Service[]
}>()

const emit = defineEmits(['refresh'])

const runningCount = computed(() => props.services.filter((s: Service) => s.running).length)
const logs = ref<{ ts: string, msg: string, level: string }[]>([])
const consoleLogRef = ref<HTMLElement | null>(null)
const selectedLogService = ref<Service | null>(null)

let stream: EventSource | null = null

const log = (msg: string, level: string = 'INFO') => {
  const ts = new Date().toLocaleTimeString('en-US', { hour12: false })
  logs.value.push({ ts, msg, level })
  setTimeout(() => {
    if (consoleLogRef.value) {
      consoleLogRef.value.scrollTop = consoleLogRef.value.scrollHeight
    }
  }, 10)
}

const clearConsole = () => {
  logs.value = []
}

const globalNpmInstall = ref(false)
const globalMvnClean = ref(false)

const startService = async (id: string, opts: any = {}) => {
  // If no specific opts provided, use global toggles based on service type? 
  // Actually, usually individual toggles in cards take precedence.
  await fetch(`/api/services/${id}/start`, { 
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(opts)
  })
}

const stopService = async (id: string) => {
  await fetch(`/api/services/${id}/stop`, { method: 'POST' })
}

const startAll = async () => {
  await fetch('/api/services/start-all', { 
    method: 'POST', 
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      npmInstall: globalNpmInstall.value,
      cleanInstall: globalMvnClean.value
    })
  })
}

const stopAll = async () => {
  await fetch('/api/services/stop-all', { method: 'POST' })
}

const nukeAll = async () => {
  try {
    const res = await fetch('/api/ports/nuke-all', { 
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ services: props.services })
    })
    const data = await res.json()
    if (data.ok) {
      showToast(`☢ Nuke complete: ${data.count} processes cleared`, 'success')
      emit('refresh')
    }
  } catch (e) {
    showToast('Nuke operation failed', 'error')
  }
}

const toggleStream = () => {
  if (stream) stream.close()
  stream = new EventSource('/api/stream/global')
  stream.onmessage = (e) => {
    const data = JSON.parse(e.data)
    if (data.level === 'SYSTEM') return // skip internal system messages
    log(data.msg, data.level)
  }
}

import { useToast } from '../../composables/useToast'

const { showToast } = useToast()

const copyGlobalLogs = async () => {
  if (logs.value.length === 0) return
  const text = logs.value.map(l => `[${l.ts}] ${l.msg}`).join('\n')
  try {
    await navigator.clipboard.writeText(text)
    showToast('Global logs copied!', 'success')
  } catch (e) {
    showToast('Failed to copy logs', 'error')
  }
}

onMounted(() => {
  toggleStream()
})

onUnmounted(() => {
  if (stream) stream.close()
})
</script>

<template>
  <div class="flex-1 flex flex-col h-full bg-white dark:bg-gray-900">
    <!-- Runner Actions Toolbar -->
    <div class="px-5 py-3 border-b border-gray-200 dark:border-gray-700 flex gap-2 items-center shrink-0">
      <button 
        @click="startAll"
        type="button" 
        class="focus:outline-none text-white bg-green-700 hover:bg-green-800 focus:ring-4 focus:ring-green-300 font-medium rounded-lg text-xs px-4 py-2 dark:bg-green-600 dark:hover:bg-green-700 dark:focus:ring-green-800 transition-colors"
      >
        ▶ Start All
      </button>
      <button 
        @click="stopAll"
        type="button" 
        class="focus:outline-none text-white bg-red-700 hover:bg-red-800 focus:ring-4 focus:ring-red-300 font-medium rounded-lg text-xs px-4 py-2 dark:bg-red-600 dark:hover:bg-red-700 dark:focus:ring-red-900 transition-colors"
      >
        ■ Stop All
      </button>

      <button 
        @click="nukeAll"
        type="button" 
        class="focus:outline-none text-white bg-amber-500 hover:bg-amber-600 focus:ring-4 focus:ring-amber-300 font-medium rounded-lg text-xs px-4 py-2 dark:focus:ring-amber-900 transition-colors"
        title="Terminate all conflicting background processes"
      >
        ☢ Nuke All
      </button>

      <div class="h-6 w-px bg-gray-300 dark:bg-gray-700 mx-2"></div>

      <div class="flex items-center gap-4">
        <label class="inline-flex items-center cursor-pointer">
          <input type="checkbox" v-model="globalNpmInstall" class="sr-only peer">
          <div class="relative w-7 h-4 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
          <span class="ms-2 text-[11px] font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">Global npm install</span>
        </label>

        <label class="inline-flex items-center cursor-pointer">
          <input type="checkbox" v-model="globalMvnClean" class="sr-only peer">
          <div class="relative w-7 h-4 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
          <span class="ms-2 text-[11px] font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">Global mvn clean</span>
        </label>
      </div>
      
      <!-- Port Dashboard -->
      <div class="flex items-center gap-1.5 ml-2 p-1 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
        <div 
          v-for="svc in services.filter(s => s.port)" 
          :key="'port-' + svc.id"
          :title="svc.label + ' (Port ' + svc.port + ')'"
          :class="['px-2 py-1 rounded text-[10px] font-black font-mono transition-all',
            svc.running ? 'bg-green-600 text-white shadow-sm shadow-green-500/20' : 
            svc.conflictingPid ? 'bg-amber-400 text-amber-900 animate-pulse' : 
            'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 opacity-60'
          ]"
        >
          :{{ svc.port }}
        </div>
      </div>
      
      <div class="flex-1"></div>
      
      <div class="flex items-center gap-3 px-3 py-1.5 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm">
        <div class="flex flex-col items-center leading-none">
          <span class="text-[9px] font-bold text-gray-400 uppercase tracking-tighter">Services</span>
          <span class="text-xs font-black text-blue-600 dark:text-blue-400">{{ services.length }}</span>
        </div>
        <div class="w-px h-4 bg-gray-200 dark:bg-gray-700"></div>
        <div class="flex flex-col items-center leading-none">
          <span class="text-[9px] font-bold text-gray-400 uppercase tracking-tighter">Online</span>
          <span class="text-xs font-black text-green-600 dark:text-green-400">{{ runningCount }}</span>
        </div>
      </div>
    </div>
    
    <!-- Services List -->
    <div class="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-3">
      <div v-if="services.length === 0" class="p-5 text-gray-500 dark:text-gray-400 text-center text-sm">
        No services found. Ensure backend path is valid.
      </div>
      <ServiceCard 
        v-for="svc in services" 
        :key="svc.id" 
        :service="svc" 
        :defaultInstall="globalNpmInstall"
        :defaultClean="globalMvnClean"
        @start="(opts) => startService(svc.id, opts)" 
        @stop="stopService(svc.id)" 
        @view-logs="selectedLogService = svc"
      />
    </div>
    
    <!-- Console Panel -->
    <div class="bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 h-[220px] shrink-0 flex flex-col">
      <div class="flex items-center px-4 py-2 border-b border-gray-200 dark:border-gray-700 shrink-0">
        <span class="text-[10px] font-bold tracking-widest text-gray-500 dark:text-gray-400 uppercase">● Global Log</span>
        <div class="ml-auto flex gap-2">
          <button 
            @click="copyGlobalLogs"
            class="text-xs font-medium text-gray-900 focus:outline-none bg-white rounded-lg border border-gray-200 hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-600 dark:hover:text-white dark:hover:bg-gray-700 px-3 py-1"
          >
            Copy
          </button>
          <button 
            @click="clearConsole"
            class="text-xs font-medium text-gray-900 focus:outline-none bg-white rounded-lg border border-gray-200 hover:bg-gray-100 hover:text-blue-700 focus:z-10 focus:ring-4 focus:ring-gray-100 dark:focus:ring-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-600 dark:hover:text-white dark:hover:bg-gray-700 px-3 py-1"
          >
            Clear
          </button>
        </div>
      </div>
      <div ref="consoleLogRef" class="flex-1 overflow-auto p-4 bg-gray-50/50 dark:bg-gray-900/30">
        <div 
          v-for="(logItem, index) in logs" 
          :key="index" 
          class="terminal-log-line block text-[12px] whitespace-pre"
        ><span class="text-gray-500/50 select-none">[{{ logItem.ts }}] </span><span :class="[
            logItem.level === 'START' ? 'text-green-600 dark:text-green-400 font-bold' : '',
            logItem.level === 'STOP' ? 'text-red-600 dark:text-red-400 font-bold' : '',
            (logItem.level !== 'START' && logItem.level !== 'STOP') ? 'text-gray-600 dark:text-gray-300' : ''
          ]">{{ logItem.msg }}</span></div>
      </div>
    </div>
    
    <ServiceLogsModal 
      :show="!!selectedLogService" 
      :service="selectedLogService" 
      @close="selectedLogService = null" 
    />
  </div>
</template>
