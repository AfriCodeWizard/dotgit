const fs = require('fs').promises;
const path = require('path');
const { logger } = require('./Logger');
const { ConfigManager } = require('./ConfigManager');

class RemoteManager {
    constructor(dotgitPath) {
        this.dotgitPath = dotgitPath;
        this.configManager = new ConfigManager(dotgitPath);
        this.remotesPath = path.join(dotgitPath, 'remotes');
    }

    async init() {
        await this.configManager.load();
        await this.ensureRemotesFile();
    }

    async ensureRemotesFile() {
        try {
            await fs.access(this.remotesPath);
        } catch (error) {
            if (error.code === 'ENOENT') {
                await fs.writeFile(this.remotesPath, '{}');
            } else {
                throw error;
            }
        }
    }

    async addRemote(name, url) {
        if (!name || !url) {
            throw new Error('Remote name and URL are required');
        }

        const remotes = await this.getRemotes();
        if (remotes[name]) {
            throw new Error(`Remote '${name}' already exists`);
        }

        remotes[name] = {
            url,
            fetch: `+refs/heads/*:refs/remotes/${name}/*`,
            push: `refs/heads/*:refs/heads/*`,
            mirror: false
        };

        await this.saveRemotes(remotes);
        await this.configManager.addRemote(name, url);
        logger.info(`Added remote '${name}' with URL '${url}'`);
    }

    async removeRemote(name) {
        const remotes = await this.getRemotes();
        if (!remotes[name]) {
            throw new Error(`Remote '${name}' does not exist`);
        }

        delete remotes[name];
        await this.saveRemotes(remotes);
        
        const config = await this.configManager.get('remote');
        delete config[name];
        await this.configManager.save();
        
        logger.info(`Removed remote '${name}'`);
    }

    async getRemotes() {
        try {
            const content = await fs.readFile(this.remotesPath, 'utf8');
            return JSON.parse(content);
        } catch (error) {
            if (error.code === 'ENOENT') {
                return {};
            }
            throw error;
        }
    }

    async saveRemotes(remotes) {
        await fs.writeFile(
            this.remotesPath,
            JSON.stringify(remotes, null, 2)
        );
    }

    async setRemoteUrl(name, url) {
        const remotes = await this.getRemotes();
        if (!remotes[name]) {
            throw new Error(`Remote '${name}' does not exist`);
        }

        remotes[name].url = url;
        await this.saveRemotes(remotes);
        await this.configManager.set('remote', name, { url });
        logger.info(`Updated URL for remote '${name}' to '${url}'`);
    }

    async getRemoteUrl(name) {
        const remotes = await this.getRemotes();
        if (!remotes[name]) {
            throw new Error(`Remote '${name}' does not exist`);
        }
        return remotes[name].url;
    }

    async setRemoteFetch(name, fetch) {
        const remotes = await this.getRemotes();
        if (!remotes[name]) {
            throw new Error(`Remote '${name}' does not exist`);
        }

        remotes[name].fetch = fetch;
        await this.saveRemotes(remotes);
        logger.info(`Updated fetch refspec for remote '${name}'`);
    }

    async setRemotePush(name, push) {
        const remotes = await this.getRemotes();
        if (!remotes[name]) {
            throw new Error(`Remote '${name}' does not exist`);
        }

        remotes[name].push = push;
        await this.saveRemotes(remotes);
        logger.info(`Updated push refspec for remote '${name}'`);
    }

    async setRemoteMirror(name, mirror) {
        const remotes = await this.getRemotes();
        if (!remotes[name]) {
            throw new Error(`Remote '${name}' does not exist`);
        }

        remotes[name].mirror = !!mirror;
        await this.saveRemotes(remotes);
        logger.info(`Updated mirror setting for remote '${name}' to ${mirror}`);
    }

    async listRemotes(verbose = false) {
        const remotes = await this.getRemotes();
        const remoteNames = Object.keys(remotes);

        if (verbose) {
            return remoteNames.map(name => ({
                name,
                ...remotes[name]
            }));
        }

        return remoteNames;
    }

    async validateRemote(name) {
        const remotes = await this.getRemotes();
        if (!remotes[name]) {
            throw new Error(`Remote '${name}' does not exist`);
        }
        return remotes[name];
    }
}

module.exports = RemoteManager;
