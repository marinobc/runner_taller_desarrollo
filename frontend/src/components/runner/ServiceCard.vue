<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useToast } from '../../composables/useToast'
import StatusDot from '../common/StatusDot.vue'
import ConflictModal from './ConflictModal.vue'
import { Zap, Globe, TriangleAlert } from 'lucide-vue-next'

const props = defineProps<{
  service: {
    id: string
    label: string
    type: string
    color: string
    running?: boolean
    pid?: number | null
    port?: number | null
    conflictingPid?: number | null
  },
  defaultInstall?: boolean,
  defaultClean?: boolean
}>()

const emit = defineEmits(['start', 'stop', 'view-logs'])
const { showToast } = useToast()

const runInstall = ref(false)
const runClean = ref(false)
const showConflictModal = ref(false)

// Sync with global toggles
watch(() => props.defaultInstall, (val) => { if (val !== undefined) runInstall.value = val }, { immediate: true })
watch(() => props.defaultClean, (val) => { if (val !== undefined) runClean.value = val }, { immediate: true })

// Sync with global toggles
watch(() => props.defaultInstall, (val) => { if (val !== undefined) runInstall.value = val }, { immediate: true })
watch(() => props.defaultClean, (val) => { if (val !== undefined) runClean.value = val }, { immediate: true })

const handleStartClick = async () => {
  if (props.service.conflictingPid) {
    showConflictModal.value = true
  } else {
    emit('start', { npmInstall: runInstall.value, cleanInstall: runClean.value })
  }
}

const killConflicting = async () => {
  if (!props.service.conflictingPid) return
  try {
    const res = await fetch(`/api/ports/kill/${props.service.conflictingPid}`, { method: 'POST' })
    if (res.ok) {
      showToast(`Process ${props.service.conflictingPid} killed!`, 'success')
      showConflictModal.value = false
      emit('view-logs') // Wait, actually just refresh
      // Parent will refresh state
    }
  } catch (e) {
    showToast('Failed to kill process', 'error')
  }
}

// State is now fully managed by App.vue and backend

