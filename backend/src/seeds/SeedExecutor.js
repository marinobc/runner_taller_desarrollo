const fs = require('fs');
const path = require('path');
const MongoConnection = require('./MongoConnection');
const logger = require('../services/Logger');

const SEEDS_DIR = path.join(__dirname, 'data');

/**
 * Maps each collection to the database it lives in.
 * This reflects the new multi-database microservice architecture.
 */
const COLLECTION_DB_MAP = {
    permissions_catalog: 'access_control_db',
    roles:               'access_control_db',
    users:               'identity_db',
    persons:             'user_db',
    properties:          'property_db',
    calendar_events:     'visit_calendar_db',
    visit_requests:      'visit_calendar_db',
    visits:              'visit_calendar_db'
};

/** Ordered list for seeding (dependency order) */
const COLLECTION_ORDER = [
    'permissions_catalog',
    'roles',
    'users',
    'persons',
    'properties',
    'calendar_events',
    'visit_requests',
    'visits'
];

/** All databases managed by the seeder */
const ALL_DATABASES = [
    'identity_db',
    'access_control_db',
    'notification_db',
    'user_db',
    'property_db',
    'visit_calendar_db'
];

/** File name → collection name mapping */
const SEED_FILE_MAP = {
    'permissions.json':    'permissions_catalog',
    'roles.json':          'roles',
    'users.json':          'users',
    'persons.json':        'persons',
    'properties.json':     'properties',
    'calendar_events.json':'calendar_events',
    'visit_requests.json': 'visit_requests',
    'visits.json':         'visits'
};

/** Indexes per collection */
const INDEXES = {
    permissions_catalog: [
        { keys: { resource: 1, action: 1, scope: 1 }, options: { unique: true, name: 'uk_perm_res_act_sco' } }
    ],
    roles: [
        { keys: { code: 1 }, options: { unique: true, name: 'uk_roles_code' } },
        { keys: { name: 1 }, options: { unique: true, name: 'uk_roles_name' } }
    ],
    users: [
        { keys: { emailNormalized: 1 }, options: { unique: true, name: 'uk_users_email' } },
        { keys: { status: 1 },          options: { name: 'idx_users_status' } }
    ],
    persons: [
        { keys: { authUserId: 1 },  options: { unique: true, name: 'uk_persons_auth' } },
        { keys: { personType: 1 },  options: { name: 'idx_persons_type' } }
    ],
    properties: [
        { keys: { assignedAgentId: 1 }, options: { name: 'idx_prop_agent' } },
        { keys: { ownerId: 1 },         options: { name: 'idx_prop_owner' } },
        { keys: { status: 1 },          options: { name: 'idx_prop_status' } }
    ],
    calendar_events: [
        { keys: { propertyId: 1, startTime: 1 }, options: { name: 'idx_cal_prop_time' } },
        { keys: { agentId: 1, startTime: 1 },    options: { name: 'idx_cal_agent_time' } }
    ],
    visit_requests: [
        { keys: { agentId: 1, status: 1 }, options: { name: 'idx_visit_agent_status' } }
    ],
    visits: [
        { keys: { propertyId: 1 }, options: { name: 'idx_vis_property' } },
        { keys: { agentId: 1 },    options: { name: 'idx_vis_agent' } },
        { keys: { clientId: 1 },   options: { name: 'idx_vis_client' } }
    ]
};

const SYSTEM_ACTOR = 'system';

// ---------------------------------------------------------------------------
// Helpers for deserialising MongoDB Extended JSON dates from seed files
// ---------------------------------------------------------------------------
function parseDates(obj) {
    if (Array.isArray(obj)) return obj.map(parseDates);
    if (obj && typeof obj === 'object') {
        // { "$date": "..." } → Date
        if (obj['$date']) return new Date(obj['$date']);
        const result = {};
        for (const [k, v] of Object.entries(obj)) {
            result[k] = parseDates(v);
        }
        return result;
    }
    return obj;
}

class SeedExecutor {
    constructor(config) {
        this.config = config || {};
        this.mongo = new MongoConnection(this.config.mongoUri);
    }

    // -----------------------------------------------------------------------
    // Connection helpers
    // -----------------------------------------------------------------------
    async connect() {
        return await this.mongo.connect();
    }

    async testConnection() {
        try {
            await this.mongo.connect();
            const connected = await this.mongo.isConnected();
            return {
                connected,
                uri: this.config.mongoUri || 'mongodb://localhost:27017/?authSource=admin',
                databases: ALL_DATABASES
            };
        } catch (error) {
            return {
                connected: false,
                error: error.message,
                uri: this.config.mongoUri || 'mongodb://localhost:27017/?authSource=admin'
            };
        }
    }

    async disconnect() {
        await this.mongo.disconnect();
    }

    // -----------------------------------------------------------------------
    // Seed file listing (for the UI)
    // -----------------------------------------------------------------------
    listSeedFiles() {
        const files = [];
        for (const [file, collection] of Object.entries(SEED_FILE_MAP)) {
            const filePath = path.join(SEEDS_DIR, file);
            if (fs.existsSync(filePath)) {
                const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
                files.push({
                    file,
                    collection,
                    database: COLLECTION_DB_MAP[collection],
                    count: data.length
                });
            }
        }
        return files;
    }

