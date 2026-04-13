#!/usr/bin/env node
/**
 * Proyecto Taller — Unified Backend
 * Features: Service Management, File Scanning, SSE Logging.
 * Architecture: SOLID (Single Responsibility, Dependency Injection).
 */

process.chdir(__dirname);

const express = require("express");
const path = require("path");

const cors = require("cors");
const ConfigManager = require("./src/config/ConfigManager");
const ProcessManager = require("./src/process/ProcessManager");
const apiRoutes = require("./src/routes/api");
const TokenCacheService = require("./src/services/TokenCacheService");

const configPath = path.join(__dirname, '..', 'toolkit-config.json');
const tokenCachePath = path.join(__dirname, '..', 'token-cache.json');
const configManager = new ConfigManager(configPath);
const processManager = new ProcessManager();
const tokenCacheService = new TokenCacheService(tokenCachePath);

const app = express();
app.use(cors());
app.use(express.json());

// Setup API routes
app.use("/api", apiRoutes(configManager, processManager, tokenCacheService));

const PORT = configManager.get().port || 3333;
app.listen(PORT, () => {
    console.log(`\n  ──────────────────────────────────────────`);
    console.log(`  PROYECTO TALLER — UNIFIED TOOLKIT`);
    console.log(`  ➜ Local: http://localhost:${PORT}`);
    console.log(`  ──────────────────────────────────────────\n`);
});