/**
 * Docker service definitions.
 * Each service describes how to run a container, its ports, volumes, and env vars.
 */

const SERVICES = [
    {
        id: 'mongodb',
        label: 'MongoDB',
        name: 'TD_BD_Inmobiliaria',
        image: 'mongo:7.0',
        ports: [{ host: 27017, container: 27017 }],
        volumes: ['mongo_data:/data/db'],
        env: [
            'MONGO_INITDB_ROOT_USERNAME=admin',
            'MONGO_INITDB_ROOT_PASSWORD=admin',
            'MONGO_INITDB_DATABASE=inmobiliaria_db'
        ],
        icon: 'Database',
        description: 'MongoDB 7.0 database with admin user and inmobiliaria_db',
        webUrl: null
    },
    {
        id: 'mailhog',
        label: 'MailHog',
        name: 'mailhog',
        image: 'mailhog/mailhog',
        ports: [
            { host: 1025, container: 1025 },
            { host: 8025, container: 8025 }
        ],
        volumes: [],
        env: [],
        icon: 'Mail',
        description: 'MailHog SMTP server for development. Web UI at :8025',
        webUrl: 'http://localhost:8025'
    },
    {
        id: 'minio',
        label: 'MinIO',
        name: 'buckets',
        image: 'cgr.dev/chainguard/minio:latest',
        ports: [
            { host: 9000, container: 9000 },
            { host: 9001, container: 9001 }
        ],
        volumes: ['~/minio-data:/data'],
        env: [
            'MINIO_ROOT_USER=minioadmin',
            'MINIO_ROOT_PASSWORD=minioadmin'
        ],
        runOptions: ['--user', 'root'],
        command: ['server', '/data', '--console-address', ':9001'],
        icon: 'HardDrive',
        description: 'MinIO object storage. API at :9000, Console at :9001',
        webUrl: 'http://localhost:9001'
    }
];

function getService(id) {
    return SERVICES.find(s => s.id === id) || null;
}

function getAllServices() {
    return SERVICES;
}

function buildRunCommand(svc) {
    let cmd = `docker run --name ${svc.name} -d`;
    for (const p of svc.ports) cmd += ` -p ${p.host}:${p.container || p.host}`;
    for (const v of (svc.volumes || [])) cmd += ` -v ${v}`;
    for (const e of (svc.env || [])) cmd += ` -e ${e}`;
    if (svc.runOptions) cmd += ` ${svc.runOptions.join(' ')}`;
    cmd += ` ${svc.image}`;
    if (svc.command) cmd += ` ${svc.command.join(' ')}`;
    return cmd;
}

module.exports = { SERVICES, getService, getAllServices, buildRunCommand };
