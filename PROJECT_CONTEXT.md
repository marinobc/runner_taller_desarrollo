# Project Context: Workshop Toolkit (Runner & Concat Tool)

## Overview
A unified development panel designed to manage multiple microservices and provide code analysis tools for a multi-module project (Java/Spring Boot + Node.js/Vue).

---

## Architecture

**Monorepo** with 3 main parts:

| Component | Tech | Purpose |
|-----------|------|---------|
| **Backend** | Express.js (Node.js) | Service orchestration, file scanning, SSE logging |
| **Frontend** | Vue 3 + TypeScript + Vite + Tailwind CSS | UI panel with real-time service management |
| **Scripts** | Node.js launcher | Unified startup script for both frontend & backend |

---

## Core Features

### 🚀 Service Runner
- Auto-discovers services by scanning directories (Maven via `pom.xml`, Node via `package.json`)
- Start/stop individual or all services with staggered launches
- Real-time log streaming via Server-Sent Events (SSE)
- Port conflict detection and resolution (kill processes blocking ports)

### 📂 Concat Tool
- Recursively scans project directories into a file tree
- Filters via skip lists, gitignore patterns, and custom globs
- Concatenates selected files into a single output
- Built-in **minifier** (Java, TS, JS, CSS, HTML, XML, Python, YAML) to reduce token count
- **Token counting** using `js-tiktoken` (cl100k_base encoding) with caching for performance

### ⚡ Additional Features
- Filesystem watcher (chokidar) broadcasts real-time file change events
- Theme cycling (light/dark/system)
- Debug mode toggle with persisted localStorage
- Toast notifications for user feedback

---

## Key Backend Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /api/state` | Current config + discovered services |
| `POST /api/services/:id/start|stop` | Control individual services |
| `POST /api/services/start-all|stop-all` | Bulk service control |
| `POST /api/ports/nuke-all` | Force-kill all services |
| `GET /api/stream/global|/:id` | SSE log streams |
| `POST /api/scan-files` | Scan directories for concat |
| `POST /api/generate-concat` | Generate concatenated output with token count |

---

## Tech Stack

| Layer | Technologies |
|-------|-------------|
| **Backend** | Express.js, chokidar, cors, glob, js-tiktoken |
| **Frontend** | Vue 3 (Composition API), TypeScript, Vite, Tailwind CSS, Flowbite, Lucide icons |
| **Build/Run** | npm, Node.js launcher script |

---

## Project Structure

```
runner_taller_desarrollo/
├── backend/                # Express.js server
│   ├── src/
│   │   ├── config/         # ConfigManager (toolkit-config.json)
│   │   ├── process/        # ProcessManager (service lifecycle)
│   │   ├── routes/         # API endpoints
│   │   ├── scanner/        # FileScanner (gitignore, glob patterns)
│   │   └── services/       # Logger, Minifier, ServiceDiscovery, TokenCacheService
│   └── server.js           # Entry point
├── frontend/               # Vue 3 + Vite + Tailwind
│   ├── src/
│   │   ├── components/
│   │   │   ├── common/     # StatusDot, ToastContainer
│   │   │   ├── layout/     # Header, PathsBar
│   │   │   ├── panels/     # ConcatToolPanel, ServiceRunnerPanel
│   │   │   └── runner/     # ServiceCard, ServiceLogsModal, ConflictModal
│   │   ├── composables/    # useToast
│   │   └── utils/          # logger.ts
│   ├── vite.config.ts
│   └── index.html
├── scripts/
│   └── launcher.js         # Unified startup script
└── toolkit-config.json     # Configuration (git-ignored)
```

---

## Vite Configuration

```typescript
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  server: {
    port: 3334,
    proxy: {
      '/api': {
        target: 'http://localhost:3333',
        changeOrigin: true
      }
    }
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true
  }
})
```

---

## How to Run
```bash
npm start  # Launches backend (port 3333) + frontend (port 3334)
```

The launcher (`scripts/launcher.js`) auto-installs dependencies if missing and manages process lifecycle with proper cleanup on exit.

---

## Key Configuration Files
- `toolkit-config.json` - User config (backend/frontend paths, port, debug mode, concat settings)
- `token-cache.json` - Token count cache for performance

---

*Generated: 2026-04-13*
