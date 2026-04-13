const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');
const MongoConnection = require('./MongoConnection');
const logger = require('../services/Logger');

const SEEDS_DIR = path.join(__dirname, 'data');

const COLLECTION_ORDER = [
    'permissions_catalog',
    'roles',
    'users',
    'persons',
    'properties',
    'calendar_events',
    'visit_requests'
];

const COLLECTIONS_TO_NUKE = [
    'permissions_catalog', 'roles', 'users', 'persons',
    'audit_logs', 'properties', 'calendar_events', 'visit_requests',
    'employment_cycles', 'password_reset_tokens', 'refresh_tokens', 'email_logs'
];

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
        { keys: { status: 1 }, options: { name: 'idx_users_status' } }
    ],
    persons: [
        { keys: { authUserId: 1 }, options: { unique: true, name: 'uk_persons_auth' } },
        { keys: { personType: 1 }, options: { name: 'idx_persons_type' } }
    ],
    properties: [
        { keys: { assignedAgentId: 1 }, options: { name: 'idx_prop_agent' } },
        { keys: { ownerId: 1 }, options: { name: 'idx_prop_owner' } },
        { keys: { status: 1 }, options: { name: 'idx_prop_status' } }
    ],
    calendar_events: [
        { keys: { propertyId: 1, startTime: 1 }, options: { name: 'idx_cal_prop_time' } },
        { keys: { agentId: 1, startTime: 1 }, options: { name: 'idx_cal_agent_time' } }
    ],
    visit_requests: [
        { keys: { agentId: 1, status: 1 }, options: { name: 'idx_visit_agent_status' } }
    ]
};

const TYPE_ALIAS_MAP = {
    ADMIN: 'admin',
    EMPLOYEE: 'employee',
    OWNER: 'owner',
    INTERESTED_CLIENT: 'interested_client'
};

const SYSTEM_ACTOR = 'system';

class SeedExecutor {
    constructor(config) {
        this.config = config || {};
        this.mongo = new MongoConnection(
            this.config.mongoUri,
            this.config.mongoDbName
        );
    }

    async getConnection() {
        return await this.mongo.connect();
    }

    async testConnection() {
        try {
            await this.mongo.connect();
            const connected = await this.mongo.isConnected();
            return { connected, uri: this.config.mongoUri || 'mongodb://localhost:27017', dbName: this.config.mongoDbName || 'inmobiliaria_db' };
        } catch (error) {
            return { connected: false, error: error.message, uri: this.config.mongoUri || 'mongodb://localhost:27017' };
        }
    }

    listSeedFiles() {
        const files = [];
        const seedMap = {
            'permissions.json': 'permissions_catalog',
            'roles.json': 'roles',
            'users.json': 'users',
            'persons.json': 'persons',
            'properties.json': 'properties',
            'calendar_events.json': 'calendar_events',
            'visit_requests.json': 'visit_requests'
        };

        for (const [file, collection] of Object.entries(seedMap)) {
            const filePath = path.join(SEEDS_DIR, file);
            if (fs.existsSync(filePath)) {
                const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
                files.push({ file, collection, count: data.length });
            }
        }
        return files;
    }

    async nukeCollections() {
        const db = await this.getConnection();
        const results = [];

        // Drop the entire database to ensure all collections are removed
        try {
            await db.dropDatabase();
            logger.info(`  ✓ Dropped database: ${this.config.mongoDbName || 'inmobiliaria_db'}`);
            results.push({ collection: '(all)', action: 'database dropped', ok: true });
        } catch (e) {
            results.push({ collection: '(all)', action: 'drop failed', error: e.message, ok: false });
            logger.error(`  ! Could not drop database: ${e.message}`);
        }

        return results;
    }

    async createIndexes() {
        const db = await this.getConnection();
        const results = [];

        for (const [collection, indexes] of Object.entries(INDEXES)) {
            try {
                for (const idx of indexes) {
                    await db.collection(collection).createIndex(idx.keys, idx.options);
                }
                results.push({ collection, ok: true });
            } catch (e) {
                results.push({ collection, ok: false, error: e.message });
            }
        }
        return results;
    }

    _bcryptHash(password) {
        const rounds = this.config.bcryptRounds || 12;
        return bcrypt.hashSync(password, rounds);
    }

    _dateToDateTime(dateStr) {
        const d = new Date(dateStr);
        return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    }

    _nowUtc() {
        return new Date();
    }

    _resolveRoleIds(items, roleCodeMap) {
        return items.map(item => {
            const roleCode = item.roleCode;
            if (roleCode && roleCodeMap[roleCode]) {
                item.roleIds = [roleCodeMap[roleCode]];
            }
            delete item.roleCode;
            return item;
        });
    }

    _resolvePermissions(roles, perms) {
        return roles.map(role => {
            if (role.permissionsRef === 'permissions') {
                role.permissions = perms;
            } else if (Array.isArray(role.permissionsRef)) {
                role.permissions = role.permissionsRef;
            }
            delete role.permissionsRef;
            return role;
        });
    }

