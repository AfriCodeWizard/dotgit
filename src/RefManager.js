const fs = require('fs').promises;
const path = require('path');
const { logger } = require('./Logger');

class RefManager {
    constructor(dotgitPath) {
        this.dotgitPath = dotgitPath;
        this.refsPath = path.join(dotgitPath, 'refs');
        this.headsPath = path.join(this.refsPath, 'heads');
        this.tagsPath = path.join(this.refsPath, 'tags');
        this.remotesPath = path.join(this.refsPath, 'remotes');
        this.headPath = path.join(dotgitPath, 'HEAD');
    }

    async init() {
        await fs.mkdir(this.refsPath, { recursive: true });
        await fs.mkdir(this.headsPath, { recursive: true });
        await fs.mkdir(this.tagsPath, { recursive: true });
        await fs.mkdir(this.remotesPath, { recursive: true });
        await this.setHead('refs/heads/main');
    }

    async setHead(ref, hash = null) {
        const content = hash ? hash : `ref: ${ref}`;
        await fs.writeFile(this.headPath, content);
        logger.debug(`Updated HEAD to ${content}`);
    }

    async getHead() {
        const headPath = path.join(this.dotgitPath, 'HEAD');
        try {
            const data = await fs.readFile(headPath, 'utf8');
            if (data.startsWith('ref: ')) {
                const ref = data.slice(5).trim();
                return {
                    type: 'ref',
                    ref,
                    hash: await this.resolveRef(ref)
                };
            }
            return null;
        } catch (error) {
            if (error.code === 'ENOENT') {
                return null;
            }
            throw error;
        }
    }

    async updateRef(ref, hash) {
        const refPath = this.getRefPath(ref);
        await fs.mkdir(path.dirname(refPath), { recursive: true });
        await fs.writeFile(refPath, hash);
        logger.debug(`Updated ref ${ref} to ${hash}`);
    }

    async deleteRef(ref) {
        const refPath = this.getRefPath(ref);
        try {
            await fs.unlink(refPath);
            logger.debug(`Deleted ref ${ref}`);
            return true;
        } catch (error) {
            if (error.code === 'ENOENT') {
                return false;
            }
            throw error;
        }
    }

    async resolveRef(ref) {
        try {
            const refPath = this.getRefPath(ref);
            const content = await fs.readFile(refPath, 'utf8');
            return content.trim();
        } catch (error) {
            if (error.code === 'ENOENT') {
                return null;
            }
            throw error;
        }
    }

    getRefPath(ref) {
        if (ref.startsWith('refs/')) {
            return path.join(this.dotgitPath, ref);
        }
        return path.join(this.dotgitPath, 'refs', ref);
    }

    async listRefs(prefix = '') {
        const refsPath = path.join(this.dotgitPath, 'refs');
        try {
            const headsPath = path.join(refsPath, 'heads');
            const heads = await fs.readdir(headsPath);
            const filteredRefs = heads
                .filter(ref => ref.startsWith(prefix))
                .map(ref => `heads/${ref}`);
            return filteredRefs;
        } catch (error) {
            return [];
        }
    }

    async createTag(name, hash, message = '') {
        const tagPath = path.join(this.tagsPath, name);
        
        try {
            await fs.access(tagPath);
            throw new Error(`Tag '${name}' already exists`);
        } catch (error) {
            if (error.code !== 'ENOENT') throw error;
        }

        const tagData = {
            object: hash,
            type: 'commit',
            tag: name,
            tagger: process.env.USER || 'unknown',
            timestamp: new Date().toISOString(),
            message
        };

        await fs.writeFile(tagPath, JSON.stringify(tagData, null, 2));
        logger.info(`Created tag '${name}' at ${hash}`);
        return tagData;
    }

    async deleteTag(name) {
        const tagPath = path.join(this.tagsPath, name);
        try {
            await fs.unlink(tagPath);
            logger.info(`Deleted tag '${name}'`);
            return true;
        } catch (error) {
            if (error.code === 'ENOENT') {
                return false;
            }
            throw error;
        }
    }

    async getTag(name) {
        const tagPath = path.join(this.tagsPath, name);
        try {
            const content = await fs.readFile(tagPath, 'utf8');
            return JSON.parse(content);
        } catch (error) {
            if (error.code === 'ENOENT') {
                return null;
            }
            throw error;
        }
    }

    async listTags() {
        try {
            const tags = await fs.readdir(this.tagsPath);
            return Promise.all(
                tags.map(async tag => ({
                    name: tag,
                    ...(await this.getTag(tag))
                }))
            );
        } catch (error) {
            if (error.code === 'ENOENT') {
                return [];
            }
            throw error;
        }
    }
}

module.exports = RefManager;
