<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useToast } from '../../composables/useToast'
import {
  Play, Square, RotateCcw, Trash2, ScrollText, Copy,
  AlertTriangle, ExternalLink, Container, ShieldAlert, HardDrive, Settings, X
} from 'lucide-vue-next'
import ConfirmModal from '../common/ConfirmModal.vue'
import DockerConfigModal from './DockerConfigModal.vue'
import { FocusTrap } from 'focus-trap-vue'

const { showToast } = useToast()

interface DockerService {
  id: string
  label: string
  name: string
  image: string
  ports: { host: number; container: number }[]
  volumes: string[]
  env: string[]
  description: string
  webUrl: string | null
  savedConfig: any
}

interface ServiceStatus {
  ok: boolean
  running: boolean
  id?: string
  status?: string
  name: string
}

interface ConfigPayload {
  ports: number[]
  env: string[]
  volumes: string[]
}

const dockerAvailable = ref(false)
const services = ref<DockerService[]>([])
const statuses = ref<Record<string, ServiceStatus>>({})
const configs = ref<Record<string, ConfigPayload>>({})
const savedConfigs = ref<Record<string, ConfigPayload>>({})
const commands = ref<Record<string, string>>({})
const logs = ref<Record<string, string>>({})

const showLogsFor = ref<string | null>(null)
const showConfig = ref<string | null>(null)
const showRemoveConfirm = ref<string | null>(null)
const showCleanConflicts = ref<string | null>(null)

const isStarting = ref<Record<string, boolean>>({})
const isStopping = ref<Record<string, boolean>>({})
const isSaving = ref<Record<string, boolean>>({})
const errors = ref<Record<string, string>>({})
const dirtyConfig = ref<Record<string, ConfigPayload>>({})
const isChecking = ref(false)

const checkConnection = async () => {
  isChecking.value = true
  await loadAll()
  if (dockerAvailable.value) {
    showToast('Docker connection established!', 'success')
  } else {
    showToast('Docker still not found', 'error')
  }
  isChecking.value = false
}

const loadAll = async () => {
  try {
    const healthRes = await fetch('/api/docker/health')
    const health = await healthRes.json()
    dockerAvailable.value = health.available

    if (!health.available) {
      errors.value = { _global: 'Docker is not installed or not in PATH' }
      return
    }

    const svcRes = await fetch('/api/docker/services')
    const data = await svcRes.json()
    services.value = data.services

    for (const svc of data.services) {
      await refreshStatus(svc.id)
      await loadConfig(svc.id)
    }
  } catch (e: any) {
    errors.value = { _global: e.message }
    showToast('Failed to load Docker services', 'error')
  }
}

const loadConfig = async (id: string) => {
  try {
    const res = await fetch(`/api/docker/config/${id}`)
    const data = await res.json()
    if (data.ok) {
      configs.value[id] = { ...data.merged }
      savedConfigs.value[id] = {
        ports: data.saved.ports || data.defaults.ports,
        env: data.saved.env || data.defaults.env,
        volumes: data.saved.volumes || data.defaults.volumes
      }
      commands.value[id] = data.command
      dirtyConfig.value[id] = { ...data.merged }
    }
  } catch {
    // silent
  }
}

const refreshStatus = async (id: string) => {
  try {
    const res = await fetch(`/api/docker/status/${id}`)
    const data = await res.json()
    statuses.value[id] = data
    if (data.ok && !data.running) delete errors.value[id]
  } catch {
    // silent
  }
}

