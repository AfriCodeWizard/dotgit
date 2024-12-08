const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const lockfile = require('proper-lockfile');

class StagingArea {
    constructor(dotgitPath) {
        this.indexPath = path.join(dotgitPath, 'index');
        this.stagedFiles = new Map();
        this.lockfile = null;
    }

    async load() {
        try {
            // Acquire lock for reading
            this.lockfile = await lockfile.lock(this.indexPath, { 
                retries: 5,
                stale: 10000
            });

            const content = await fs.readFile(this.indexPath, 'utf8');
            const index = JSON.parse(content);
            
            this.stagedFiles = new Map(Object.entries(index));
        } catch (error) {
            if (error.code !== 'ENOENT') {
                console.error('Error loading staging area:', error);
            }
            // Initialize empty staging area if file doesn't exist
            this.stagedFiles = new Map();
        } finally {
            if (this.lockfile) {
                await this.lockfile();
                this.lockfile = null;
            }
        }
    }

    async save() {
        try {
            // Acquire lock for writing
            this.lockfile = await lockfile.lock(this.indexPath, {
                retries: 5,
                stale: 10000
            });

            const index = Object.fromEntries(this.stagedFiles);
            await fs.writeFile(this.indexPath, JSON.stringify(index, null, 2));
        } finally {
            if (this.lockfile) {
                await this.lockfile();
                this.lockfile = null;
            }
        }
    }

    async stageFile(filePath, content) {
        const hash = crypto.createHash('sha1').update(content).digest('hex');
        this.stagedFiles.set(filePath, {
            hash,
            timestamp: new Date().toISOString()
        });
        await this.save();
        return hash;
    }

    async unstageFile(filePath) {
        if (this.stagedFiles.has(filePath)) {
            this.stagedFiles.delete(filePath);
            await this.save();
            return true;
        }
        return false;
    }

    isStaged(filePath) {
        return this.stagedFiles.has(filePath);
    }

    getStagedFiles() {
        return Array.from(this.stagedFiles.keys());
    }

    clear() {
        this.stagedFiles.clear();
        return this.save();
    }
}

module.exports = StagingArea;
