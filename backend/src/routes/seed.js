const express = require('express');
const SeedExecutor = require('../seeds/SeedExecutor');

let activeExecutor = null;

module.exports = function (configManager) {
    const router = express.Router();

    function getSeedConfig() {
        const cfg = configManager.get();
        return {
            mongoUri: cfg.mongoUri || process.env.MONGO_URI || 'mongodb://admin:admin@localhost:27017/?authSource=admin',
            testingPassword: cfg.seedTestingPassword || process.env.SEED_TESTING_PASSWORD || 'password',
            bcryptRounds: cfg.bcryptRounds || 12
        };
    }

    router.get('/config', (req, res) => {
        const cfg = configManager.get();
        res.json({
            mongoUri: cfg.mongoUri || '',
            seedTestingPassword: cfg.seedTestingPassword || '',
            bcryptRounds: cfg.bcryptRounds || 12
        });
    });

    router.post('/config', (req, res) => {
        const { mongoUri, seedTestingPassword, bcryptRounds } = req.body;
        configManager.save({ mongoUri, seedTestingPassword, bcryptRounds: Number(bcryptRounds) || 12 });
        res.json({ ok: true, config: configManager.get() });
    });

    router.get('/connection', async (req, res) => {
        try {
            const seedConfig = getSeedConfig();
            const executor = new SeedExecutor(seedConfig);
            const status = await executor.testConnection();
            await executor.disconnect();
            res.json(status);
        } catch (error) {
            res.status(500).json({ connected: false, error: error.message });
        }
    });

    router.get('/list', (req, res) => {
        try {
            const seedConfig = getSeedConfig();
            const executor = new SeedExecutor(seedConfig);
            const files = executor.listSeedFiles();
            res.json({ ok: true, seeds: files });
        } catch (error) {
            res.status(500).json({ ok: false, error: error.message });
        }
    });

    router.post('/execute', async (req, res) => {
        if (activeExecutor) {
            return res.status(409).json({ ok: false, error: 'Seed execution already in progress' });
        }

        try {
            const { nuke = true } = req.body;
            const seedConfig = getSeedConfig();
            activeExecutor = new SeedExecutor(seedConfig);

            const result = await activeExecutor.execute({ nuke });
            await activeExecutor.disconnect();
            activeExecutor = null;

            if (result.ok) {
                res.json(result);
            } else {
                res.status(500).json(result);
            }
        } catch (error) {
            activeExecutor = null;
            res.status(500).json({ ok: false, error: error.message });
        }
    });

    router.post('/delete', async (req, res) => {
        if (activeExecutor) {
            return res.status(409).json({ ok: false, error: 'Operation already in progress' });
        }

        try {
            const seedConfig = getSeedConfig();
            activeExecutor = new SeedExecutor(seedConfig);
            const results = await activeExecutor.nukeCollections();
            await activeExecutor.disconnect();
            activeExecutor = null;

            res.json({ ok: true, results });
        } catch (error) {
            activeExecutor = null;
            res.status(500).json({ ok: false, error: error.message });
        }
    });

    router.get('/collections', (req, res) => {
        res.json({
            collections: [
                'permissions_catalog', 'roles',
                'users',
                'persons',
                'properties',
                'calendar_events', 'visit_requests', 'visits'
            ],
            databases: [
                'access_control_db',
                'identity_db',
                'notification_db',
                'user_db',
                'property_db',
                'visit_calendar_db'
            ]
        });
    });

    return router;
};