const saveConfig = async (id: string) => {
  isSaving.value[id] = true
  delete errors.value[id]
  try {
    const cfg = dirtyConfig.value[id] || configs.value[id]
    const svc = services.value.find(s => s.id === id)
    const res = await fetch(`/api/docker/config/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ports: cfg.ports.map((p: number, i: number) => ({
          host: p,
          container: svc?.ports[i]?.container || p
        })),
        env: cfg.env,
        volumes: cfg.volumes
      })
    })
    const data = await res.json()
    if (data.ok) {
      showToast('Config saved', 'success')
      configs.value[id] = { ...cfg }
      savedConfigs.value[id] = { ...cfg }
      commands.value[id] = data.command
      delete dirtyConfig.value[id]
    } else {
      showToast('Save failed', 'error')
    }
  } catch (e: any) {
    showToast('Save error', 'error')
  } finally {
    isSaving.value[id] = false
  }
}

const isDirty = (id: string) => {
  const saved = savedConfigs.value[id]
  const current = dirtyConfig.value[id] || configs.value[id]
  if (!saved || !current) return false
  return JSON.stringify(saved.ports) !== JSON.stringify(current.ports) ||
    JSON.stringify(saved.env) !== JSON.stringify(current.env) ||
    JSON.stringify(saved.volumes) !== JSON.stringify(current.volumes)
}

const handleModalSave = (payload: { id: string, config: ConfigPayload }) => {
  dirtyConfig.value[payload.id] = payload.config
  saveConfig(payload.id)
}

const startService = async (id: string) => {
  isStarting.value[id] = true
  delete errors.value[id]
  try {
    const res = await fetch(`/api/docker/start/${id}`, { method: 'POST' })
    const data = await res.json()
    if (data.ok) {
      showToast(`${data.name} started`, 'success')
      await refreshStatus(id)
    } else if (data.error === 'Port conflicts') {
      errors.value[id] = `Port conflict: ${data.conflicts?.map((c: any) => c.port).join(', ')}`
      showToast('Port conflict detected', 'error')
    } else {
      errors.value[id] = data.error
      showToast(`Failed: ${data.error}`, 'error')
    }
  } catch (e: any) {
    errors.value[id] = e.message
    showToast('Start error', 'error')
  } finally {
    isStarting.value[id] = false
  }
}

const stopService = async (id: string) => {
  isStopping.value[id] = true
  try {
    const res = await fetch(`/api/docker/stop/${id}`, { method: 'POST' })
    const data = await res.json()
    if (data.ok) {
      showToast(`${data.name} stopped`, 'success')
      await refreshStatus(id)
    } else {
      showToast(`Failed: ${data.error}`, 'error')
    }
  } catch (e: any) {
    showToast('Stop error', 'error')
  } finally {
    isStopping.value[id] = false
  }
}

const restartService = async (id: string) => {
  isStopping.value[id] = true
  try {
    const res = await fetch(`/api/docker/restart/${id}`, { method: 'POST' })
    const data = await res.json()
    if (data.ok) {
      showToast(`${data.name} restarted`, 'success')
      await refreshStatus(id)
    } else {
      showToast(`Failed: ${data.error}`, 'error')
    }
  } catch (e: any) {
    showToast('Restart error', 'error')
  } finally {
    isStopping.value[id] = false
  }
}

const createService = async (id: string) => {
  isStarting.value[id] = true
  delete errors.value[id]
  try {
    const res = await fetch(`/api/docker/create/${id}`, { method: 'POST' })
    const data = await res.json()
    if (data.ok) {
      showToast(`${data.name} created`, 'success')
      await refreshStatus(id)
    } else {
      errors.value[id] = data.error
      showToast(`Failed: ${data.error}`, 'error')
    }
  } catch (e: any) {
    errors.value[id] = e.message
    showToast('Create error', 'error')
  } finally {
    isStarting.value[id] = false
  }
}

const confirmRemove = (id: string) => { showRemoveConfirm.value = id }
const confirmCleanConflicts = (id: string) => { showCleanConflicts.value = id }

const executeRemove = async (id: string) => {
  showRemoveConfirm.value = null
  try {
    const res = await fetch(`/api/docker/remove/${id}`, { method: 'POST' })
    const data = await res.json()
    if (data.ok) {
      showToast('Container removed', 'success')
      await refreshStatus(id)
    } else {
      showToast(`Failed: ${data.error}`, 'error')
    }
  } catch (e: any) {
    showToast('Remove error', 'error')
  }
}


const executeCleanConflicts = async (id: string) => {
  showCleanConflicts.value = null
  try {
    const res = await fetch(`/api/docker/clean-conflicts/${id}`, { method: 'POST' })
    const data = await res.json()
    if (data.ok) showToast('Conflicting containers cleaned', 'success')
    else showToast(`Failed: ${data.error}`, 'error')
  } catch (e: any) {
    showToast('Clean error', 'error')
  }
}

const viewLogs = async (id: string) => {
  try {
    const res = await fetch(`/api/docker/logs/${id}?tail=200`)
    const data = await res.json()
    if (data.ok) {
      logs.value[id] = data.logs
      showLogsFor.value = id
    } else {
      showToast(`Failed: ${data.error}`, 'error')
    }
  } catch (e: any) {
    showToast('Logs error', 'error')
  }
}

const copyLogs = () => {
  const key = showLogsFor.value
  if (key) navigator.clipboard.writeText(logs.value[key] || '')
  showToast('Logs copied!', 'success')
}

const clearLogs = () => {
  const key = showLogsFor.value
  if (key) logs.value[key] = ''
}

const getServiceName = (id: string) => {
  return services.value.find(s => s.id === id)?.name || id
}

const getStatusText = (status: ServiceStatus) => {
  if (!status.ok) return 'Error'
  return status.running ? 'Running' : 'Stopped'
}

const getStatusColor = (status: ServiceStatus) => {
  if (!status.ok) return 'text-red-500'
  return status.running ? 'text-green-500' : 'text-gray-400'
}

const getContainerExists = (id: string) => {
  const s = statuses.value[id]
  return s?.ok && s?.id !== undefined
}

onMounted(() => loadAll())
</script>

<template>
  <div class="flex-1 flex flex-col h-full bg-white dark:bg-gray-900">
    <!-- Toolbar -->
    <div class="px-5 py-3 border-b border-gray-200 dark:border-gray-700 flex gap-2 items-center shrink-0">
      <button @click="loadAll" class="focus:outline-none text-white bg-blue-700 hover:bg-blue-800 focus:ring-4 focus:ring-blue-300 font-medium rounded-lg text-xs px-4 py-2 dark:bg-blue-600 dark:hover:bg-blue-700 dark:focus:ring-blue-800 transition-colors flex items-center gap-1.5">
        <Container :size="14" /> Refresh
      </button>
      <div class="h-6 w-px bg-gray-300 dark:bg-gray-700 mx-2"></div>
      <div class="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm">
        <div :class="['w-2.5 h-2.5 rounded-full', dockerAvailable ? 'bg-green-500 animate-pulse' : 'bg-red-500']"></div>
        <span class="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase">
          {{ dockerAvailable ? 'Docker Available' : 'Docker Not Found' }}
        </span>
      </div>
      <div v-if="errors._global" class="ml-2 text-[11px] text-red-500 font-mono">{{ errors._global }}</div>
    </div>

    <!-- Not available -->
    <div v-if="!dockerAvailable" class="flex-1 flex items-center justify-center p-6 bg-gray-50 dark:bg-gray-900/50">
      <div class="max-w-md w-full p-8 text-center bg-white dark:bg-gray-800 rounded-3xl shadow-xl border border-gray-200 dark:border-gray-700">
        <div class="w-20 h-20 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-6">
          <AlertTriangle :size="40" class="text-red-500" />
        </div>
        <h3 class="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">Docker Not Available</h3>
        <p class="text-sm text-gray-500 dark:text-gray-400 mb-8 leading-relaxed">
          The Docker engine could not be reached. Please ensure Docker Desktop is installed and running on your system.
        </p>
        
        <div class="flex flex-col gap-3">
          <button 
            @click="checkConnection" 
            :disabled="isChecking"
            class="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-xl font-bold transition-all shadow-lg shadow-blue-500/25 flex items-center justify-center gap-2"
          >
            <RotateCcw :size="16" :class="{'animate-spin': isChecking}" />
            {{ isChecking ? 'Checking...' : 'Test Connection' }}
          </button>
          
          <a 
            href="https://www.docker.com/products/docker-desktop" 
            target="_blank"
            class="w-full py-3 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-xl font-bold transition-all flex items-center justify-center gap-2"
          >
            <ExternalLink :size="16" />
            Download Docker Desktop
          </a>
        </div>
        
        <p class="mt-6 text-[10px] text-gray-400 uppercase tracking-widest font-bold">
          System PATH requirement
        </p>
      </div>
    </div>

    <!-- Scrollable cards -->
    <div v-else class="flex-1 overflow-y-auto px-5 py-6">
      <div class="flex flex-col gap-4">
        <div v-for="svc in services" :key="svc.id" :class="['relative shrink-0 flex flex-col border rounded-2xl transition-all duration-300 shadow-sm overflow-hidden bg-white dark:bg-gray-800', statuses[svc.id]?.running ? 'border-green-500/30' : 'border-gray-200 dark:border-gray-700']">
          <!-- Color Accent (Status based) -->
          <div :class="['h-1 w-full', statuses[svc.id]?.running ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600']"></div>

          <div class="flex items-center gap-0 min-h-[100px]">
            <!-- 1. IDENTITY COLUMN -->
            <div class="w-64 shrink-0 px-6 flex flex-col justify-center border-r border-gray-100 dark:border-gray-700/50 self-stretch py-4">
              <div class="flex items-center gap-2 mb-1.5">
                <div :class="['w-2.5 h-2.5 rounded-full', statuses[svc.id]?.running ? 'bg-green-500 animate-pulse' : 'bg-gray-300']"></div>
                <span class="text-base font-black uppercase tracking-tight text-gray-900 dark:text-white truncate">
                  {{ svc.label }}
                </span>
              </div>
              <div class="flex items-center gap-2">
                <span class="px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 tracking-wider">
                  {{ svc.name }}
                </span>
                <div v-if="svc.ports.length" class="flex items-center gap-1 px-1.5 py-0.5 bg-blue-50 dark:bg-blue-900/20 border border-blue-200/50 rounded text-[10px] font-mono font-bold text-blue-600">
                  :{{ dirtyConfig[svc.id]?.ports?.[0] ?? svc.ports[0].host }}
                </div>
              </div>
            </div>

            <!-- 2. INFO COLUMN -->
            <div class="flex-1 px-8 flex flex-col justify-center gap-2 border-r border-gray-100 dark:border-gray-700/50 self-stretch py-4">
              <p class="text-xs text-gray-600 dark:text-gray-400 max-w-lg">{{ svc.description }}</p>
              <div class="flex flex-wrap gap-1.5">
                <span v-for="(p, pi) in svc.ports" :key="p.container" class="px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-[10px] font-mono text-gray-500 dark:text-gray-400">
                  :{{ dirtyConfig[svc.id]?.ports?.[pi] ?? p.host }} → :{{ p.container }}
                </span>
              </div>
              <div v-if="errors[svc.id]" class="flex items-center gap-2 text-[10px] text-red-500 font-mono bg-red-50 dark:bg-red-900/10 p-1.5 rounded border border-red-100 dark:border-red-900/20">
                <AlertTriangle :size="10" />
                {{ errors[svc.id] }}
              </div>
            </div>

            <!-- 3. ACTIONS COLUMN -->
            <div class="w-72 shrink-0 px-6 flex flex-col justify-center gap-3 py-4">
              <div class="flex items-center justify-between mb-1">
                 <span :class="['text-[10px] font-black tracking-[0.2em] uppercase', getStatusColor(statuses[svc.id] || { ok: false, running: false, name: svc.name })]">
                  {{ getStatusText(statuses[svc.id] || { ok: false, running: false, name: svc.name }) }}
                </span>
                <div class="flex gap-1.5">
                  <button @click="showConfig = svc.id" :aria-label="`Configure ${svc.label}`" :class="['p-1.5 rounded-lg transition-all border', isDirty(svc.id) ? 'bg-amber-50 text-amber-600 border-amber-200' : 'text-gray-400 hover:text-blue-500 hover:bg-blue-50 border-transparent hover:border-blue-100']" title="Config">
                    <Settings :size="16" />
                  </button>
                  <button v-if="getContainerExists(svc.id)" @click="viewLogs(svc.id)" :aria-label="`View logs for ${svc.label}`" class="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-all border border-transparent hover:border-blue-100" title="Logs">
                    <ScrollText :size="16" />
                  </button>
                  <a v-if="svc.webUrl" :href="svc.webUrl" target="_blank" :aria-label="`Open web UI for ${svc.label}`" class="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg transition-all border border-transparent hover:border-blue-100" title="Open Web UI">
                    <ExternalLink :size="16" />
                  </a>
                </div>
              </div>

              <div class="flex items-center gap-2">
                <button v-if="!getContainerExists(svc.id)" @click="createService(svc.id)" :disabled="isStarting[svc.id]" :aria-label="`Create ${svc.label} container`" class="flex-1 px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-white bg-green-600 rounded-lg hover:bg-green-700 shadow-md shadow-green-500/20 transition-all flex items-center justify-center gap-1.5">
                  <Play :size="14" /> {{ isStarting[svc.id] ? '...' : 'Create' }}
                </button>
                <button v-else-if="!statuses[svc.id]?.running" @click="startService(svc.id)" :disabled="isStarting[svc.id]" :aria-label="`Start ${svc.label} container`" class="flex-1 px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-white bg-green-600 rounded-lg hover:bg-green-700 shadow-md shadow-green-500/20 transition-all flex items-center justify-center gap-1.5">
                  <Play :size="14" /> {{ isStarting[svc.id] ? '...' : 'Start' }}
                </button>
                <button v-if="statuses[svc.id]?.running" @click="stopService(svc.id)" :disabled="isStopping[svc.id]" :aria-label="`Stop ${svc.label} container`" class="flex-1 px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-white bg-red-600 rounded-lg hover:bg-red-700 shadow-md shadow-red-500/20 transition-all flex items-center justify-center gap-1.5">
                  <Square :size="14" /> {{ isStopping[svc.id] ? '...' : 'Stop' }}
                </button>
                
                <div class="flex gap-1.5">
                  <button v-if="getContainerExists(svc.id)" @click="restartService(svc.id)" :disabled="isStopping[svc.id]" :aria-label="`Restart ${svc.label} container`" class="p-2 text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-all" title="Restart">
                    <RotateCcw :size="14" />
                  </button>
                  <button v-if="getContainerExists(svc.id)" @click="confirmRemove(svc.id)" :aria-label="`Delete ${svc.label} container`" class="p-2 text-red-500 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 rounded-lg transition-all" title="Delete Container">
                    <Trash2 :size="14" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- Danger Alerts (Hidden when not expanded/relevant) -->
          <div v-if="getContainerExists(svc.id) && statuses[svc.id]?.ok === false" class="bg-red-50 dark:bg-red-900/10 border-t border-red-100 dark:border-red-900/20 px-6 py-2 flex items-center justify-between">
            <div class="flex items-center gap-2 text-red-700 dark:text-red-400 text-[11px] font-bold">
              <ShieldAlert :size="14" />
              <span>Container exists but has health issues.</span>
            </div>
            <button @click="confirmCleanConflicts(svc.id)" class="text-[9px] font-black text-red-500 uppercase tracking-widest hover:underline">Resolve Conflicts</button>
          </div>
        </div>
      </div>

      <div v-if="services.length === 0" class="p-12 text-center rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-800">
        <div class="mx-auto w-12 h-12 rounded-full bg-gray-50 dark:bg-gray-800 flex items-center justify-center mb-4 text-gray-400">
          <HardDrive :size="24" />
        </div>
        <h3 class="text-sm font-bold text-gray-900 dark:text-gray-100">No Services Found</h3>
        <p class="text-xs text-gray-500 dark:text-gray-400 mt-1 max-w-[200px] mx-auto">None of the recognized Docker services are configured or available.</p>
      </div>
    </div>

    <!-- Config Modal -->
    <DockerConfigModal
      :show="!!showConfig"
      :serviceId="showConfig || ''"
      :serviceLabel="showConfig ? getServiceName(showConfig) : ''"
      :initialConfig="showConfig ? (dirtyConfig[showConfig] || configs[showConfig]) : null"
      :commands="commands"
      :portSpecs="showConfig ? services.find(s => s.id === showConfig)?.ports || [] : []"
      @close="showConfig = null"
      @save="handleModalSave"
    />

    <!-- Logs Modal -->
    <Teleport to="body">
      <div v-if="showLogsFor" class="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" @click.self="showLogsFor = null">
        <FocusTrap :active="!!showLogsFor">
          <div 
            class="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-4xl max-h-[80vh] flex flex-col overflow-hidden border border-gray-200 dark:border-gray-700"
            role="dialog"
            aria-modal="true"
            aria-labelledby="logs-modal-title"
          >
            <!-- Header -->
            <div class="px-5 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between shrink-0">
              <div class="flex items-center gap-3">
                <div :class="['w-3 h-3 rounded-full', statuses[showLogsFor]?.running ? 'bg-green-500 animate-pulse' : 'bg-red-500']"></div>
                <h3 id="logs-modal-title" class="text-base font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                  <ScrollText :size="18" class="text-blue-600 dark:text-blue-400" />
                  {{ getServiceName(showLogsFor) }} Logs
                </h3>
              </div>
              <div class="flex items-center gap-2">
                <button @click="copyLogs" aria-label="Copy logs" class="text-xs font-medium text-gray-900 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5">
                  <Copy :size="14" /> Copy
                </button>
                <button @click="clearLogs" aria-label="Clear logs" class="text-xs font-medium text-gray-900 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5">
                  <Trash2 :size="14" /> Clear
                </button>
                <button @click="showLogsFor = null" aria-label="Close logs" class="text-gray-400 hover:text-gray-600 dark:hover:text-white transition-colors ml-2">
                  <X :size="20" />
                </button>
              </div>
            </div>

            <!-- Content -->
            <div class="flex-1 overflow-auto p-4 bg-gray-50 dark:bg-gray-900 font-mono text-[12px] text-gray-800 dark:text-gray-300 whitespace-pre scroll-smooth">
              <div v-if="!logs[showLogsFor]" class="text-gray-400 text-center py-10 italic">No logs available for this service.</div>
              <div v-else>{{ logs[showLogsFor] }}</div>
            </div>

            <!-- Footer -->
            <div class="px-5 py-3 border-t border-gray-200 dark:border-gray-700 flex items-center justify-end shrink-0">
              <button @click="showLogsFor = null" class="focus:outline-none text-white bg-blue-700 hover:bg-blue-800 focus:ring-4 focus:ring-blue-300 font-medium rounded-lg text-xs px-6 py-2 dark:bg-blue-600 dark:hover:bg-blue-700 dark:focus:ring-blue-800 transition-colors shadow-sm">Close</button>
            </div>
          </div>
        </FocusTrap>
      </div>
    </Teleport>

    <!-- Confirmations -->
    <ConfirmModal
      :show="!!showRemoveConfirm"
      title="Delete Container"
      :message="`Remove the container '${showRemoveConfirm ? getServiceName(showRemoveConfirm) : ''}'? Volumes and image will be preserved.`"
      confirm-text="Delete Container"
      cancel-text="Cancel"
      variant="warning"
      @confirm="showRemoveConfirm && executeRemove(showRemoveConfirm)"
      @cancel="showRemoveConfirm = null"
    />

    <ConfirmModal
      :show="!!showCleanConflicts"
      title="Clean Conflicting Containers"
      :message="`Force-remove any containers using the same name or ports as '${showCleanConflicts ? getServiceName(showCleanConflicts) : ''}'.`"
      confirm-text="Clean Conflicts"
      cancel-text="Cancel"
      variant="warning"
      @confirm="showCleanConflicts && executeCleanConflicts(showCleanConflicts)"
      @cancel="showCleanConflicts = null"
    />
  </div>
</template>