    _buildUserDoc(userData, roleMap, passwordHash, currentTime) {
        const roleIds = userData.roleIds || [];
        return {
            _id: userData._id,
            firstName: userData.firstName,
            lastName: userData.lastName,
            fullName: `${userData.firstName} ${userData.lastName}`,
            email: userData.email,
            emailNormalized: userData.email.trim().toLowerCase(),
            passwordHash: passwordHash,
            userType: userData.userType,
            status: 'ACTIVE',
            temporaryPassword: false,
            temporaryPasswordExpiresAt: null,
            mustChangePassword: false,
            passwordChangedAt: null,
            failedLoginAttempts: 0,
            lockedUntil: null,
            lastLoginAt: null,
            primaryRoleIds: roleIds,
            activeEmploymentCycleId: null,
            metadata: userData.metadata || {},
            createdAt: currentTime,
            updatedAt: currentTime,
            createdBy: SYSTEM_ACTOR
        };
    }

    _buildPersonDoc(personData, roleMap, currentTime) {
        const birthDate = personData.birthDate;
        const birthDateTime = this._dateToDateTime(birthDate);
        const personType = personData.personType;

        const doc = {
            _id: `person_${personData.authUserId}`,
            authUserId: personData.authUserId,
            _class: TYPE_ALIAS_MAP[personType] || 'person',
            firstName: personData.firstName,
            lastName: personData.lastName,
            fullName: `${personData.firstName} ${personData.lastName}`,
            birthDate: birthDateTime,
            phone: personData.phone,
            email: personData.email,
            personType: personType,
            roleIds: personData.roleIds || [],
            customRole: false,
            createdAt: currentTime,
            updatedAt: currentTime,
            createdBy: SYSTEM_ACTOR
        };

        if (personType === 'EMPLOYEE') {
            doc.department = personData.department || 'General';
            doc.position = personData.position || 'Agent';
            doc.hireDate = currentTime;
            doc.assignedClientIds = [];
        } else if (personType === 'OWNER') {
            doc.taxId = personData.taxId || 'NIT-000000';
            doc.address = personData.address || 'Address not specified';
            doc.propertyIds = [];
        } else if (personType === 'INTERESTED_CLIENT') {
            doc.preferredContactMethod = personData.preferredContactMethod || 'EMAIL';
            doc.budget = personData.budget || '0';
            doc.preferredZone = personData.preferredZone || 'Any';
            doc.preferredPropertyType = personData.preferredPropertyType || 'CASA';
            doc.preferredRooms = personData.preferredRooms || 3;
        }

        return doc;
    }

    _buildPropertyDoc(propData, currentTime) {
        return {
            _id: propData._id,
            title: propData.title,
            address: propData.address,
            price: propData.price,
            type: propData.type,
            operationType: propData.operationType,
            m2: propData.m2,
            rooms: propData.rooms,
            status: propData.status,
            assignedAgentId: propData.assignedAgentId,
            ownerId: propData.ownerId,
            imageUrls: [],
            assignmentHistory: [{
                agentId: propData.assignedAgentId,
                assignedAt: currentTime,
                assignedBy: SYSTEM_ACTOR
            }],
            priceHistory: [],
            accessPolicy: ['ROLE_AGENT', 'ROLE_ADMIN'],
            documents: [],
            images: [],
            deleted: false,
            createdAt: currentTime,
            updatedAt: currentTime,
            createdBy: propData.assignedAgentId
        };
    }

    _buildCalendarEventDoc(evtData, currentTime) {
        const now = new Date();
        const startTime = new Date(now);
        startTime.setDate(startTime.getDate() + (evtData.startOffsetDays || 0));
        startTime.setUTCHours(evtData.startHour || 10, evtData.startMinute || 0, 0, 0);

        const endTime = new Date(startTime);
        endTime.setHours(endTime.getHours() + (evtData.durationHours || 1));

        return {
            _id: evtData._id,
            propertyId: evtData.propertyId,
            propertyName: evtData.propertyName,
            agentId: evtData.agentId,
            agentName: evtData.agentName,
            startTime: startTime,
            endTime: endTime,
            type: evtData.type || 'VISIT',
            status: evtData.status || 'SCHEDULED',
            createdAt: currentTime
        };
    }

    _buildVisitRequestDoc(reqData, currentTime) {
        const now = new Date();
        const prefTime = new Date(now);
        prefTime.setDate(prefTime.getDate() + (reqData.preferredOffsetDays || 0));
        prefTime.setUTCHours(reqData.preferredHour || 10, reqData.preferredMinute || 0, 0, 0);

        return {
            _id: reqData._id,
            propertyId: reqData.propertyId,
            propertyName: reqData.propertyName,
            agentId: reqData.agentId,
            agentName: reqData.agentName,
            clientId: reqData.clientId,
            clientName: reqData.clientName,
            clientEmail: reqData.clientEmail,
            preferredDateTime: prefTime,
            status: 'PENDING',
            createdAt: currentTime,
            notificationSent: false
        };
    }

