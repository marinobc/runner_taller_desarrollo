const fs = require('fs');
const path = require('path');
const { getEncoding } = require('js-tiktoken');

class TokenCacheService {
    constructor(cachePath) {
        this.cachePath = cachePath;
        this.encoder = getEncoding('cl100k_base');
        this.cache = this.load();
    }

    load() {
        try {
            if (fs.existsSync(this.cachePath)) {
                const data = fs.readFileSync(this.cachePath, 'utf-8');
                return JSON.parse(data);
            }
        } catch (e) {
            console.warn(`⚠️ Token cache load failed: ${e.message}`);
        }
        return {};
    }

    save() {
        try {
            fs.writeFileSync(this.cachePath, JSON.stringify(this.cache, null, 2));
        } catch (e) {
            console.error(`⚠️ Token cache save failed: ${e.message}`);
        }
    }

    getCacheKey(rootPath, relativePath) {
        // Use a combination of root and path to avoid collisions
        return `${rootPath}:${relativePath}`;
    }

    getTokenCount(rootPath, relativePath) {
        const key = this.getCacheKey(rootPath, relativePath);
        if (this.cache[key] !== undefined) {
            return this.cache[key];
        }

        return this.updateTokenCount(rootPath, relativePath);
    }

    updateTokenCount(rootPath, relativePath) {
        const fullPath = path.resolve(rootPath, relativePath);
        if (!fs.existsSync(fullPath) || fs.lstatSync(fullPath).isDirectory()) {
            return 0;
        }

        try {
            const content = fs.readFileSync(fullPath, 'utf-8');
            const tokens = this.encoder.encode(content).length;
            const key = this.getCacheKey(rootPath, relativePath);
            this.cache[key] = tokens;
            this.save();
            return tokens;
        } catch (e) {
            console.error(`Error encoding tokens for ${relativePath}:`, e.message);
            return 0;
        }
    }

    deleteTokenCount(rootPath, relativePath) {
        const key = this.getCacheKey(rootPath, relativePath);
        if (this.cache[key] !== undefined) {
            delete this.cache[key];
            this.save();
        }
    }

    calculateTokens(text) {
        try {
            return this.encoder.encode(text).length;
        } catch (e) {
            console.error('Error calculating tokens:', e.message);
            return 0;
        }
    }
}

module.exports = TokenCacheService;
