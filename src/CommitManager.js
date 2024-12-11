const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const { logger } = require('./Logger');
const { CommitNotFoundError, ObjectNotFoundError } = require('./errors');

// Custom error for missing objects
class ObjectNotFoundError extends Error {
    constructor(hash) {
        super(`Object ${hash} not found`);
        this.name = 'ObjectNotFoundError';
    }
}

class CommitManager {
    constructor(dotgitPath) {
        this.dotgitPath = dotgitPath;
        this.objectsPath = path.join(dotgitPath, 'objects');
        this.refsPath = path.join(dotgitPath, 'refs');
    }

    async createCommit(tree, message, parent = null) {
        const commit = {
            tree,
            parent,
            message,
            author: process.env.USER || 'unknown',
            timestamp: new Date().toISOString()
        };

        const commitContent = JSON.stringify(commit, null, 2);
        const hash = this.calculateHash(commitContent);
        
        await this.saveCommit(hash, commitContent);
        logger.commitInfo(hash, message);
        
        return hash;
    }

    calculateHash(content) {
        return crypto.createHash('sha1').update(content).digest('hex');
    }

    async saveCommit(hash, content) {
        const commitPath = path.join(this.objectsPath, hash);
        await fs.writeFile(commitPath, content);
    }

    async getCommit(hash) {
        try {
            const commitPath = path.join(this.objectsPath, hash);
            const content = await fs.readFile(commitPath, 'utf8');
            return JSON.parse(content);
        } catch (error) {
            throw new CommitNotFoundError(hash);
        }
    }

    async getCommitHistory(startHash, maxDepth = 100) {
        const history = [];
        let currentHash = startHash;
        let depth = 0;

        while (currentHash && depth < maxDepth) {
            try {
                const commit = await this.getCommit(currentHash);
                history.push({
                    hash: currentHash,
                    ...commit
                });
                currentHash = commit.parent;
                depth++;
            } catch (error) {
                if (error instanceof CommitNotFoundError) {
                    break;
                }
                throw error;
            }
        }

        return history;
    }

    async getCommitDiff(oldHash, newHash) {
        const oldCommit = oldHash ? await this.getCommit(oldHash) : null;
        const newCommit = await this.getCommit(newHash);

        const oldTree = oldCommit ? JSON.parse(await this.getObject(oldCommit.tree)) : {};
        const newTree = JSON.parse(await this.getObject(newCommit.tree));

        const changes = {
            added: [],
            modified: [],
            deleted: []
        };

        // Find added and modified files
        for (const [path, newData] of Object.entries(newTree)) {
            if (!oldTree[path]) {
                changes.added.push(path);
            } else if (oldTree[path].hash !== newData.hash) {
                changes.modified.push(path);
            }
        }

        // Find deleted files
        if (oldTree) {
            for (const path of Object.keys(oldTree)) {
                if (!newTree[path]) {
                    changes.deleted.push(path);
                }
            }
        }

        return changes;
    }

    async getObject(hash) {
        const objectPath = path.join(this.objectsPath, hash);
        try {
            return await fs.readFile(objectPath, 'utf8');
        } catch (error) {
            throw new ObjectNotFoundError(hash);
        }
    }

    formatCommitMessage(commit, hash) {
        const shortHash = hash.slice(0, 7);
        const date = new Date(commit.timestamp).toLocaleString();
        const message = commit.message || '(no commit message)';
        return `commit ${shortHash}\nAuthor: ${commit.author}\nDate: ${date}\n\n    ${message}\n`;
    }

    async printCommitLog(startHash, options = {}) {
        const history = await this.getCommitHistory(startHash);
        
        for (const commit of history) {
            logger.info(this.formatCommitMessage(commit, commit.hash));
            
            if (options.showDiff) {
                const diff = await this.getCommitDiff(commit.parent, commit.hash);
                this.printDiff(diff);
            }
        }
    }

    printDiff(diff) {
        if (diff.added.length) {
            logger.info('\nAdded files:');
            diff.added.forEach(file => logger.fileStatus('added', file));
        }
        if (diff.modified.length) {
            logger.info('\nModified files:');
            diff.modified.forEach(file => logger.fileStatus('modified', file));
        }
        if (diff.deleted.length) {
            logger.info('\nDeleted files:');
            diff.deleted.forEach(file => logger.fileStatus('deleted', file));
        }
    }
}

module.exports = CommitManager;
