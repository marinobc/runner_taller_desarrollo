<script setup lang="ts">
import { ref, watch, onUnmounted, nextTick } from 'vue'
import { FocusTrap } from 'focus-trap-vue'
import { X, TriangleAlert } from 'lucide-vue-next'
import { useToast } from '../../composables/useToast'

const props = defineProps<{
  service: any
  show: boolean
}>()

const emit = defineEmits(['close', 'refresh'])
const { showToast } = useToast()

const logs = ref<any[]>([])
const containerRef = ref<HTMLElement | null>(null)
let stream: EventSource | null = null

const scrollToBottom = () => {
  nextTick(() => {
    if (containerRef.value) {
      containerRef.value.scrollTop = containerRef.value.scrollHeight
    }
  })
}

const loadHistory = async () => {
  if (!props.service) return
  try {
    const res = await fetch(`/api/services/${props.service.id}/logs`)
    const data = await res.json()
    if (data.logs) {
      logs.value = data.logs
      scrollToBottom()
    }
  } catch (e) {
    console.error('Failed to fetch logs history', e)
  }
}

const connectStream = () => {
  if (!props.service) return
  stream = new EventSource(`/api/stream/${props.service.id}`)
  stream.onmessage = (e) => {
    try {
      const entry = JSON.parse(e.data)
      if (entry.clear) {
        logs.value = []
        return
      }
      logs.value.push(entry)
      scrollToBottom()
    } catch (err) {}
  }
}

const teardown = () => {
  if (stream) {
    stream.close()
    stream = null
  }
  logs.value = []
}

watch(() => props.show, (newVal) => {
  if (newVal) {
    loadHistory().then(() => connectStream())
  } else {
    teardown()
  }
}, { immediate: true })

onUnmounted(() => {
  teardown()
})

const killConflicting = async () => {
  if (!props.service?.conflictingPid) return
  try {
    const res = await fetch(`/api/ports/kill/${props.service.conflictingPid}`, { method: 'POST' })
    if (res.ok) {
      showToast(`Process ${props.service.conflictingPid} killed!`, 'success')
      emit('refresh')
    }
  } catch (e) {
    showToast('Failed to kill process', 'error')
  }
}

const copyLogs = async () => {
  if (!logs.value.length) {
    showToast('No logs to copy', 'info')
    return
  }
  
  const text = logs.value.map(l => {
    const timestamp = l.ts ? `[${l.ts}] ` : ''
    const content = l.line || l.msg || ''
    return `${timestamp}${content}`
  }).join('\n')

  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text)
      showToast('Logs copied to clipboard!', 'success')
    } else {
      // Fallback for non-secure contexts if possible, or just better error
      throw new Error('Clipboard API not available')
    }
  } catch (e) {
    console.error('Failed to copy logs:', e)
    showToast('Failed to copy. Use HTTPS or localhost.', 'error')
  }
}

const clearLogs = async () => {
  if (!props.service) return
  try {
    const res = await fetch(`/api/services/${props.service.id}/clear-logs`, { method: 'POST' })
    if (res.ok) {
      logs.value = []
      showToast('Service logs cleared!', 'info')
    } else {
      showToast('Failed to clear logs on server', 'error')
    }
  } catch (e) {
    showToast('Network error while clearing logs', 'error')
  }
}
</script>

<template>
  <Teleport to="body">
    <div v-if="show" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm transition-opacity">
      <FocusTrap :active="show" initialFocus="#logs-close-btn">
        <div 
          class="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl flex flex-col h-[80vh] overflow-hidden border border-gray-200 dark:border-gray-700"
          role="dialog"
          aria-modal="true"
          aria-labelledby="logs-modal-title"
        >
        
        <!-- Header -->
        <div class="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700 shrink-0">
          <div class="flex items-center gap-3">
            <div :class="['w-3 h-3 rounded-full', service?.running ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-red-500']"></div>
            <h3 id="logs-modal-title" class="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <span class="inline-block w-2.5 h-2.5 rounded-sm" :style="{ backgroundColor: service?.color }" aria-hidden="true"></span>
              {{ service?.label }} Logs
            </h3>
            <span v-if="service?.pid" class="text-xs text-blue-600 dark:text-blue-400 font-mono bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded ml-2">PID {{ service?.pid }}</span>
            <span v-if="service?.port" class="text-xs text-amber-600 dark:text-amber-400 font-mono bg-amber-50 dark:bg-amber-900/30 px-2 py-0.5 rounded ml-1">PORT {{ service?.port }}</span>
          </div>
          <div class="flex items-center gap-2">
            <button 
              @click="copyLogs" 
              class="text-xs font-medium text-gray-900 focus:outline-none focus:ring-4 focus:ring-gray-100 dark:focus:ring-gray-700 bg-white rounded-lg border border-gray-200 hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-600 dark:hover:text-white dark:hover:bg-gray-700 px-3 py-1.5 transition-colors"
              aria-label="Copy service logs"
            >
              📋 Copy
            </button>
            <button 
              @click="clearLogs" 
              class="text-xs font-medium text-gray-900 focus:outline-none focus:ring-4 focus:ring-gray-100 dark:focus:ring-gray-700 bg-white rounded-lg border border-gray-200 hover:bg-gray-100 hover:text-blue-700 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-600 dark:hover:text-white dark:hover:bg-gray-700 px-3 py-1.5 transition-colors"
              aria-label="Clear service logs"
            >
              🗑 Clear
            </button>
            <button 
              id="logs-close-btn"
              @click="emit('close')" 
              class="text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors ml-2 bg-transparent" 
              aria-label="Close logs"
            >
              <X class="w-5 h-5" aria-hidden="true" />
            </button>
          </div>
        </div>

        <!-- Log Content -->
        <div ref="containerRef" class="flex-1 overflow-auto p-4 bg-gray-50 dark:bg-gray-900 scrollbar-gutter-stable">
          <div v-if="logs.length === 0" class="text-gray-400 text-center py-10 italic text-sm font-mono">
            No logs available for this service.
          </div>
          <div 
            v-for="(log, idx) in logs" 
            :key="idx" 
            class="terminal-log-line block hover:bg-gray-200/40 dark:hover:bg-gray-800/40 px-2 text-[12px] whitespace-pre"
          ><span class="text-gray-500/50 select-none">[{{ log.ts }}] </span><span class="text-gray-800 dark:text-gray-300">{{ log.line }}</span></div>
        </div>

        <!-- Conflict Footer -->
        <div v-if="service?.conflictingPid" class="bg-amber-50 dark:bg-amber-900/20 border-t border-amber-500/20 px-6 py-3 flex items-center justify-between shrink-0">
          <div class="flex items-center gap-2 text-amber-700 dark:text-amber-400 text-[11px] font-bold uppercase tracking-wider">
            <TriangleAlert class="w-4 h-4" aria-hidden="true" />
            Port {{ service.port }} is blocked by PID {{ service.conflictingPid }}
          </div>
          <button 
            @click="killConflicting"
            class="text-[10px] font-black text-amber-500 hover:text-white hover:bg-amber-600 border border-amber-500/50 rounded px-3 py-1 transition-all uppercase tracking-widest"
          >
            Nuke Conflict
          </button>
        </div>

        </div>
      </FocusTrap>
    </div>
  </Teleport>
</template>

<style scoped>
.scrollbar-gutter-stable {
  scrollbar-gutter: stable;
}
</style>
