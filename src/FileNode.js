const crypto = require('crypto');
const fs = require('fs').promises;
const isBinary = require('is-binary-buffer');
const { logger } = require('./Logger'); // Assuming you have a logger utility

/**
 * Represents a file in the working directory
 */
class FileNode {
    /**
     * @param {string} path - Path to the file
     * @param {Buffer} content - File content
     */
    constructor(path, content) {
        this.path = path;
        this.content = content;
        this.hash = this.calculateHash();
        this.isBinary = isBinary(content);

        // Log file processing
        logger.debug(`FileNode created for: ${this.path}`);
        logger.debug(`Is Binary: ${this.isBinary ? 'Yes' : 'No'}`);
        logger.debug(`File Hash: ${this.hash}`);
    }

    /**
     * Calculate SHA-1 hash of file content
     * @returns {string} Hash of the file content
     */
    calculateHash() {
        const hash = crypto.createHash('sha1');
        hash.update(this.content);
        return hash.digest('hex');
    }

    /**
     * Create FileNode from a file path
     * @param {string} path - Path to the file
     * @returns {Promise<FileNode>}
     */
    static async fromPath(path) {
        try {
            const content = await fs.readFile(path);
            return new FileNode(path, content);
        } catch (error) {
            logger.error(`Failed to read file at ${path}: ${error.message}`);
            throw new Error(`Failed to read file at ${path}: ${error.message}`);
        }
    }

    /**
     * Get string representation of file content
     * @returns {string}
     */
    toString() {
        return this.isBinary ? '[Binary Content]' : this.content.toString('utf8');
    }
}

module.exports = FileNode;