    async _upsertMany(collectionName, documents) {
        const db = await this.getConnection();
        const col = db.collection(collectionName);
        let count = 0;

        for (const doc of documents) {
            const _id = doc._id;
            const payload = {};
            for (const [k, v] of Object.entries(doc)) {
                if (k !== 'createdAt' && k !== '_id') {
                    payload[k] = v;
                }
            }
            payload.updatedAt = this._nowUtc();

            await col.updateOne(
                { _id },
                { $set: payload, $setOnInsert: { createdAt: doc.createdAt } },
                { upsert: true }
            );
            count++;
        }
        return count;
    }

    async execute(options = {}) {
        const { nuke = true, specificCollections = null } = options;
        const currentTime = this._nowUtc();
        const passwordHash = this._bcryptHash(this.config.testingPassword || 'password');
        const results = [];

        try {
            await this.getConnection();
            logger.info('Starting seed execution...');

            // 1. Nuke
            if (nuke) {
                logger.info('Nuking collections...');
                const nukeResults = await this.nukeCollections();
                results.push({ phase: 'nuke', details: nukeResults });
            }

            // 2. Create Indexes
            logger.info('Creating indexes...');
            const indexResults = await this.createIndexes();
            results.push({ phase: 'indexes', details: indexResults });

            // 3. Load and seed data
            const seedFiles = this.listSeedFiles();
            const targetCollections = specificCollections || COLLECTION_ORDER;

            // Load all raw data
            const rawData = {};
            for (const { file, collection } of seedFiles) {
                const filePath = path.join(SEEDS_DIR, file);
                rawData[collection] = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
            }

            // Build role map
            const roles = rawData.roles || [];
            const roleCodeMap = {};
            for (const r of roles) {
                roleCodeMap[r.code] = r._id;
            }

            // Process permissions
            const perms = rawData.permissions_catalog || [];
            for (const p of perms) {
                p.createdBy = SYSTEM_ACTOR;
                p.createdAt = currentTime;
            }
            const permCount = await this._upsertMany('permissions_catalog', perms);
            results.push({ phase: 'seed', collection: 'permissions_catalog', count: permCount });

            // Process roles (resolve permissions)
            const resolvedRoles = this._resolvePermissions(roles, perms);
            for (const r of resolvedRoles) {
                r.createdBy = SYSTEM_ACTOR;
                r.createdAt = currentTime;
            }
            const roleCount = await this._upsertMany('roles', resolvedRoles);
            results.push({ phase: 'seed', collection: 'roles', count: roleCount });

            // Process users
            const rawUsers = rawData.users || [];
            this._resolveRoleIds(rawUsers, roleCodeMap);
            const users = rawUsers.map(u => this._buildUserDoc(u, roleCodeMap, passwordHash, currentTime));
            const userCount = await this._upsertMany('users', users);
            results.push({ phase: 'seed', collection: 'users', count: userCount });

            // Process persons
            const rawPersons = rawData.persons || [];
            this._resolveRoleIds(rawPersons, roleCodeMap);
            const persons = rawPersons.map(p => this._buildPersonDoc(p, roleCodeMap, currentTime));
            const personCount = await this._upsertMany('persons', persons);
            results.push({ phase: 'seed', collection: 'persons', count: personCount });

            // Process properties
            const rawProps = rawData.properties || [];
            const properties = rawProps.map(p => this._buildPropertyDoc(p, currentTime));
            const propCount = await this._upsertMany('properties', properties);
            results.push({ phase: 'seed', collection: 'properties', count: propCount });

            // Update owner person propertyIds back-references
            const ownerProps = properties.filter(p => p.ownerId);
            for (const p of ownerProps) {
                const personDoc = persons.find(per => per.authUserId === p.ownerId);
                if (personDoc) {
                    if (!personDoc.propertyIds) personDoc.propertyIds = [];
                    if (!personDoc.propertyIds.includes(p._id)) {
                        personDoc.propertyIds.push(p._id);
                    }
                }
            }
            // Re-update persons with propertyIds
            for (const person of persons) {
                await this._upsertMany('persons', [person]);
            }

            // Process calendar events
            const rawEvents = rawData.calendar_events || [];
            const events = rawEvents.map(e => this._buildCalendarEventDoc(e, currentTime));
            const eventCount = await this._upsertMany('calendar_events', events);
            results.push({ phase: 'seed', collection: 'calendar_events', count: eventCount });

            // Process visit requests
            const rawRequests = rawData.visit_requests || [];
            const requests = rawRequests.map(r => this._buildVisitRequestDoc(r, currentTime));
            const requestCount = await this._upsertMany('visit_requests', requests);
            results.push({ phase: 'seed', collection: 'visit_requests', count: requestCount });

            // 4. Summary
            const db = this.mongo.getDb();
            const summary = {};
            for (const col of COLLECTION_ORDER) {
                summary[col] = await db.collection(col).countDocuments();
            }

            results.push({ phase: 'summary', counts: summary });
            logger.info('Seed execution completed successfully');

            return { ok: true, results, summary };
        } catch (error) {
            logger.error(`Seed execution failed: ${error.message}`);
            return { ok: false, error: error.message, results };
        }
    }

    async disconnect() {
        await this.mongo.disconnect();
    }
}

module.exports = SeedExecutor;
