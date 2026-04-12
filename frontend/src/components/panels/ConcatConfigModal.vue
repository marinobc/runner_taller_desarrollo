<script setup lang="ts">
import { ref, watch } from 'vue'
import { X } from 'lucide-vue-next'

const props = defineProps<{
  show: boolean
  initialConfig: any
}>()

const emit = defineEmits(['close', 'save'])

const config = ref({ ...props.initialConfig })

watch(() => props.initialConfig, (newVal) => {
  config.value = { ...newVal }
}, { deep: true })

const save = () => {
  emit('save', config.value)
  emit('close')
}
</script>

<template>
  <div v-if="show" class="fixed inset-0 bg-gray-900/80 dark:bg-gray-900/80 z-[10000] flex justify-center items-center p-4">
    <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg w-full max-w-[800px] max-h-[85vh] flex flex-col overflow-hidden shadow-2xl">
      <!-- Header -->
      <div class="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-800">
        <h3 class="text-blue-600 dark:text-blue-400 font-bold text-lg">Concat Tool Configuration</h3>
        <button @click="emit('close')" class="text-gray-400 bg-transparent hover:bg-gray-200 hover:text-gray-900 rounded-lg text-sm w-8 h-8 ms-auto inline-flex justify-center items-center dark:hover:bg-gray-600 dark:hover:text-white transition-colors">
          <span class="sr-only">Close modal</span>
          <X class="w-3 h-3" />
        </button>
      </div>

      <!-- Body -->
      <div class="flex-1 overflow-y-auto p-5 space-y-6">
        <!-- Ignore Rules -->
        <section class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md overflow-hidden">
          <div class="px-4 py-2 bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600 text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Ignore Rules</div>
          <div class="p-4 space-y-4">
            <label class="flex items-center gap-3 cursor-pointer group">
              <input type="checkbox" v-model="config.ignoreBinaries" class="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600" />
              <span class="text-sm font-medium text-gray-900 dark:text-gray-300 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">Ignore binary files</span>
            </label>
            <label class="flex items-center gap-3 cursor-pointer group">
              <input type="checkbox" v-model="config.ignoreHiddenDirs" class="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600" />
              <span class="text-sm font-medium text-gray-900 dark:text-gray-300 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">Ignore hidden directories (starting with .)</span>
            </label>
            <label class="flex items-center gap-3 cursor-pointer group">
              <input type="checkbox" v-model="config.ignoreLockfiles" class="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600" />
              <span class="text-sm font-medium text-gray-900 dark:text-gray-300 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">Ignore lockfiles (package-lock.json, etc.)</span>
            </label>
            <label class="flex items-center gap-3 cursor-pointer group">
              <input type="checkbox" v-model="config.useGitignore" class="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600" />
              <span class="text-sm font-medium text-gray-900 dark:text-gray-300 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">Respect .gitignore rules</span>
            </label>
            <label class="flex items-center gap-3 cursor-pointer group">
              <input type="checkbox" v-model="config.minify" class="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600" />
              <span class="text-sm font-medium text-gray-900 dark:text-gray-300 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">Minify code (removes comments & extra whitespace)</span>
            </label>
          </div>
        </section>

        <!-- Excluded Directories -->
        <section class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md overflow-hidden">
          <div class="px-4 py-2 bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600 text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Excluded Directories</div>
          <div class="p-4">
            <textarea 
              v-model="config.skipDirsList"
              rows="4" 
              class="block p-2.5 w-full text-sm text-gray-900 bg-gray-50 rounded-lg border border-gray-300 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500 font-mono"
              placeholder="e.g. node_modules, target, .git"
            ></textarea>
            <p class="mt-2 text-xs text-gray-500 dark:text-gray-400 italic">One directory name per line. These will be skipped during scan.</p>
          </div>
        </section>

        <!-- Excluded Extensions -->
        <section class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md overflow-hidden">
          <div class="px-4 py-2 bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600 text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Excluded Extensions</div>
          <div class="p-4">
            <textarea 
              v-model="config.skipExtsList"
              rows="4" 
              class="block p-2.5 w-full text-sm text-gray-900 bg-gray-50 rounded-lg border border-gray-300 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500 font-mono"
              placeholder="e.g. .png, .jpg, .exe"
            ></textarea>
          </div>
        </section>

        <!-- Custom Patterns -->
        <section class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md overflow-hidden">
          <div class="px-4 py-2 bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600 text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Custom Patterns</div>
          <div class="p-4">
            <p class="mb-2 text-xs text-gray-500 dark:text-gray-400 italic">Supports glob matching (e.g., *.min.js, dist/*)</p>
            <textarea 
              v-model="config.customPatternsList"
              rows="4" 
              class="block p-2.5 w-full text-sm text-gray-900 bg-gray-50 rounded-lg border border-gray-300 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500 font-mono"
              placeholder="*.min.js&#10;*.map&#10;dist/*"
            ></textarea>
          </div>
        </section>

        <!-- Output Style -->
        <section class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md overflow-hidden">
          <div class="px-4 py-2 bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600 text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Output Settings</div>
          <div class="p-4 space-y-4">
            <label class="flex items-center gap-3 cursor-pointer group">
              <input type="checkbox" v-model="config.includeContent" class="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600" />
              <span class="text-sm font-medium text-gray-900 dark:text-gray-300 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">Include file contents in output</span>
            </label>
            <div class="flex flex-col gap-2">
              <span class="block text-sm font-medium text-gray-900 dark:text-white">Header Style</span>
              <select v-model="config.headerStyle" class="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500">
                <option value="compact">Compact (FILE:path)</option>
                <option value="divider">Divider (===== FILE:path =====)</option>
              </select>
            </div>
          </div>
        </section>
      </div>

      <!-- Footer -->
      <div class="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 flex gap-3 justify-end items-center">
        <button @click="emit('close')" class="py-2.5 px-5 text-sm font-medium text-gray-900 focus:outline-none bg-white rounded-lg border border-gray-200 hover:bg-gray-100 hover:text-blue-700 focus:z-10 focus:ring-4 focus:ring-gray-100 dark:focus:ring-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-600 dark:hover:text-white dark:hover:bg-gray-700 transition-colors">Cancel</button>
        <button @click="save" class="text-white bg-blue-700 hover:bg-blue-800 focus:ring-4 focus:ring-blue-300 font-medium rounded-lg text-sm px-5 py-2.5 dark:bg-blue-600 dark:hover:bg-blue-700 focus:outline-none dark:focus:ring-blue-800 shadow-sm transition-colors">Apply Changes</button>
      </div>
    </div>
  </div>
</template>
