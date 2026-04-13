<script setup lang="ts">
import { TriangleAlert } from 'lucide-vue-next'
import { FocusTrap } from 'focus-trap-vue'

defineProps<{
  show: boolean
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  variant?: 'danger' | 'warning'
  autoFocusConfirm?: boolean
}>()

const emit = defineEmits(['confirm', 'cancel'])
</script>

<template>
  <Teleport to="body">
    <div v-if="show" class="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm transition-opacity">
      <FocusTrap :active="show" :initial-focus="autoFocusConfirm ? '#confirm-btn' : '#cancel-btn'">
        <div
          :class="[
            'bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in',
            variant === 'danger'
              ? 'border border-red-200 dark:border-red-900/50'
              : 'border border-amber-200 dark:border-amber-900/50'
          ]"
          role="dialog"
          aria-modal="true"
        >
          <div
            :class="['h-2 w-full', variant === 'danger' ? 'bg-red-500' : 'bg-amber-500']"
          ></div>

          <div class="p-8 flex flex-col items-center text-center">
            <div
              :class="[
                'mb-5 rounded-full p-4',
                variant === 'danger'
                  ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
                  : 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400'
              ]"
            >
              <TriangleAlert class="w-10 h-10" />
            </div>

            <h3 class="text-xl font-bold text-gray-900 dark:text-white mb-3 tracking-tight">{{ title }}</h3>
            <p class="text-sm text-gray-500 dark:text-gray-400 mb-8 leading-relaxed px-4 whitespace-pre-line" v-html="message"></p>

            <div class="flex flex-col w-full gap-3 px-2">
              <button
                id="confirm-btn"
                @click="emit('confirm')"
                :class="[
                  'w-full py-3 text-sm font-bold text-center text-white rounded-xl focus:ring-4 focus:outline-none transition-all uppercase tracking-widest shadow-lg',
                  variant === 'danger'
                    ? 'bg-red-600 hover:bg-red-700 focus:ring-red-300 dark:focus:ring-red-800 shadow-red-600/20'
                    : 'bg-amber-600 hover:bg-amber-700 focus:ring-amber-300 dark:focus:ring-amber-800 shadow-amber-600/20'
                ]"
              >
                {{ confirmText || 'Confirm' }}
              </button>
              <button
                id="cancel-btn"
                @click="emit('cancel')"
                class="w-full py-3 text-xs font-bold text-center text-gray-900 bg-white border border-gray-200 rounded-xl hover:bg-gray-100 hover:text-blue-700 focus:z-10 focus:ring-4 focus:outline-none focus:ring-gray-100 dark:focus:ring-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-600 dark:hover:text-white dark:hover:bg-gray-700 transition-all uppercase tracking-[0.2em]"
              >
                {{ cancelText || 'Dismiss' }}
              </button>
            </div>
          </div>
        </div>
      </FocusTrap>
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