const bgClass = computed(() => props.service.running 
  ? 'bg-green-50/30 dark:bg-green-900/10 border-green-500/30 dark:border-green-800/50' 
  : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700')
</script>

<template>
  <div :class="['relative shrink-0 flex flex-col border rounded-2xl transition-all duration-300 shadow-sm overflow-hidden', bgClass]">
    <!-- Color Bar Accent (Top) -->
    <div class="h-1 w-full opacity-60" :style="{ backgroundColor: service.color }"></div>

    <div class="flex items-center gap-0 min-h-[90px]">
      <!-- 1. IDENTITY COLUMN -->
      <div class="w-72 shrink-0 px-6 flex flex-col justify-center border-r border-gray-100 dark:border-gray-700/50 self-stretch py-3">
        <div class="flex items-center gap-2 mb-1">
          <StatusDot :active="!!service.running" />
          <span class="text-[16px] font-black uppercase tracking-tight text-gray-900 dark:text-white truncate">
            {{ service.label }}
          </span>
        </div>
        <div class="flex items-center gap-2">
          <span class="px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 tracking-wider">
            {{ service.type }}
          </span>
          <div v-if="service.port" class="flex items-center gap-1.5 px-2 py-0.5 bg-blue-50 dark:bg-blue-900/20 border border-blue-200/50 dark:border-blue-800/50 rounded-md">
            <Zap class="w-3 h-3 text-blue-500" />
            <span class="text-[11px] font-mono font-black text-blue-600 dark:text-blue-400">:{{ service.port }}</span>
          </div>
        </div>
      </div>

      <!-- 2. CONTROLS COLUMN -->
      <div class="flex-1 px-8 flex flex-col justify-center gap-2 border-r border-gray-100 dark:border-gray-700/50 self-stretch py-3">
        <div v-if="!service.running" class="flex flex-wrap items-center gap-4">
          <label v-if="service.type === 'node'" class="inline-flex items-center cursor-pointer group">
            <input type="checkbox" v-model="runInstall" class="sr-only peer">
            <div class="relative w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
            <span class="ms-3 text-[11px] font-bold text-gray-400 group-hover:text-blue-500 transition-colors uppercase tracking-widest">NPM INSTALL</span>
          </label>

          <label v-if="service.type === 'maven'" class="inline-flex items-center cursor-pointer group">
            <input type="checkbox" v-model="runClean" class="sr-only peer">
            <div class="relative w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
            <span class="ms-3 text-[11px] font-bold text-gray-400 group-hover:text-amber-500 transition-colors uppercase tracking-widest">MVN CLEAN</span>
          </label>
        </div>

        <div v-if="service.running && service.pid" class="flex items-center gap-2">
          <div class="flex items-center px-3 py-1.5 bg-green-500/10 text-green-600 dark:text-green-400 rounded-lg border border-green-500/20 text-[10px] font-bold font-mono">
            <span class="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></span>
            PID: {{ service.pid }}
          </div>
          <div v-if="service.port" class="px-3 py-1.5 bg-blue-600 text-white rounded-lg border border-blue-700 shadow-sm text-[10px] font-black font-mono flex items-center gap-2">
            <Globe class="w-3 h-3" />
            PORT: {{ service.port }}
          </div>
        </div>
        
        <div v-if="!service.running && !service.pid" class="text-[10px] text-gray-400 dark:text-gray-500 font-medium italic tracking-wide">
          Ready to start. Select build options if needed.
        </div>
      </div>

      <!-- 3. STATUS & ACTIONS COLUMN -->
      <div class="w-64 shrink-0 px-6 flex flex-col justify-center gap-3 py-3">
        <div :class="['text-[11px] font-black tracking-[0.2em] uppercase transition-colors text-center', 
          service.running ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-600']">
          {{ service.running ? 'ONLINE' : 'OFFLINE' }}
        </div>
        
        <div class="flex items-center gap-2">
          <button v-if="service.conflictingPid"
            @click="showConflictModal = true"
            class="flex-1 px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-white transition-all bg-amber-500 rounded-lg hover:bg-amber-600 focus:ring-4 focus:ring-amber-300 dark:focus:ring-amber-900 shadow-md shadow-amber-500/20"
            title="Review and resolve port conflict"
          >
            Nuke
          </button>
          <button v-else
            @click="handleStartClick" 
            :disabled="service.running"
            class="flex-1 px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-white transition-all bg-blue-700 rounded-lg hover:bg-blue-800 focus:ring-4 focus:ring-blue-300 dark:bg-blue-600 dark:hover:bg-blue-700 dark:focus:ring-blue-800 disabled:opacity-20 shadow-md shadow-blue-500/20"
          >
            Start
          </button>
          <button 
            @click="emit('view-logs')" 
            class="px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-gray-900 bg-white border border-gray-200 rounded-lg hover:bg-gray-100 hover:text-blue-700 focus:z-10 focus:ring-4 focus:ring-gray-100 dark:focus:ring-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-600 dark:hover:text-white dark:hover:bg-gray-700 transition-all"
          >
            Logs
          </button>
          <button 
            @click="emit('stop')" 
            :disabled="!service.running"
            class="px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-white bg-red-700 rounded-lg hover:bg-red-800 focus:ring-4 focus:ring-red-300 dark:bg-red-600 dark:hover:bg-red-700 dark:focus:ring-red-900 transition-all disabled:opacity-20"
          >
            Stop
          </button>
        </div>
      </div>
    </div>

    <!-- Conflict Warning (Footer) -->
    <div v-if="service.conflictingPid" class="bg-amber-50 dark:bg-amber-900/20 border-t border-amber-500/20 px-8 py-4 flex items-center justify-between">
      <div class="flex items-center gap-3 text-amber-700 dark:text-amber-400 text-xs font-bold">
        <TriangleAlert class="w-5 h-5" />
        <span>PORT CONFLICT: {{ service.port }} is blocked by PID <span class="underline decoration-2">{{ service.conflictingPid }}</span></span>
      </div>
      <button 
        @click="showConflictModal = true"
        class="text-[10px] font-black text-amber-500 hover:text-white hover:bg-amber-600 border-2 border-amber-500/50 rounded-lg px-4 py-1.5 transition-all uppercase tracking-widest"
      >
        Nuke Conflicting Process
      </button>
    </div>

    <!-- Port Conflict Modal -->
    <ConflictModal 
      :show="showConflictModal"
      :serviceLabel="service.label"
      :port="service.port ?? null"
      :pid="String(service.conflictingPid)"
      @close="showConflictModal = false"
      @nuke="killConflicting"
    />
  </div>
</template>

<style scoped>
.animate-in {
  animation: slideIn 0.3s ease-out;
}
@keyframes slideIn {
  from { opacity: 0; transform: translateX(-10px); }
  to { opacity: 1; transform: translateX(0); }
}
</style>
