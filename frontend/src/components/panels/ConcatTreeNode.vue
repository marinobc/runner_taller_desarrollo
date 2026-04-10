<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  node: any
}>()

const emit = defineEmits(['toggle-dir', 'toggle-file'])

const toggleExpanded = () => {
  if (props.node.isDir) {
    emit('toggle-dir', props.node)
  }
}

const toggleSelection = (e: Event) => {
  e.stopPropagation()
  emit('toggle-file', props.node)
}

const getIcon = () => {
  if (props.node.isDir) {
    return props.node.expanded ? '📂' : '📁'
  }
  return '📄'
}

// compute selection state
// 0: unchecked, 1: checked, 2: indeterminate
const checkState = computed(() => {
  if (!props.node.isDir) return props.node.file.selected ? 1 : 0
  
  let checkedCount = 0
  let totalCount = 0
  
  const scan = (n: any) => {
    if (!n.isDir) {
      totalCount++
      if (n.file.selected) checkedCount++
    } else {
      n.children.forEach(scan)
    }
  }
  scan(props.node)
  
  if (totalCount === 0) return 0
  if (checkedCount === totalCount) return 1
  if (checkedCount === 0) return 0
  return 2
})

const checkboxSymbol = computed(() => {
  const s = checkState.value
  if (s === 1) return '☑'
  if (s === 2) return '◩'
  return '☐'
})

const checkboxColor = computed(() => {
  const s = checkState.value
  if (s === 1) return 'text-green-600 dark:text-green-400'
  if (s === 2) return 'text-yellow-500 dark:text-yellow-400'
  return 'text-gray-400 dark:text-gray-500'
})

</script>

<template>
  <div class="font-mono text-[11px] select-none">
    <div 
      class="flex items-center gap-1 px-1 py-[2px] rounded hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer group transition-colors"
      @click="toggleExpanded"
    >
      <!-- Fold indicator for dirs -->
      <div 
        class="w-3 text-center text-[9px] text-gray-400 dark:text-gray-500"
        :class="{ 'invisible': !node.isDir }"
      >
        {{ node.isDir ? (node.expanded ? '▼' : '▶') : '' }}
      </div>

      <!-- Checkbox -->
      <div 
        class="w-3.5 text-center text-[13px] hover:text-gray-900 dark:hover:text-white transition-colors"
        :class="checkboxColor"
        @click="toggleSelection"
      >
        {{ checkboxSymbol }}
      </div>

      <!-- Icon -->
      <div class="w-4 text-center opacity-80">{{ getIcon() }}</div>

      <!-- Name -->
      <div class="truncate transition-colors" :class="{ 'text-gray-500 dark:text-gray-400': checkState === 0, 'text-gray-900 dark:text-gray-100 font-medium': checkState !== 0 }">
        {{ node.name }}
      </div>
    </div>

    <!-- Children -->
    <div v-if="node.isDir && node.expanded" class="pl-3 border-l border-gray-200 dark:border-gray-700 ml-1.5 mt-[1px]">
      <ConcatTreeNode 
        v-for="child in node.children" 
        :key="child.path"
        :node="child"
        @toggle-dir="$emit('toggle-dir', $event)"
        @toggle-file="$emit('toggle-file', $event)"
      />
    </div>
  </div>
</template>
