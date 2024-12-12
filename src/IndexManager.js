const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const crypto = require('crypto');
const lockfile = require('proper-lockfile');
const { logger } = require('./Logger');

class IndexManager {
    constructor(dotgitPath) {
        this.dotgitPath = dotgitPath;
        this.indexPath = path.join(dotgitPath, 'index');
        this.lockPath = path.join(dotgitPath, 'index.lock');
        this.entries = new Map();
    }

    // Load the index from the file
    async load() {
        try {
            const release = await lockfile.lock(this.indexPath, {
                retries: 5,
                stale: 10000
            });

            try {
                const content = await fs.readFile(this.indexPath, 'utf8');
                const index = JSON.parse(content);
                this.entries = new Map(Object.entries(index));
            } finally {
                await release();
            }
        } catch (error) {
            if (error.code === 'ENOENT') {
                // File does not exist, create an empty index
                this.entries = new Map();
            } else {
                // Handle JSON parsing errors
                throw new Error('Failed to load index: ' + error.message);
            }
        }
    }

    // Save the current index to the file
    async save() {
        try {
            const release = await lockfile.lock(this.indexPath, {
                retries: 5,
                stale: 10000
            });

            try {
                const index = Object.fromEntries(this.entries);
                await fs.writeFile(
                    this.indexPath,
                    JSON.stringify(index, null, 2)
                );
            } finally {
                await release();
            }
        } catch (error) {
            logger.error(`Failed to save index: ${error.message}`);
            throw error;
        }
    }

    // Add a file to the index
    async add(filePath, content) {
        try {
            const stats = await fs.stat(filePath);
            const hash = this.calculateHash(content);

            this.entries.set(filePath, {
                hash,
                size: stats.size,
                mtime: stats.mtime.toISOString(),
                mode: stats.mode,
                staged: true
            });

            await this.save();
            logger.debug(`Added to index: ${filePath} (${hash})`);
            return hash;
        } catch (error) {
            logger.error(`Failed to add file ${filePath}: ${error.message}`);
            throw error;
        }
    }

    // Remove a file from the index
    async remove(filePath) {
        if (this.entries.has(filePath)) {
            this.entries.delete(filePath);
            await this.save();
            logger.debug(`Removed from index: ${filePath}`);
            return true;
        }
        return false;
    }

    // Update the file mode in the index
    async updateMode(filePath, mode) {
        const entry = this.entries.get(filePath);
        if (entry) {
            entry.mode = mode;
            await this.save();
            logger.debug(`Updated mode for ${filePath}: ${mode}`);
            return true;
        }
        return false;
    }

    // Check if a file is staged
    isStaged(filePath) {
        const entry = this.entries.get(filePath);
        return entry?.staged || false;
    }

    // Get changes in the working directory
    async getChanges(workingDir) {
        const changes = {
            staged: new Set(),
            modified: new Set(),
            deleted: new Set(),
            untracked: new Set()
        };

        // Check all files in the index for changes
        await Promise.all(
            Array.from(this.entries).map(async ([filePath, entry]) => {
                try {
                    const stats = await fs.stat(path.join(workingDir, filePath));
                    const content = await fs.readFile(path.join(workingDir, filePath));
                    const currentHash = this.calculateHash(content);

                    if (entry.hash !== currentHash) {
                        if (entry.staged) {
                            changes.staged.add(filePath);
                        } else {
                            changes.modified.add(filePath);
                        }
                    }
                } catch (error) {
                    if (error.code === 'ENOENT') {
                        changes.deleted.add(filePath);
                    } else {
                        logger.warn(`Error checking file ${filePath}: ${error.message}`);
                    }
                }
            })
        );

        // Find untracked files
        try {
            const files = await this.walkDirectory(workingDir);
            files.forEach(file => {
                const relativePath = path.relative(workingDir, file);
                if (!this.entries.has(relativePath)) {
                    changes.untracked.add(relativePath);
                }
            });
        } catch (error) {
            logger.error(`Error walking directory: ${error.message}`);
        }

        return changes;
    }

    // Walk through the directory to find all files
    async walkDirectory(dir) {
        const files = [];
        const entries = await fs.readdir(dir, { withFileTypes: true });

        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                if (entry.name !== '.dotgit') {
                    files.push(...await this.walkDirectory(fullPath));
                }
            } else {
                files.push(fullPath);
            }
        }

        return files;
    }

    // Calculate SHA-1 hash of file content
    calculateHash(content) {
        return crypto
            .createHash('sha1')
            .update(content)
            .digest('hex');
    }

    // Clear the index
    async clear() {
        this.entries.clear();
        await this.save();
        logger.debug('Cleared index');
    }

    // Get all entries in the index
    getEntries() {
        return Array.from(this.entries.entries()).map(([path, entry]) => ({
            path,
            ...entry
        }));
    }

    // Write the staged files to a tree
    async writeTree() {
        const tree = {};
        for (const [filePath, entry] of this.entries) {
            if (entry.staged) {
                tree[filePath] = {
                    hash: entry.hash,
                    mode: entry.mode
                };
            }
        }
        return tree;
    }
}

module.exports = IndexManager;
