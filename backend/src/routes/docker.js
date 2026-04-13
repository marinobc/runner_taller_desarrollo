const express = require('express');
const DockerManager = require('../docker/DockerManager');
const { getAllServices, getService, buildRunCommand } = require('../docker/services');

let dockerManager = null;

module.exports = function (configManager) {
    const router = express.Router();
    dockerManager = new DockerManager();

    function getMergedService(id) {
        const svc = getService(id);
        if (!svc) return null;

        const savedConfig = configManager.get().docker?.services?.[id] || {};

        const merged = {
            ...svc,
            ports: svc.ports.map((p, i) => ({
                ...p,
                host: savedConfig.ports?.[i]?.host ?? p.host
            })),
            env: savedConfig.env || [...svc.env],
            volumes: savedConfig.volumes || [...svc.volumes]
        };

        return merged;
    }

    router.get('/health', async (req, res) => {
        const result = await dockerManager.checkDocker();
        res.json(result);
    });

    router.get('/services', (req, res) => {
        const svcs = getAllServices().map(svc => ({
            ...svc,
            savedConfig: configManager.get().docker?.services?.[svc.id] || {}
        }));
        res.json({ services: svcs });
    });

    router.get('/config/:id', (req, res) => {
        const svc = getService(req.params.id);
        if (!svc) return res.status(404).json({ ok: false, error: 'Service not found' });

        const savedConfig = configManager.get().docker?.services?.[req.params.id] || {};
        const merged = getMergedService(req.params.id);

        res.json({
            ok: true,
            serviceId: req.params.id,
            defaults: {
                ports: svc.ports.map(p => p.host),
                env: [...svc.env],
                volumes: [...svc.volumes]
            },
            saved: savedConfig,
            merged: {
                ports: merged.ports.map(p => p.host),
                env: merged.env,
                volumes: merged.volumes
            },
            command: buildRunCommand(merged)
        });
    });

    router.put('/config/:id', (req, res) => {
        const svc = getService(req.params.id);
        if (!svc) return res.status(404).json({ ok: false, error: 'Service not found' });

        const { ports, env, volumes } = req.body;
        const dockerCfg = configManager.get().docker || { services: {} };
        dockerCfg.services = dockerCfg.services || {};
        dockerCfg.services[req.params.id] = { ports, env, volumes };

        configManager.save({ docker: dockerCfg });

        const merged = getMergedService(req.params.id);
        res.json({
            ok: true,
            config: merged,
            command: buildRunCommand(merged)
        });
    });

    router.get('/status/:id', async (req, res) => {
        const svc = getService(req.params.id);
        if (!svc) return res.status(404).json({ ok: false, error: 'Service not found' });

        const result = await dockerManager.getServiceStatus(svc.name);
        res.json(result);
    });

    router.post('/start/:id', async (req, res) => {
        const merged = getMergedService(req.params.id);
        if (!merged) return res.status(404).json({ ok: false, error: 'Service not found' });

        const result = await dockerManager.startService(merged);
        if (!result.ok && result.error === 'Port conflicts') {
            return res.status(409).json(result);
        }
        res.json(result);
    });

    router.post('/stop/:id', async (req, res) => {
        const svc = getService(req.params.id);
        if (!svc) return res.status(404).json({ ok: false, error: 'Service not found' });

        const result = await dockerManager.stopService(svc.name);
        res.json(result);
    });

    router.post('/restart/:id', async (req, res) => {
        const merged = getMergedService(req.params.id);
        if (!merged) return res.status(404).json({ ok: false, error: 'Service not found' });

        const svc = getService(req.params.id);
        await dockerManager.stopService(svc.name);
        const result = await dockerManager.startService(merged);
        res.json(result);
    });

    router.post('/create/:id', async (req, res) => {
        const merged = getMergedService(req.params.id);
        if (!merged) return res.status(404).json({ ok: false, error: 'Service not found' });

        // First remove existing container if any
        await dockerManager.removeContainerOnly(merged.name);

        const result = await dockerManager.startService(merged);
        res.json(result);
    });

    router.post('/remove/:id', async (req, res) => {
        const svc = getService(req.params.id);
        if (!svc) return res.status(404).json({ ok: false, error: 'Service not found' });

        const result = await dockerManager.removeContainerOnly(svc.name);
        res.json(result);
    });

    router.post('/remove-volumes/:id', async (req, res) => {
        const svc = getService(req.params.id);
        if (!svc) return res.status(404).json({ ok: false, error: 'Service not found' });

        const result = await dockerManager.removeVolumes(svc);
        res.json(result);
    });

    router.post('/remove-image/:id', async (req, res) => {
        const svc = getService(req.params.id);
        if (!svc) return res.status(404).json({ ok: false, error: 'Service not found' });

        const result = await dockerManager.removeImage(svc);
        res.json(result);
    });

    router.post('/clean-conflicts/:id', async (req, res) => {
        const svc = getService(req.params.id);
        if (!svc) return res.status(404).json({ ok: false, error: 'Service not found' });

        const result = await dockerManager.removeAllConflictingContainers(svc);
        res.json(result);
    });

    router.get('/logs/:id', async (req, res) => {
        const svc = getService(req.params.id);
        if (!svc) return res.status(404).json({ ok: false, error: 'Service not found' });

        const tail = parseInt(req.query.tail) || 100;
        const result = await dockerManager.getLogs(svc.name, tail);
        res.json(result);
    });

    router.post('/check-conflicts/:id', async (req, res) => {
        const merged = getMergedService(req.params.id);
        if (!merged) return res.status(404).json({ ok: false, error: 'Service not found' });

        const conflicts = await dockerManager.checkConflicts(merged);
        res.json({ conflicts });
    });

    return router;
};
