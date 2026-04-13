<script setup lang="ts">
import ConfirmModal from '../common/ConfirmModal.vue'

defineProps<{
  show: boolean
  serviceLabel: string
  port: number | null
  pid: string | null
}>()

const emit = defineEmits(['close', 'nuke'])
</script>

<template>
  <ConfirmModal
    :show="show"
    title="Port Conflict Detected"
    :message="`The service ${serviceLabel} cannot start because port ${port} is currently held by process PID ${pid}.`"
    confirm-text="Nuke Conflicting Process"
    cancel-text="Dismiss"
    variant="warning"
    @confirm="emit('nuke')"
    @cancel="emit('close')"
  />
</template>
