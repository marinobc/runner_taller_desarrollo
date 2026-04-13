const { MongoClient } = require('mongodb');
const logger = require('../services/Logger');

class MongoConnection {
    constructor(uri, dbName) {
        this.uri = uri || process.env.MONGO_URI || 'mongodb://localhost:27017';
        this.dbName = dbName || process.env.MONGO_DB_NAME || 'inmobiliaria_db';
        this.client = null;
        this.db = null;
    }

    async connect() {
        if (this.client && this.db) {
            return this.db;
        }

        try {
            logger.info(`Connecting to MongoDB at ${this.uri}...`);
            this.client = new MongoClient(this.uri, {
                serverSelectionTimeoutMS: 5000,
                connectTimeoutMS: 10000,
            });
            await this.client.connect();
            await this.client.db('admin').command({ ping: 1 });
            this.db = this.client.db(this.dbName);
            logger.info(`MongoDB connected — DB: ${this.dbName}`);
            return this.db;
        } catch (error) {
            logger.error(`MongoDB connection failed: ${error.message}`);
            throw error;
        }
    }

    async disconnect() {
        if (this.client) {
            await this.client.close();
            this.client = null;
            this.db = null;
            logger.info('MongoDB disconnected');
        }
    }

    getDb() {
        if (!this.db) {
            throw new Error('MongoDB not connected. Call connect() first.');
        }
        return this.db;
    }

    async isConnected() {
        try {
            if (this.client) {
                await this.client.db('admin').command({ ping: 1 });
                return true;
            }
        } catch (e) {
            return false;
        }
        return false;
    }
}

module.exports = MongoConnection;
