const { MongoClient } = require('mongodb');
const logger = require('../services/Logger');

class MongoConnection {
    constructor(uri) {
        this.uri = uri || process.env.MONGO_URI || 'mongodb://localhost:27017/?authSource=admin';
        this.client = null;
    }

    async connect() {
        if (this.client) {
            return this.client;
        }

        try {
            logger.info(`Connecting to MongoDB at ${this.uri}...`);
            this.client = new MongoClient(this.uri, {
                serverSelectionTimeoutMS: 5000,
                connectTimeoutMS: 10000,
            });
            await this.client.connect();
            await this.client.db('admin').command({ ping: 1 });
            logger.info('MongoDB client connected');
            return this.client;
        } catch (error) {
            logger.error(`MongoDB connection failed: ${error.message}`);
            throw error;
        }
    }

    async disconnect() {
        if (this.client) {
            await this.client.close();
            this.client = null;
            logger.info('MongoDB disconnected');
        }
    }

    /**
     * Returns a handle to a specific database by name.
     * @param {string} dbName
     */
    getDb(dbName) {
        if (!this.client) {
            throw new Error('MongoDB not connected. Call connect() first.');
        }
        return this.client.db(dbName);
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
