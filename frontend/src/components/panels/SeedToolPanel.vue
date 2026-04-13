<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useToast } from '../../composables/useToast'
import { Database, Play, RotateCcw, AlertTriangle, CheckCircle, XCircle, Loader2, List, Settings, Save } from 'lucide-vue-next'
import ConfirmModal from '../common/ConfirmModal.vue'

const { showToast } = useToast()

interface SeedFile {
  file: string
  collection: string
  count: number
}

interface ConnectionStatus {
  connected: boolean
  uri: string
  dbName?: string
  error?: string
}

interface MongoConfig {
  host: string
  port: number
  user: string
  password: string
  dbName: string
  authSource: string
}

interface SeedConfig {
  mongo: MongoConfig
  seedTestingPassword: string
  bcryptRounds: number
}

const connectionStatus = ref<ConnectionStatus>({ connected: false, uri: '' })
const seedFiles = ref<SeedFile[]>([])
const isExecuting = ref(false)
const isDeleting = ref(false)
const executionResults = ref<any[]>([])
const showResults = ref(false)
const selectedCollections = ref<string[]>([])
const deleteBeforeSeed = ref(true)
const showConfig = ref(false)
const showDropConfirm = ref(false)
const seedConfig = ref<SeedConfig>({
  mongo: {
    host: 'localhost',
    port: 27017,
    user: 'admin',
    password: 'admin',
    dbName: 'inmobiliaria_db',
    authSource: 'admin'
  },
  seedTestingPassword: 'password',
  bcryptRounds: 12
})
const isSavingConfig = ref(false)

const builtUri = computed(() => {
  const m = seedConfig.value.mongo
  return `mongodb://${m.user}:${m.password}@${m.host}:${m.port}/${m.dbName}?authSource=${m.authSource}`
})

const allSelected = computed(() => {
  return seedFiles.value.length > 0 && seedFiles.value.every(s => selectedCollections.value.includes(s.collection))
})

const totalSeedCount = computed(() => seedFiles.value.reduce((sum, s) => sum + s.count, 0))

const dropDbMessage = computed(() => {
  const dbName = seedConfig.value.mongo.dbName || 'inmobiliaria_db'
  return `This will drop the entire database "${dbName}".\nAll collections and documents will be permanently lost.`
})

const checkConnection = async () => {
  try {
    const res = await fetch('/api/seeds/connection')
    const data = await res.json()
    connectionStatus.value = data
    if (data.connected) {
      showToast('MongoDB connected', 'success')
    } else {
      showToast('MongoDB disconnected: ' + (data.error || 'Unknown error'), 'error')
    }
  } catch (e: any) {
    connectionStatus.value = { connected: false, uri: '', error: e.message }
    showToast('Failed to check MongoDB connection', 'error')
  }
}

const loadSeeds = async () => {
  try {
    const res = await fetch('/api/seeds/list')
    const data = await res.json()
    if (data.ok) {
      seedFiles.value = data.seeds
      // Select all by default on first load
      if (selectedCollections.value.length === 0) {
        selectedCollections.value = data.seeds.map((s: SeedFile) => s.collection)
      }
    }
  } catch (e: any) {
    showToast('Failed to load seed files', 'error')
  }
}

const loadConfig = async () => {
  try {
    const res = await fetch('/api/seeds/config')
    const data = await res.json()
    // Parse the URI to extract parts
    const uri = data.mongoUri || 'mongodb://admin:admin@localhost:27017/inmobiliaria_db?authSource=admin'
    const parsed = parseMongoUri(uri)
    seedConfig.value = {
      mongo: {
        host: parsed.host,
        port: parsed.port,
        user: parsed.user,
        password: parsed.password,
        dbName: data.mongoDbName || parsed.dbName || 'inmobiliaria_db',
        authSource: parsed.authSource
      },
      seedTestingPassword: data.seedTestingPassword || 'password',
      bcryptRounds: data.bcryptRounds || 12
    }
  } catch (e: any) {
    showToast('Failed to load seed config', 'error')
  }
}

