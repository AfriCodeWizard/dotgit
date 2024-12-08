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
        this.headFile = path.join(this.dotgitDir, 'HEAD');
    }

    /**
     * Initialize a new repository
     * @returns {Promise<void>}
     */
    async init() {
        // Create .dotgit directory structure
        await fs.mkdir(this.dotgitDir);
        await fs.mkdir(this.objectsDir);
        
        // Initialize HEAD to point to no commit
        await fs.writeFile(this.headFile, '');
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
        // Implementation to scan working directory and create FileTree
        // This would use glob or similar to find all files
        return new FileTree();
    }

    /**
     * Get the current commit hash
     * @returns {Promise<string|null>}
     */
    async getCurrentCommit() {
        try {
            const head = await fs.readFile(this.headFile, 'utf8');
            return head.trim() || null;
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
}

module.exports = Repository;