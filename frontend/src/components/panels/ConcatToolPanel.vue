<script setup lang="ts">
import { ref, onMounted, computed, onUnmounted } from 'vue'
import ConcatConfigModal from './ConcatConfigModal.vue'
import ConcatTreeNode from './ConcatTreeNode.vue'
import { useToast } from '../../composables/useToast'

const props = defineProps<{
  config: { backendRoot: string, frontendRoot: string }
}>()

interface FileItem {
  name: string
  path: string
  size: number
  tokens: number
  root: string
  selected: boolean
}

interface TreeNode {
  name: string
  isDir: boolean
  path: string
  expanded: boolean
  children: TreeNode[]
  tokens: number
  file?: FileItem
}

const scanStatus = ref('Ready')
const showConfig = ref(false)
const allFiles = ref<FileItem[]>([])
const treeRoot = ref<TreeNode[]>([])
const outputText = ref('')
const calculatedTokens = ref<number | null>(null)

const concatConfig = ref<any>(null)

// State keys for persistence
const STORAGE_PREFIX = 'concat_panel_'
const EXPANDED_KEY = STORAGE_PREFIX + 'expanded_paths'
const SELECTED_KEY = STORAGE_PREFIX + 'selected_paths'

const getSavedExpanded = (): Set<string> => {
  try {
    const saved = localStorage.getItem(EXPANDED_KEY)
    return saved ? new Set(JSON.parse(saved)) : new Set(['backend', 'frontend'])
  } catch { return new Set(['backend', 'frontend']) }
}

const getSavedSelected = (): Set<string> => {
  try {
    const saved = localStorage.getItem(SELECTED_KEY)
    return saved ? new Set(JSON.parse(saved)) : new Set()
  } catch { return new Set() }
}

const savePersistentState = () => {
  const expandedPaths = new Set<string>()
  const saveExp = (nodes: TreeNode[]) => {
    for (const node of nodes) {
      if (node.isDir && node.expanded) expandedPaths.add(node.path)
      if (node.children) saveExp(node.children)
    }
  }
  saveExp(treeRoot.value)
  
  const selectedPaths = new Set<string>()
  for (const f of allFiles.value) {
    if (f.selected) selectedPaths.add(f.root + '/' + f.path)
  }

  localStorage.setItem(EXPANDED_KEY, JSON.stringify([...expandedPaths]))
  localStorage.setItem(SELECTED_KEY, JSON.stringify([...selectedPaths]))
}

onMounted(async () => {
  try {
    const res = await fetch('/api/concat-config')
    const data = await res.json()
    if (data.concat) {
      concatConfig.value = data.concat
      // Auto-scan on mount if we have some config
      if (props.config.backendRoot || props.config.frontendRoot) {
        scanFolders()
      }
    }
  } catch (e) {
    console.error('Failed to load concat config', e)
  }
  
  window.addEventListener('fs-changed', scanFolders)
})

onUnmounted(() => {
  window.removeEventListener('fs-changed', scanFolders)
})

const { showToast } = useToast()

const saveConfig = async (newConfig: any) => {
  try {
    const res = await fetch('/api/concat-config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newConfig)
    })
    const data = await res.json()
    if (data.ok) {
      concatConfig.value = data.concat
      showToast('Configuration saved successfully', 'success')
      scanFolders() // Re-scan with new config
    }
  } catch (e) {
    console.error('Failed to save concat config', e)
    showToast('Failed to save configuration', 'error')
  }
}

