<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import Header from './components/layout/Header.vue'
import PathsBar from './components/layout/PathsBar.vue'
import ServiceRunnerPanel from './components/panels/ServiceRunnerPanel.vue'
import ConcatToolPanel from './components/panels/ConcatToolPanel.vue'
import ToastContainer from './components/common/ToastContainer.vue'
import { useToast } from './composables/useToast'
import { logger } from './utils/logger'

export interface Service {
  id: string
  label: string
  type: string
  color: string
  running: boolean
  pid: number | null
  port: number | null
  conflictingPid: number | null
}

const activeTab = ref('runner')
const isConnected = ref(false)
const config = ref({ backendRoot: '', frontendRoot: '' })
const services = ref<Service[]>([])
let globalStream: EventSource | null = null

const { showToast } = useToast()

const fetchState = async () => {
  try {
    const res = await fetch('/api/state')
    const data = await res.json()
    config.value = data.config
    services.value = data.services
  } catch (e) {
    console.error('Failed to fetch state', e)
  }
}

const onConfigUpdated = (data: any) => {
  logger.debug('Config updated', data)
  config.value = data.config
  services.value = data.services
  showToast('Paths updated successfully', 'success')
}

const connectStream = () => {
  if (globalStream) globalStream.close()
  globalStream = new EventSource('/api/stream/global')
  globalStream.onopen = () => { 
    isConnected.value = true
    logger.debug('Global SSE connected')
  }
  globalStream.onerror = () => { 
    isConnected.value = false 
    logger.debug('Global SSE error')
  }
  
  globalStream.addEventListener('message', (e) => {
    try {
      const data = JSON.parse(e.data)
      if (data.level === 'SYSTEM' && data.msg === 'FILESYSTEM_CHANGED') {
        window.dispatchEvent(new CustomEvent('fs-changed', { detail: { auto: true } }))
        showToast('Files changed.', 'info')
      }
    } catch (err) {}
  })

  globalStream.addEventListener('status', (e) => {
    try {
      const data = JSON.parse(e.data)
      const index = services.value.findIndex((s: any) => s.id === data.serviceId)
      if (index !== -1) {
        services.value[index].running = data.running
        services.value[index].pid = data.pid
      }
    } catch (err) {}
  })
}

onMounted(() => {
  fetchState()
  connectStream()
})

onUnmounted(() => {
  if (globalStream) globalStream.close()
})
</script>

<template>
  <Header :isConnected="isConnected" />
  
  <PathsBar 
    v-if="config.backendRoot !== undefined" 
    :initialBackend="config.backendRoot" 
    :initialFrontend="config.frontendRoot"
    @updated="onConfigUpdated"
  />

  <!-- Tabs Bar -->
  <div class="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex px-5 gap-0 shrink-0">
    <button 
      @click="activeTab = 'runner'" 
      :class="['h-11 px-5 font-mono text-[12px] uppercase tracking-wider font-semibold border-b-2 transition-all duration-200 focus:outline-none', activeTab === 'runner' ? 'text-blue-600 border-blue-600 dark:text-blue-500 dark:border-blue-500' : 'text-gray-500 border-transparent hover:text-gray-600 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300']"
    >
      Service Runner
    </button>
    <button 
      @click="activeTab = 'concat'" 
      :class="['h-11 px-5 font-mono text-[12px] uppercase tracking-wider font-semibold border-b-2 transition-all duration-200 focus:outline-none', activeTab === 'concat' ? 'text-blue-600 border-blue-600 dark:text-blue-500 dark:border-blue-500' : 'text-gray-500 border-transparent hover:text-gray-600 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300']"
    >
      Concat Tool
    </button>
  </div>

  <div class="flex-1 relative overflow-hidden flex flex-col">
    <KeepAlive>
      <ServiceRunnerPanel 
        v-if="activeTab === 'runner'" 
        :services="services" 
        @refresh="fetchState" 
        class="flex-1 min-h-0"
      />
    </KeepAlive>
    <KeepAlive>
      <ConcatToolPanel 
        v-if="activeTab === 'concat'" 
        :config="config" 
        class="flex-1 min-h-0"
      />
    </KeepAlive>
  </div>

  <ToastContainer />
</template>

<style>
/* Global scrollbar and other styles */
</style>
