<script setup lang="ts">
import { useToast } from '../../composables/useToast'
import { CircleCheck, CircleX, Info, X } from 'lucide-vue-next'

const { toasts, removeToast } = useToast()
</script>

<template>
  <div class="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
    <transition-group name="toast">
      <div 
        v-for="toast in toasts" :key="toast.id" 
        class="pointer-events-auto flex items-center w-full max-w-xs p-4 text-gray-700 bg-white rounded-lg shadow-lg dark:text-gray-300 dark:bg-gray-800 border border-gray-200 dark:border-gray-700" role="alert"
      >
        <div class="inline-flex items-center justify-center shrink-0 w-8 h-8 rounded-lg" 
          :class="{
            'text-green-500 bg-green-100 dark:bg-green-800 dark:text-green-200': toast.type === 'success',
            'text-blue-500 bg-blue-100 dark:bg-blue-800 dark:text-blue-200': toast.type === 'info',
            'text-red-500 bg-red-100 dark:bg-red-800 dark:text-red-200': toast.type === 'error',
            'text-yellow-500 bg-yellow-100 dark:bg-yellow-800 dark:text-yellow-200': toast.type === 'warning'
          }"
        >
          <CircleCheck v-if="toast.type === 'success'" class="w-5 h-5" />
          <CircleX v-else-if="toast.type === 'error'" class="w-5 h-5" />
          <Info v-else class="w-4 h-4" />
        </div>
        <div class="ms-3 text-sm font-medium">{{ toast.msg }}</div>
        <button @click="removeToast(toast.id)" type="button" class="ms-auto -mx-1.5 -my-1.5 bg-white text-gray-400 hover:text-gray-900 rounded-lg focus:ring-2 focus:ring-gray-300 p-1.5 hover:bg-gray-100 inline-flex items-center justify-center h-8 w-8 dark:text-gray-500 dark:hover:text-white dark:bg-gray-800 dark:hover:bg-gray-700" aria-label="Close">
          <span class="sr-only">Close</span>
          <X class="w-3 h-3" />
        </button>
      </div>
    </transition-group>
  </div>
</template>

<style scoped>
.toast-enter-active, .toast-leave-active {
  transition: all 0.3s ease;
}
.toast-enter-from {
  opacity: 0;
  transform: translateX(30px);
}
.toast-leave-to {
  opacity: 0;
  transform: scale(0.9);
}
</style>