const scanFolders = async (e?: Event) => {
  const isAutoUpdate = e && e instanceof CustomEvent && e.detail?.auto;

  const paths = []
  if (props.config.backendRoot) paths.push('backend')
  if (props.config.frontendRoot) paths.push('frontend')
  
  if (paths.length === 0) {
    if (!isAutoUpdate) showToast('Please configure Backend/Frontend paths first.', 'warning')
    return
  }

  scanStatus.value = isAutoUpdate ? 'Updating...' : 'Scanning...'
  
  // Load persistent state
  const expandedPaths = getSavedExpanded()
  const selectedPaths = getSavedSelected()

  try {
    const res = await fetch('/api/scan-files', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paths })
    })
    const data = await res.json()
    let files = data.files || []
    
    allFiles.value = files.map((f: any) => {
      const fullPath = f.root + '/' + f.path
      // Default to saved state, or false if not in saved state
      const isSelected = selectedPaths.has(fullPath)
      return { ...f, selected: isSelected }
    })

    // Build the tree
    const rootObj: Record<string, TreeNode> = {
      backend: { name: 'Backend', isDir: true, path: 'backend', expanded: expandedPaths.has('backend'), children: [], tokens: 0 },
      frontend: { name: 'Frontend', isDir: true, path: 'frontend', expanded: expandedPaths.has('frontend'), children: [], tokens: 0 }
    }
    
    allFiles.value.forEach(file => {
      const parts = (file.path || '').split(/[\/\\]/)
      let current = rootObj[file.root]
      if (!current) return
      
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i]
        const isFile = i === parts.length - 1
        
        let existing = current.children.find((c: TreeNode) => c.name === part && c.isDir === !isFile)
        if (!existing) {
          const nodePath = file.root + '/' + parts.slice(0, i + 1).join('/')
          existing = {
            name: part,
            isDir: !isFile,
            path: nodePath,
            expanded: expandedPaths.has(nodePath),
            children: [],
            tokens: 0,
            file: isFile ? file : undefined
          }
          current.children.push(existing)
        }
        current = existing
      }
    })

    const flattenTree = (nodes: TreeNode[]) => {
      for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i]
        if (node.isDir) {
          // If a directory has exactly 1 child AND it is a directory AND No files directly in it
          if (node.children.length === 1 && node.children[0].isDir) {
            const child = node.children[0]
            node.name = node.name + '.' + child.name // Use dot notation for Java-style
            node.path = child.path // Use the deeper path for state
            node.children = child.children
            node.expanded = expandedPaths.has(node.path) // Re-check expansion for new path
            i-- // Re-check this node (might have another single-dir child)
            continue
          }
          flattenTree(node.children)
        }
      }
    }

    const sortDir = (node: TreeNode) => {
      node.children.sort((a: TreeNode, b: TreeNode) => {
        if (a.isDir !== b.isDir) return a.isDir ? -1 : 1
        return a.name.localeCompare(b.name)
      })
      node.children.forEach(sortDir)
    }
    
    const aggregateTokens = (node: TreeNode): number => {
      if (!node.isDir && node.file) {
        node.tokens = node.file.tokens || 0
      } else {
        node.tokens = node.children.reduce((sum, child) => sum + aggregateTokens(child), 0)
      }
      return node.tokens
    }

    const treeResult: TreeNode[] = []
    if (rootObj.backend.children.length > 0) {
      flattenTree(rootObj.backend.children)
      sortDir(rootObj.backend)
      aggregateTokens(rootObj.backend)
      treeResult.push(rootObj.backend)
    }
    if (rootObj.frontend.children.length > 0) {
      flattenTree(rootObj.frontend.children)
      sortDir(rootObj.frontend)
      aggregateTokens(rootObj.frontend)
      treeResult.push(rootObj.frontend)
    }
    
    treeRoot.value = treeResult
    scanStatus.value = `Ready (${allFiles.value.length} files)`
    
    // Save state after scan to ensure it's in sync
    savePersistentState()
  } catch (err) {
    console.error('Scan failed', err)
    scanStatus.value = 'Scan failed'
  }
}

const handleToggleDir = (node: TreeNode) => {
  node.expanded = !node.expanded
  savePersistentState()
}

const selectBackendOnly = () => {
  allFiles.value.forEach(f => f.selected = f.root === 'backend')
  savePersistentState()
}

const selectFrontendOnly = () => {
  allFiles.value.forEach(f => f.selected = f.root === 'frontend')
  savePersistentState()
}

const toggleConfigOption = async (key: string) => {
  if (!concatConfig.value) return
  const newConfig = { ...concatConfig.value, [key]: !concatConfig.value[key] }
  await saveConfig(newConfig)
}

const collapseAll = () => {
  const collapse = (nodes: TreeNode[]) => {
    for (const node of nodes) {
      if (node.isDir) {
        node.expanded = false
        if (node.children) collapse(node.children)
      }
    }
  }
  collapse(treeRoot.value)
  savePersistentState()
}

const handleToggleFile = (node: TreeNode) => {
  if (!node.isDir && node.file) {
    node.file.selected = !node.file.selected
  } else if (node.isDir) {
    let total = 0
    let selected = 0
    const count = (n: TreeNode) => {
      if (!n.isDir && n.file) {
        total++
        if (n.file.selected) selected++
      } else {
        n.children.forEach(count)
      }
    }
    count(node)
    
    const targetState = selected !== total
    const apply = (n: TreeNode) => {
      if (!n.isDir && n.file) n.file.selected = targetState
      else n.children.forEach(apply)
    }
    apply(node)
  }
  savePersistentState()
}