    // -----------------------------------------------------------------------
    // Nuke — drop all managed databases for a clean slate
    // -----------------------------------------------------------------------
    async nukeCollections() {
        await this.connect();
        const results = [];

        for (const dbName of ALL_DATABASES) {
            try {
                const db = this.mongo.getDb(dbName);
                await db.dropDatabase();
                logger.info(`  ✓ Dropped database: ${dbName}`);
                results.push({ database: dbName, action: 'dropped', ok: true });
            } catch (e) {
                logger.error(`  ! Could not drop database ${dbName}: ${e.message}`);
                results.push({ database: dbName, action: 'drop failed', error: e.message, ok: false });
            }
        }

        return results;
    }

    // -----------------------------------------------------------------------
    // Index creation — per-collection, each in the right database
    // -----------------------------------------------------------------------
    async createIndexes() {
        await this.connect();
        const results = [];

        for (const [collection, indexes] of Object.entries(INDEXES)) {
            const dbName = COLLECTION_DB_MAP[collection];
            try {
                const col = this.mongo.getDb(dbName).collection(collection);
                for (const idx of indexes) {
                    await col.createIndex(idx.keys, idx.options);
                }
                results.push({ collection, database: dbName, ok: true });
            } catch (e) {
                results.push({ collection, database: dbName, ok: false, error: e.message });
            }
        }

        return results;
    }

    // -----------------------------------------------------------------------
    // Upsert helper — targets the correct DB for the collection
    // -----------------------------------------------------------------------
    async _upsertMany(collectionName, documents) {
        const dbName = COLLECTION_DB_MAP[collectionName];
        const col = this.mongo.getDb(dbName).collection(collectionName);
        let count = 0;

        for (const doc of documents) {
            const _id = doc._id;
            const payload = {};
            for (const [k, v] of Object.entries(doc)) {
                if (k !== 'createdAt' && k !== '_id') {
                    payload[k] = v;
                }
            }
            payload.updatedAt = new Date();

            await col.updateOne(
                { _id },
                { $set: payload, $setOnInsert: { createdAt: doc.createdAt || new Date() } },
                { upsert: true }
            );
            count++;
        }
        return count;
    }

    // -----------------------------------------------------------------------
    // Main seeding routine
    // -----------------------------------------------------------------------
    async execute(options = {}) {
        const { nuke = true } = options;
        const results = [];

        try {
            await this.connect();
            logger.info('Starting multi-database seed execution...');

            // 1. Nuke all databases
            if (nuke) {
                logger.info('Dropping all managed databases...');
                const nukeResults = await this.nukeCollections();
                results.push({ phase: 'nuke', details: nukeResults });
            }

            // 2. Create indexes
            logger.info('Creating indexes...');
            const indexResults = await this.createIndexes();
            results.push({ phase: 'indexes', details: indexResults });

            // 3. Load seed files — parse extended JSON dates
            const rawData = {};
            for (const [file, collection] of Object.entries(SEED_FILE_MAP)) {
                const filePath = path.join(SEEDS_DIR, file);
                if (fs.existsSync(filePath)) {
                    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
                    rawData[collection] = parseDates(parsed);
                } else {
                    logger.warn(`  ⚠ Seed file not found, skipping: ${file}`);
                    rawData[collection] = [];
                }
            }

            // 4. Seed each collection in dependency order
            //    The new seed data is already schema-ready (bcrypt hashes
            //    are pre-computed, permissions are embedded in roles).
            //    We just stamp createdAt/updatedAt and insert.

            const now = new Date();

            for (const collection of COLLECTION_ORDER) {
                const docs = rawData[collection] || [];
                if (!docs.length) {
                    logger.info(`  – Skipping empty collection: ${collection}`);
                    results.push({ phase: 'seed', collection, database: COLLECTION_DB_MAP[collection], count: 0 });
                    continue;
                }

                // Stamp timestamps on documents that don't already have them
                const stamped = docs.map(doc => ({
                    ...doc,
                    createdAt: doc.createdAt || now,
                    updatedAt: doc.updatedAt || now
                }));

                // Special case: persons — stamp createdBy if missing
                if (collection === 'persons' || collection === 'users') {
                    stamped.forEach(doc => {
                        if (!doc.createdBy) doc.createdBy = SYSTEM_ACTOR;
                    });
                }

                const count = await this._upsertMany(collection, stamped);
                const dbName = COLLECTION_DB_MAP[collection];
                logger.info(`  ✓ ${collection} (${dbName}): ${count} document(s)`);
                results.push({ phase: 'seed', collection, database: dbName, count });
            }

            // 5. Summary — count documents per collection across all databases
            const summary = {};
            for (const collection of COLLECTION_ORDER) {
                const dbName = COLLECTION_DB_MAP[collection];
                summary[collection] = await this.mongo.getDb(dbName).collection(collection).countDocuments();
            }

            results.push({ phase: 'summary', counts: summary, databases: ALL_DATABASES });
            logger.info('Seed execution completed successfully');

            return { ok: true, results, summary };
        } catch (error) {
            logger.error(`Seed execution failed: ${error.message}`);
            return { ok: false, error: error.message, results };
        }
    }
}

module.exports = SeedExecutor;