const saveConfig = async () => {
  isSavingConfig.value = true
  try {
    const res = await fetch('/api/seeds/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mongoUri: builtUri.value,
        mongoDbName: seedConfig.value.mongo.dbName,
        seedTestingPassword: seedConfig.value.seedTestingPassword,
        bcryptRounds: seedConfig.value.bcryptRounds
      })
    })
    const data = await res.json()
    if (data.ok) {
      showToast('Seed config saved', 'success')
      showConfig.value = false
    } else {
      showToast('Failed to save config', 'error')
    }
  } catch (e: any) {
    showToast('Save error: ' + e.message, 'error')
  } finally {
    isSavingConfig.value = false
  }
}

const executeSeed = async () => {
  if (isExecuting.value) return

  isExecuting.value = true
  executionResults.value = []
  showResults.value = false

  try {
    const res = await fetch('/api/seeds/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nuke: deleteBeforeSeed.value,
        collections: selectedCollections.value.length > 0 ? selectedCollections.value : null
      })
    })
    const data = await res.json()

    if (data.ok) {
      executionResults.value = data.results || []
      showResults.value = true
      showToast('Seed executed successfully!', 'success')
    } else {
      executionResults.value = data.results || []
      showResults.value = true
      showToast('Seed execution failed: ' + (data.error || 'Unknown error'), 'error')
    }
  } catch (e: any) {
    showToast('Seed execution error: ' + e.message, 'error')
  } finally {
    isExecuting.value = false
  }
}

