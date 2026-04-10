<script setup lang="ts">
const props = defineProps<{
  show: boolean
  serviceLabel: string
  port: number | null
  pid: string | null
}>()

const emit = defineEmits(['close', 'nuke'])
</script>

<template>
  <Teleport to="body">
    <div v-if="show" class="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm transition-opacity">
      <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-amber-200 dark:border-amber-900/50 animate-in">
        <div class="bg-amber-500 h-2 w-full"></div>
        
        <div class="p-8 flex flex-col items-center text-center">
          <!-- Icon -->
          <div class="mb-5 rounded-full bg-amber-100 dark:bg-amber-900/30 p-4 text-amber-600 dark:text-amber-400">
            <svg class="w-10 h-10" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"></path></svg>
          </div>

          <h3 class="text-xl font-bold text-gray-900 dark:text-white mb-3 tracking-tight">Port Conflict Detected</h3>
          <p class="text-sm text-gray-500 dark:text-gray-400 mb-8 leading-relaxed px-4">
            The service <span class="font-extrabold text-gray-900 dark:text-white underline decoration-amber-500/50 underline-offset-4">{{ serviceLabel }}</span> cannot start because port <span class="font-mono font-black text-amber-600 dark:text-amber-500">{{ port }}</span> is currently held by process <span class="bg-amber-100 dark:bg-amber-900/40 px-2 py-0.5 rounded font-mono font-bold text-amber-700 dark:text-amber-300">PID {{ pid }}</span>.
          </p>

          <div class="flex flex-col w-full gap-3 px-2">
            <button 
              @click="emit('nuke')"
              class="w-full py-3 text-sm font-bold text-center text-white bg-amber-600 rounded-xl hover:bg-amber-700 focus:ring-4 focus:outline-none focus:ring-amber-300 dark:focus:ring-amber-800 transition-all uppercase tracking-widest shadow-lg shadow-amber-600/20"
            >
              Nuke Conflicting Process
            </button>
            <button 
              @click="emit('close')"
              class="w-full py-3 text-xs font-bold text-center text-gray-900 bg-white border border-gray-200 rounded-xl hover:bg-gray-100 hover:text-blue-700 focus:z-10 focus:ring-4 focus:outline-none focus:ring-gray-100 dark:focus:ring-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-600 dark:hover:text-white dark:hover:bg-gray-700 transition-all uppercase tracking-[0.2em]"
            >
              Dismiss
            </button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.animate-in {
  animation: modal-pop 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}
@keyframes modal-pop {
  from { opacity: 0; transform: scale(0.9) translateY(20px); }
  to { opacity: 1; transform: scale(1) translateY(0); }
}
</style>
