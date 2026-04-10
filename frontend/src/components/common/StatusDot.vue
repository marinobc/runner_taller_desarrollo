<script setup lang="ts">
defineProps<{ active: boolean }>()
</script>

<template>
  <span 
    :class="[
      'w-[7px] h-[7px] rounded-full transition-all duration-300',
      active ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.8)] dark:bg-green-400 dark:shadow-[0_0_8px_rgba(74,222,128,0.8)]' : 'bg-gray-400 dark:bg-gray-600'
    ]"
  ></span>
</template>