const toggleAll = () => {
  const allSelected = allFiles.value.every(f => f.selected)
  allFiles.value.forEach(f => f.selected = !allSelected)
  savePersistentState()
}

const selectedCount = computed(() => {
  return allFiles.value.filter(f => f.selected).length
})

const generateOutput = async () => {
  if (selectedCount.value === 0) {
    outputText.value = 'No files selected to generate.'
    return
  }
  
  outputText.value = 'Generating...'
  calculatedTokens.value = null
  try {
    const selectedFiles = allFiles.value.filter(f => f.selected)
    const res = await fetch('/api/generate-concat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ files: selectedFiles })
    })
    const data = await res.json()
    if (data.result !== undefined) {
      outputText.value = data.result
      calculatedTokens.value = data.tokens || 0
    } else {
      outputText.value = 'Failed to generate output.\n' + (data.error || '')
    }
  } catch (e) {
    outputText.value = 'Error generating output.'
    console.error('Failed to generate output', e)
  }
}

const copyOutput = async () => {
  if (!outputText.value) return
  try {
    await navigator.clipboard.writeText(outputText.value)
    showToast('Copied to clipboard!', 'success')
  } catch (e) {
    console.error('Failed to copy', e)
    showToast('Failed to copy text.', 'error')
  }
}

const clearOutput = () => {
  outputText.value = ''
  calculatedTokens.value = null
}
</script>

