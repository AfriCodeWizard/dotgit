const fs = require('fs').promises;
const path = require('path');
const { logger } = require('./Logger');

// Custom error for missing config
class ConfigNotLoadedError extends Error {
    constructor() {
        super('Config not loaded');
        this.name = 'ConfigNotLoadedError';
    }
}

class ConfigManager {
    constructor(dotgitPath) {
        this.configPath = path.join(dotgitPath, 'config');
        this.config = null;
    }

    async load() {
        try {
            const content = await fs.readFile(this.configPath, 'utf8');
            this.config = JSON.parse(content);
        } catch (error) {
            if (error.code === 'ENOENT') {
                // Initialize with default configuration if file doesn't exist
                this.config = this.getDefaultConfig();
                await this.save();
            } else {
                throw new Error(`Failed to load config: ${error.message}`);
            }
        }
    }

    async save() {
        try {
            await fs.writeFile(this.configPath, JSON.stringify(this.config, null, 2));
        } catch (error) {
            throw new Error(`Failed to save config: ${error.message}`);
        }
    }

    getDefaultConfig() {
        return {
            core: {
                repositoryFormatVersion: 0,
                fileMode: true,
                bare: false,
                logAllRefUpdates: true,
                ignoreCase: true,
                precomposedUnicode: true
            },
            user: {
                name: process.env.USER || 'unknown',
                email: ''
            },
            remote: {},
            branch: {
                default: 'main'
            },
            merge: {
                ff: true,
                conflictStyle: 'merge'
            },
            diff: {
                algorithm: 'myers',
                context: 3
            }
        };
    }

    get(section, key) {
        if (!this.config) {
            throw new ConfigNotLoadedError();
        }

        if (!section) {
            return this.config;
        }

        if (!key) {
            return this.config[section];
        }

        return this.config[section]?.[key];
    }

    async set(section, key, value) {
        if (!this.config) {
            throw new ConfigNotLoadedError();
        }

        if (!section || !key) {
            throw new Error('Section and key are required');
        }

        // Create section if it doesn't exist
        if (!this.config[section]) {
            this.config[section] = {};
        }

        // Update value
        this.config[section][key] = value;

        // Save changes
        await this.save();
        logger.debug(`Updated config: ${section}.${key} = ${value}`);
    }

    async unset(section, key) {
        if (!this.config) {
            throw new ConfigNotLoadedError();
        }

        if (!section || !key) {
            throw new Error('Section and key are required');
        }

        if (this.config[section] && this.config[section][key] !== undefined) {
            delete this.config[section][key];

            // Remove empty sections
            if (Object.keys(this.config[section]).length === 0) {
                delete this.config[section];
            }

            await this.save();
            logger.debug(`Removed config: ${section}.${key}`);
            return true;
        }

        return false;
    }

    async setUser(name, email) {
        await this.set('user', 'name', name);
        await this.set('user', 'email', email);
    }

    getUser() {
        return this.get('user');
    }

    async addRemote(name, url) {
        if (!this.config.remote) {
            this.config.remote = {};
        }
        this.config.remote[name] = { url };
        await this.save();
    }

    getRemotes() {
        return this.config.remote || {};
    }

    async setDefaultBranch(branch) {
        await this.set('branch', 'default', branch);
    }

    getDefaultBranch() {
        return this.get('branch', 'default') || 'main';
    }
}

module.exports = ConfigManager;
