const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const { FileTree } = require('./FileTree');
const { RepositoryNotFoundError, CommitNotFoundError } = require('./errors');

/**
 * Represents a dotgit repository
 */
class Repository {
    /**
     * @param {string} rootDir - Root directory of the repository
     */
    constructor(rootDir = '.') {
        this.rootDir = rootDir;
        this.dotgitDir = path.join(rootDir, '.dotgit');
        this.objectsDir = path.join(this.dotgitDir, 'objects');
        this.refsDir = path.join(this.dotgitDir, 'refs');
        this.headFile = path.join(this.dotgitDir, 'HEAD');
        this.remotesFile = path.join(this.dotgitDir, 'remotes');
    }

    /**
     * Initialize a new repository
     * @returns {Promise<void>}
     */
    async init() {
        // Create repository structure
        await fs.mkdir(this.dotgitDir);
        await fs.mkdir(this.objectsDir);
        await fs.mkdir(path.join(this.refsDir, 'heads'), { recursive: true });
        await fs.writeFile(this.headFile, 'ref: refs/heads/main');
        await fs.writeFile(this.remotesFile, '{}');
    }

    /**
     * Create a new commit
     * @param {string} message - Commit message
     * @returns {Promise<string>} - Hash of the new commit
     */
    async commit(message) {
        const tree = await this.getWorkingTree();
        const parent = await this.getCurrentCommit();
        
        const commit = {
            tree: tree.getHash(),
            parent: parent || '',
            message,
            timestamp: new Date().toISOString()
        };

        const commitContent = JSON.stringify(commit, null, 2);
        const hash = this.hashContent(commitContent);
        
        // Save commit object
        await this.saveObject(hash, commitContent);
        
        // Update HEAD
        await fs.writeFile(this.headFile, hash);
        
        return hash;
    }

    /**
     * Get the current working tree
     * @returns {Promise<FileTree>}
     */
    async getWorkingTree() {
        const tree = new FileTree();
        // Implementation from workingDirectory.js
        return tree;
    }

    /**
     * Get the current commit hash
     * @returns {Promise<string|null>}
     */
    async getCurrentCommit() {
        try {
            const headContent = await fs.readFile(this.headFile, 'utf8');
            if (headContent.startsWith('ref: ')) {
                const ref = headContent.slice(5).trim();
                const refPath = path.join(this.dotgitDir, ref);
                try {
                    return (await fs.readFile(refPath, 'utf8')).trim();
                } catch (error) {
                    return null;
                }
            }
            return headContent.trim() || null;
        } catch (error) {
            return null;
        }
    }

    /**
     * Save an object to the repository
     * @param {string} hash 
     * @param {string} content 
     */
    async saveObject(hash, content) {
        const objectPath = path.join(this.objectsDir, hash);
        await fs.writeFile(objectPath, content);
    }

    /**
     * Hash content using SHA-1
     * @param {string} content 
     * @returns {string}
     */
    hashContent(content) {
        const hash = crypto.createHash('sha1');
        hash.update(content);
        return hash.digest('hex');
    }

    /**
     * Check if current directory is a repository
     * @returns {Promise<boolean>}
     */
    async isRepository() {
        try {
            const stats = await fs.stat(this.dotgitDir);
            return stats.isDirectory();
        } catch (error) {
            return false;
        }
    }

    /**
     * Get the status of the working directory
     * @returns {Promise<Object>} Status object containing tracked and untracked files
     */
    async getStatus() {
        const workingTree = await this.getWorkingTree();
        const currentCommit = await this.getCurrentCommit();
        
        return {
            currentCommit,
            workingTree: workingTree.getAllFiles().map(file => ({
                path: file.path,
                hash: file.hash
            }))
        };
    }

    /**
     * Add a new remote
     * @param {string} name - Name of the remote
     * @param {string} url - URL of the remote
     */
    async addRemote(name, url) {
        let remotes = {};
        try {
            const content = await fs.readFile(this.remotesFile, 'utf8');
            remotes = JSON.parse(content);
        } catch (error) {
            // File doesn't exist or is invalid, start fresh
        }

        remotes[name] = url;
        await fs.writeFile(this.remotesFile, JSON.stringify(remotes, null, 2));
    }

    async getRemotes() {
        try {
            const content = await fs.readFile(this.remotesFile, 'utf8');
            return JSON.parse(content);
        } catch (error) {
            return {};
        }
    }
}

module.exports = Repository;