<template>
  <div class="flex-1 grid grid-cols-[400px_1fr] h-full relative bg-white dark:bg-gray-900">
    
    <div class="bg-gray-50 border-r border-gray-200 dark:bg-gray-800 dark:border-gray-700 flex flex-col overflow-hidden shadow-sm">
      <div class="px-4 py-3 border-b border-gray-200 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400 uppercase tracking-widest font-bold">
        Project Structure
      </div>
      
      <!-- Quick Options -->
      <div class="px-3 py-2 border-b border-gray-200 dark:border-gray-700 flex gap-2 flex-wrap bg-gray-50 dark:bg-gray-800/40">
        <button 
          @click="toggleConfigOption('minify')" 
          :class="concatConfig?.minify ? 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800' : 'bg-white text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700'"
          class="text-[10px] font-bold px-2 py-1 rounded border transition-colors flex items-center gap-1"
        >
          <span :class="concatConfig?.minify ? 'text-blue-500' : 'text-gray-400'">{{ concatConfig?.minify ? '●' : '○' }}</span> Minify
        </button>
        <button 
          @click="toggleConfigOption('includeContent')" 
          :class="concatConfig?.includeContent ? 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800' : 'bg-white text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700'"
          class="text-[10px] font-bold px-2 py-1 rounded border transition-colors flex items-center gap-1"
        >
          <span :class="concatConfig?.includeContent ? 'text-blue-500' : 'text-gray-400'">{{ concatConfig?.includeContent ? '●' : '○' }}</span> Content
        </button>
        <div class="w-px h-4 bg-gray-300 dark:bg-gray-700 my-auto mx-1"></div>
        <button @click="selectBackendOnly" class="text-[10px] font-bold px-2 py-1 rounded border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 dark:bg-gray-800 dark:border-gray-700 dark:hover:bg-gray-700 dark:text-gray-400 transition-colors">Only Back</button>
        <button @click="selectFrontendOnly" class="text-[10px] font-bold px-2 py-1 rounded border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 dark:bg-gray-800 dark:border-gray-700 dark:hover:bg-gray-700 dark:text-gray-400 transition-colors">Only Front</button>
      </div>

      <div class="p-3 border-b border-gray-200 dark:border-gray-700 flex gap-2 flex-wrap bg-gray-100/50 dark:bg-gray-800/80">
        <button @click="scanFolders" class="text-xs font-medium text-gray-900 focus:outline-none bg-white rounded-lg border border-gray-200 hover:bg-gray-100 hover:text-blue-700 focus:z-10 focus:ring-4 focus:ring-gray-100 dark:focus:ring-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-600 dark:hover:text-white dark:hover:bg-gray-700 px-3 py-1.5 transition-colors">⟳ Scan</button>
        <button @click="showConfig = true" class="text-xs font-medium text-gray-900 focus:outline-none bg-white rounded-lg border border-gray-200 hover:bg-gray-100 hover:text-blue-700 focus:z-10 focus:ring-4 focus:ring-gray-100 dark:focus:ring-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-600 dark:hover:text-white dark:hover:bg-gray-700 px-3 py-1.5 transition-colors">⚙️ Config</button>
        <button v-if="allFiles.length > 0" @click="toggleAll" class="text-xs font-medium text-gray-900 focus:outline-none bg-white rounded-lg border border-gray-200 hover:bg-gray-100 hover:text-blue-700 focus:z-10 focus:ring-4 focus:ring-gray-100 dark:focus:ring-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-600 dark:hover:text-white dark:hover:bg-gray-700 px-3 py-1.5 transition-colors">
          {{ selectedCount === allFiles.length ? 'Select None' : 'All' }}
        </button>
        <button v-if="allFiles.length > 0" @click="collapseAll" class="text-xs font-medium text-gray-900 focus:outline-none bg-white rounded-lg border border-gray-200 hover:bg-gray-100 hover:text-blue-700 focus:z-10 focus:ring-4 focus:ring-gray-100 dark:focus:ring-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-600 dark:hover:text-white dark:hover:bg-gray-700 px-3 py-1.5 transition-colors">Collapse All</button>
      </div>
      
      <div class="flex-1 overflow-y-auto p-3 bg-white dark:bg-gray-900">
        <div v-if="allFiles.length === 0" class="p-4 font-mono text-xs text-gray-500 dark:text-gray-400 text-center mt-10">
          Click "Scan" to populate.
        </div>
        
        <ConcatTreeNode 
          v-for="node in treeRoot" 
          :key="node.path"
          :node="node"
          @toggle-dir="handleToggleDir"
          @toggle-file="handleToggleFile"
        />
      </div>

      <div class="flex items-center px-4 py-2 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 shrink-0">
        <span class="text-xs font-medium text-gray-500 dark:text-gray-400">{{ scanStatus }}</span>
      </div>
    </div>

    <div class="flex flex-col bg-white dark:bg-gray-900 overflow-hidden">
      <div class="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center gap-3 shrink-0 flex-wrap bg-gray-50 dark:bg-gray-800">
        <span class="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">Output</span>
        <div class="flex-1"></div>
        <span class="text-xs font-medium text-gray-500 dark:text-gray-400" v-if="calculatedTokens !== null">
          <span class="text-yellow-500 dark:text-yellow-400 font-bold bg-yellow-50 dark:bg-yellow-900/20 px-2 py-0.5 rounded">{{ calculatedTokens.toLocaleString() }}</span> Tokens
        </span>
        <div class="w-px h-4 bg-gray-300 dark:bg-gray-600 mx-1"></div>
        <span class="text-xs text-gray-500 dark:text-gray-400 font-medium">Selected: <span class="font-bold text-gray-900 dark:text-white">{{ selectedCount }} / {{ allFiles.length }}</span></span>
        <button @click="generateOutput" class="focus:outline-none text-white bg-green-700 hover:bg-green-800 focus:ring-4 focus:ring-green-300 font-medium rounded-lg text-xs px-4 py-2 dark:bg-green-600 dark:hover:bg-green-700 dark:focus:ring-green-800 transition-colors shadow-sm ml-2">⚡ Generate</button>
        <button @click="copyOutput" class="text-xs font-medium text-gray-900 focus:outline-none bg-white rounded-lg border border-gray-200 hover:bg-gray-100 hover:text-blue-700 focus:z-10 focus:ring-4 focus:ring-gray-100 dark:focus:ring-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-600 dark:hover:text-white dark:hover:bg-gray-700 px-4 py-2 transition-colors">📋 Copy</button>
        <button @click="clearOutput" class="text-xs font-medium text-gray-900 focus:outline-none bg-white rounded-lg border border-gray-200 hover:bg-gray-100 hover:text-red-700 focus:z-10 focus:ring-4 focus:ring-gray-100 dark:focus:ring-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-600 dark:hover:text-white dark:hover:bg-gray-700 px-4 py-2 transition-colors">✕ Clear</button>
      </div>
      <textarea 
        v-model="outputText"
        class="flex-1 w-full resize-none border-none bg-white text-gray-900 font-mono text-sm p-4 outline-none focus:ring-0 dark:bg-gray-900 dark:text-gray-100 dark:placeholder-gray-500" 
        placeholder="Output will appear here..."
      ></textarea>
    </div>

    <ConcatConfigModal 
      v-if="concatConfig"
      :show="showConfig" 
      :initialConfig="concatConfig" 
      @close="showConfig = false" 
      @save="saveConfig"
    />
  </div>
</template>