const confirmDeleteCollections = async () => {
  showDropConfirm.value = false

  if (isDeleting.value) return

  isDeleting.value = true
  executionResults.value = []
  showResults.value = false

  try {
    const res = await fetch('/api/seeds/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    })
    const data = await res.json()

    if (data.ok) {
      executionResults.value = data.results || []
      showResults.value = true
      showToast('Database dropped successfully', 'success')
    } else {
      executionResults.value = data.results || []
      showResults.value = true
      showToast('Drop failed: ' + (data.error || 'Unknown error'), 'error')
    }
  } catch (e: any) {
    showToast('Drop error: ' + e.message, 'error')
  } finally {
    isDeleting.value = false
  }
}

const toggleCollection = (col: string) => {
  const idx = selectedCollections.value.indexOf(col)
  if (idx === -1) {
    selectedCollections.value.push(col)
  } else {
    selectedCollections.value.splice(idx, 1)
  }
}

const toggleSelectAll = () => {
  if (allSelected.value) {
    selectedCollections.value = []
  } else {
    selectedCollections.value = seedFiles.value.map(s => s.collection)
  }
}

function parseMongoUri(uri: string) {
  const defaults = { host: 'localhost', port: 27017, user: 'admin', password: 'admin', dbName: 'inmobiliaria_db', authSource: 'admin' }
  try {
    const withoutProtocol = uri.replace('mongodb://', '')
    const [credsAndHost, queryString] = withoutProtocol.split('?')
    const parts = queryString ? Object.fromEntries(queryString.split('&').map(p => p.split('='))) : {}

    const [creds, hostPart] = credsAndHost.split('@')
    const [user, password] = creds.split(':')

    const [host, dbName] = hostPart ? hostPart.split('/') : ['', '']

    return {
      user: user || defaults.user,
      password: password || defaults.password,
      host: host?.split(':')[0] || defaults.host,
      port: parseInt(host?.split(':')[1]) || defaults.port,
      dbName: dbName || defaults.dbName,
      authSource: (parts as any).authSource || defaults.authSource
    }
  } catch {
    return defaults
  }
}

onMounted(() => {
  loadConfig()
  loadSeeds()
})
</script>

<template>
  <div class="flex-1 flex flex-col h-full bg-white dark:bg-gray-900">
    <!-- Toolbar -->
    <div class="px-5 py-3 border-b border-gray-200 dark:border-gray-700 flex gap-2 items-center shrink-0">
      <button
        @click="checkConnection"
        type="button"
        class="focus:outline-none text-white bg-blue-700 hover:bg-blue-800 focus:ring-4 focus:ring-blue-300 font-medium rounded-lg text-xs px-4 py-2 dark:bg-blue-600 dark:hover:bg-blue-700 dark:focus:ring-blue-800 transition-colors flex items-center gap-1.5"
      >
        <Database :size="14" />
        Test Connection
      </button>

      <button
        @click="showConfig = true"
        type="button"
        class="focus:outline-none text-gray-900 bg-white border border-gray-300 focus:ring-4 focus:ring-gray-100 font-medium rounded-lg text-xs px-3 py-2 hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-600 dark:hover:text-white dark:hover:bg-gray-700 transition-colors flex items-center gap-1.5"
        title="Configure MongoDB connection"
      >
        <Settings :size="14" />
        Config
      </button>

      <div class="h-6 w-px bg-gray-300 dark:bg-gray-700 mx-2"></div>

      <label class="inline-flex items-center cursor-pointer">
        <input type="checkbox" v-model="deleteBeforeSeed" class="sr-only peer">
        <div class="relative w-7 h-4 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
        <span class="ms-2 text-[11px] font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">Drop DB before seed</span>
      </label>

      <div class="flex-1"></div>

      <!-- Connection Status -->
      <div class="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm">
        <div
          :class="['w-2.5 h-2.5 rounded-full', connectionStatus.connected ? 'bg-green-500 animate-pulse' : 'bg-red-500']"
        ></div>
        <span class="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase">
          {{ connectionStatus.connected ? 'Connected' : 'Disconnected' }}
        </span>
      </div>
    </div>

    <!-- Main Content -->
    <div class="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-4">
      <!-- Seed Files List -->
      <div class="bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
        <div class="px-4 py-2 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <div class="flex items-center gap-2">
            <List :size="14" class="text-gray-500" />
            <span class="text-[10px] font-bold tracking-widest text-gray-500 dark:text-gray-400 uppercase">
              Seed Files ({{ seedFiles.length }} domains, {{ totalSeedCount }} records)
            </span>
          </div>
          <button
            @click="toggleSelectAll"
            :class="[
              'text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded transition-colors',
              allSelected
                ? 'text-blue-700 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            ]"
          >
            {{ allSelected ? 'Deselect All' : 'Select All' }}
          </button>
        </div>
        <div class="divide-y divide-gray-200 dark:divide-gray-700">
          <div
            v-for="seed in seedFiles"
            :key="seed.collection"
            class="px-4 py-3 flex items-center justify-between hover:bg-gray-100 dark:hover:bg-gray-800/80 transition-colors"
          >
            <label class="flex items-center gap-3 cursor-pointer flex-1">
              <input
                type="checkbox"
                :checked="selectedCollections.includes(seed.collection)"
                @change="toggleCollection(seed.collection)"
                class="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600 cursor-pointer"
              />
              <div>
                <div class="text-sm font-medium text-gray-900 dark:text-gray-100 font-mono">
                  {{ seed.file }}
                </div>
                <div class="text-[10px] text-gray-500 dark:text-gray-400 font-mono">
                  {{ seed.collection }}
                </div>
              </div>
            </label>
            <div class="px-2.5 py-1 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-[10px] font-bold font-mono">
              {{ seed.count }} docs
            </div>
          </div>
          <div v-if="seedFiles.length === 0" class="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
            No seed files found in backend/src/seeds/data/
          </div>
        </div>
      </div>

      <!-- Action Buttons -->
      <div class="flex gap-2">
        <button
          @click="executeSeed"
          :disabled="isExecuting || seedFiles.length === 0"
          type="button"
          :class="[
            'focus:outline-none font-medium rounded-lg text-xs px-5 py-2.5 transition-colors flex items-center gap-2',
            isExecuting || seedFiles.length === 0
              ? 'bg-gray-300 dark:bg-gray-700 text-gray-500 cursor-not-allowed'
              : 'text-white bg-green-700 hover:bg-green-800 focus:ring-4 focus:ring-green-300 dark:bg-green-600 dark:hover:bg-green-700 dark:focus:ring-green-800'
          ]"
        >
          <Loader2 v-if="isExecuting" :size="14" class="animate-spin" />
          <Play v-else :size="14" />
          {{ isExecuting ? 'Executing...' : 'Execute Seed' }}
        </button>

        <button
          @click="showDropConfirm = true"
          :disabled="isDeleting"
          type="button"
          :class="[
            'focus:outline-none font-medium rounded-lg text-xs px-5 py-2.5 transition-colors flex items-center gap-2',
            isDeleting
              ? 'bg-gray-300 dark:bg-gray-700 text-gray-500 cursor-not-allowed'
              : 'text-white bg-amber-500 hover:bg-amber-600 focus:ring-4 focus:ring-amber-300 dark:focus:ring-amber-900'
          ]"
        >
          <AlertTriangle v-if="!isDeleting" :size="14" />
          <Loader2 v-else :size="14" class="animate-spin" />
          {{ isDeleting ? 'Dropping DB...' : 'Drop Database' }}
        </button>

        <button
          @click="loadSeeds"
          type="button"
          class="focus:outline-none text-gray-900 bg-white border border-gray-300 focus:ring-4 focus:ring-gray-100 font-medium rounded-lg text-xs px-4 py-2.5 hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-600 dark:hover:text-white dark:hover:bg-gray-700 transition-colors flex items-center gap-1.5"
        >
          <RotateCcw :size="14" />
          Refresh
        </button>
      </div>

      <!-- Execution Results -->
      <div v-if="showResults" class="bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
        <div class="px-4 py-2 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2">
          <CheckCircle v-if="executionResults.some(r => r.phase === 'summary')" :size="14" class="text-green-500" />
          <XCircle v-else :size="14" class="text-red-500" />
          <span class="text-[10px] font-bold tracking-widest text-gray-500 dark:text-gray-400 uppercase">
            Execution Results
          </span>
        </div>
        <div class="p-4 space-y-3">
          <div v-for="(result, idx) in executionResults" :key="idx" class="space-y-1">
            <div class="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
              {{ result.phase }}
            </div>

            <!-- Drop/Index details -->
            <div v-if="result.details" class="ml-2 space-y-0.5">
              <div
                v-for="detail in result.details"
                :key="detail.collection || idx"
                class="flex items-center gap-2 text-[11px] font-mono"
              >
                <CheckCircle v-if="detail.ok" :size="12" class="text-green-500 shrink-0" />
                <XCircle v-else :size="12" class="text-red-500 shrink-0" />
                <span class="text-gray-600 dark:text-gray-400">
                  {{ detail.collection }} — {{ detail.action || 'ok' }}
                </span>
                <span v-if="detail.error" class="text-red-500 text-[10px]">({{ detail.error }})</span>
              </div>
            </div>

            <!-- Seed counts -->
            <div v-if="result.collection && result.count !== undefined" class="ml-2 text-[11px] font-mono text-gray-600 dark:text-gray-400">
              {{ result.collection }}: <span class="text-green-600 dark:text-green-400 font-bold">{{ result.count }}</span> upserted
            </div>

            <!-- Summary -->
            <div v-if="result.counts" class="ml-2 grid grid-cols-2 gap-x-4 gap-y-1">
              <div
                v-for="(count, col) in result.counts"
                :key="col"
                class="flex items-center justify-between text-[11px] font-mono"
              >
                <span class="text-gray-600 dark:text-gray-400">{{ col }}</span>
                <span class="text-green-600 dark:text-green-400 font-bold ml-2">{{ count }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Config Modal Overlay -->
    <div v-if="showConfig" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" @click.self="showConfig = false">
      <div class="bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 w-full max-w-lg mx-4">
        <!-- Header -->
        <div class="px-5 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <div class="flex items-center gap-2">
            <Settings :size="16" class="text-blue-600 dark:text-blue-400" />
            <h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100">MongoDB Config</h3>
          </div>
          <button @click="showConfig = false" class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-lg leading-none">&times;</button>
        </div>

        <!-- Body -->
        <div class="p-5 space-y-4">
          <!-- Connection Section -->
          <div class="space-y-3">
            <h4 class="text-[10px] font-bold tracking-widest text-gray-500 dark:text-gray-400 uppercase border-b border-gray-200 dark:border-gray-700 pb-1">
              Connection
            </h4>

            <div class="grid grid-cols-3 gap-3">
              <div class="col-span-2">
                <label class="block text-[11px] font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-1.5">Host</label>
                <input
                  v-model="seedConfig.mongo.host"
                  type="text"
                  placeholder="localhost"
                  class="w-full px-3 py-2 text-sm font-mono bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:text-gray-100 outline-none"
                />
              </div>
              <div>
                <label class="block text-[11px] font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-1.5">Port</label>
                <input
                  v-model.number="seedConfig.mongo.port"
                  type="number"
                  min="1"
                  max="65535"
                  class="w-full px-3 py-2 text-sm font-mono bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:text-gray-100 outline-none"
                />
              </div>
            </div>

            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-[11px] font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-1.5">User</label>
                <input
                  v-model="seedConfig.mongo.user"
                  type="text"
                  placeholder="admin"
                  class="w-full px-3 py-2 text-sm font-mono bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:text-gray-100 outline-none"
                />
              </div>
              <div>
                <label class="block text-[11px] font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-1.5">Password</label>
                <input
                  v-model="seedConfig.mongo.password"
                  type="password"
                  placeholder="admin"
                  class="w-full px-3 py-2 text-sm font-mono bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:text-gray-100 outline-none"
                />
              </div>
            </div>

            <div>
              <label class="block text-[11px] font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-1.5">Database Name</label>
              <input
                v-model="seedConfig.mongo.dbName"
                type="text"
                placeholder="inmobiliaria_db"
                class="w-full px-3 py-2 text-sm font-mono bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:text-gray-100 outline-none"
              />
            </div>
          </div>

          <!-- Seed Section -->
          <div class="space-y-3">
            <h4 class="text-[10px] font-bold tracking-widest text-gray-500 dark:text-gray-400 uppercase border-b border-gray-200 dark:border-gray-700 pb-1">
              Seed Data
            </h4>

            <div>
              <label class="block text-[11px] font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-1.5">Seed Users Password</label>
              <input
                v-model="seedConfig.seedTestingPassword"
                type="password"
                placeholder="password"
                class="w-full px-3 py-2 text-sm font-mono bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:text-gray-100 outline-none"
              />
              <p class="mt-1 text-[10px] text-gray-400">Password hashed with bcrypt for all seeded users</p>
            </div>

            <div>
              <label class="block text-[11px] font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-1.5">Bcrypt Rounds</label>
              <input
                v-model.number="seedConfig.bcryptRounds"
                type="number"
                min="4"
                max="20"
                class="w-24 px-3 py-2 text-sm font-mono bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:text-gray-100 outline-none"
              />
              <p class="mt-1 text-[10px] text-gray-400">Higher = more secure but slower (default: 12)</p>
            </div>
          </div>

          <!-- URI Preview -->
          <div class="bg-gray-100 dark:bg-gray-900 rounded-lg p-3">
            <label class="block text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">URI Preview</label>
            <div class="text-[11px] font-mono text-gray-600 dark:text-gray-400 break-all select-all">{{ builtUri }}</div>
          </div>
        </div>

        <!-- Footer -->
        <div class="px-5 py-3 border-t border-gray-200 dark:border-gray-700 flex items-center justify-end gap-2">
          <button
            @click="showConfig = false"
            class="focus:outline-none text-gray-900 bg-white border border-gray-300 focus:ring-4 focus:ring-gray-100 font-medium rounded-lg text-xs px-4 py-2 hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-600 dark:hover:text-white dark:hover:bg-gray-700 transition-colors"
          >
            Cancel
          </button>
          <button
            @click="saveConfig"
            :disabled="isSavingConfig"
            class="focus:outline-none text-white bg-blue-700 hover:bg-blue-800 focus:ring-4 focus:ring-blue-300 font-medium rounded-lg text-xs px-4 py-2 dark:bg-blue-600 dark:hover:bg-blue-700 dark:focus:ring-blue-800 transition-colors flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save :size="14" />
            {{ isSavingConfig ? 'Saving...' : 'Save Config' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Drop Database Confirmation -->
    <ConfirmModal
      :show="showDropConfirm"
      title="Drop Database"
      :message="dropDbMessage"
      confirm-text="Drop Database"
      cancel-text="Cancel"
      variant="danger"
      :auto-focus-confirm="true"
      @confirm="confirmDeleteCollections"
      @cancel="showDropConfirm = false"
    />
  </div>
</template>
