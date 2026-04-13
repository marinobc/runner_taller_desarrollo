<script setup lang="ts">
import { ref, watch } from 'vue'
import { X, Save } from 'lucide-vue-next'
import { FocusTrap } from 'focus-trap-vue'

const props = defineProps<{
  show: boolean
  serviceId: string
  serviceLabel: string
  initialConfig: any
  commands: Record<string, string>
  portSpecs: Array<{ host: number, container: number }>
}>()

const emit = defineEmits(['close', 'save'])

const config = ref({ 
  ports: [],
  env: [],
  volumes: []
})

watch(() => props.initialConfig, (newVal) => {
  if (newVal) {
    config.value = JSON.parse(JSON.stringify(newVal))
  }
}, { immediate: true, deep: true })

const save = () => {
  emit('save', { id: props.serviceId, config: config.value })
  emit('close')
}
</script>

<template>
  <div v-if="show" class="fixed inset-0 bg-gray-900/80 dark:bg-gray-900/80 z-[10000] flex justify-center items-center p-4 backdrop-blur-sm" @click.self="emit('close')">
    <FocusTrap :active="show">
      <div 
        class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="docker-config-modal-title"
      >
        <!-- Header -->
        <div class="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50/50 dark:bg-gray-800/50">
          <div>
            <h3 id="docker-config-modal-title" class="text-gray-900 dark:text-gray-100 font-bold text-lg">Configuration</h3>
            <p class="text-xs text-gray-500 dark:text-gray-400 font-mono">{{ serviceLabel }}</p>
          </div>
          <button @click="emit('close')" aria-label="Close configuration" class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full">
            <X :size="20" />
          </button>
        </div>

      <!-- Body -->
      <div class="flex-1 overflow-y-auto p-6 space-y-6">
        <section class="space-y-4">
          <h4 class="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1">Network Port Mapping</h4>
          <div class="space-y-3">
            <div v-for="(_, i) in config.ports" :key="i" class="flex items-center gap-4 bg-gray-50 dark:bg-gray-900/50 p-3 rounded-xl border border-gray-100 dark:border-gray-800">
              <div class="flex-1 space-y-1.5">
                <label class="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-tight">Host Port</label>
                <input 
                  type="number" 
                  v-model.number="config.ports[i]"
                  class="w-full px-3 py-2 text-sm font-mono bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-sm" 
                  placeholder="e.g. 8080"
                />
              </div>
              <div class="flex flex-col items-center justify-center pt-5">
                <span class="text-gray-300 dark:text-gray-600">→</span>
              </div>
              <div class="flex-1 space-y-1.5">
                <label class="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-tight">Container Internal</label>
                <div class="px-3 py-2 text-sm font-mono bg-gray-100 dark:bg-gray-800 border border-transparent rounded-lg text-gray-400 select-none flex items-center gap-1.5 font-bold">
                  <span class="text-xs text-gray-500">:</span>
                  {{ portSpecs?.[i]?.container ?? '?' }}
                </div>
              </div>
            </div>
          </div>
        </section>

        <!-- Environment -->
        <section class="space-y-3">
          <h4 class="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1">Environment Variables</h4>
          <div class="space-y-2">
            <div v-for="(_, i) in config.env" :key="i" class="flex items-center gap-2 group">
              <span class="text-[10px] text-gray-400 w-4 font-mono">{{ i + 1 }}.</span>
              <input 
                type="text" 
                v-model="config.env[i]"
                class="flex-1 px-3 py-2 text-sm font-mono bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all" 
                placeholder="KEY=VALUE"
              />
            </div>
          </div>
        </section>

        <!-- Command Preview -->
        <section class="space-y-3">
          <h4 class="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1">Command Preview</h4>
          <div class="bg-black dark:bg-black p-4 rounded-xl border border-gray-800">
            <code class="text-[11px] font-mono text-green-400 break-all leading-relaxed whitespace-pre-wrap">{{ commands[serviceId] || 'Generating...' }}</code>
          </div>
        </section>
      </div>

      <!-- Footer -->
      <div class="px-6 py-4 border-t border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 flex justify-end gap-3">
        <button @click="emit('close')" class="px-4 py-2 text-xs font-semibold text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors">
          Cancel
        </button>
        <button @click="save" class="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-lg shadow-blue-500/20 transition-all flex items-center gap-2">
          <Save :size="14" />
          Save Changes
        </button>
      </div>
      </div>
    </FocusTrap>
  </div>
</template>
