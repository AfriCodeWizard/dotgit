const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const crypto = require('crypto');
const glob = require('glob');
const isBinary = require('is-binary-buffer');
const ignore = require('ignore');
const lockfile = require('proper-lockfile');
const { logger } = require('./Logger'); // Assuming you have a logger utility

const FileNode = require('./FileNode');

// Cache for file metadata to reduce filesystem operations
const metadataCache = new Map();
const CACHE_TTL = 5000; // 5 seconds

/**
 * Represents a tree of files in the working directory
 */
class FileTree {
    constructor() {
        this.files = new Map(); // Using Map for fast lookup
        this.root = new FileNode('');
        this.fileCount = 0;
        this.totalSize = 0;
    }

    /**
     * Add a file to the tree
     * @param {FileNode} fileNode 
     */
    addFile(fileNode) {
        if (!this.files.has(fileNode.path)) {
            this.files.set(fileNode.path, fileNode);
            this.fileCount++;
            this.totalSize += fileNode.content.length;
        }
    }

    /**
     * Get a file from the tree
     * @param {string} filePath 
     * @returns {FileNode|undefined}
     */
    getFile(filePath) {
        return this.files.get(filePath);
    }

    /**
     * Get all files in the tree
     * @returns {FileNode[]}
     */
    getAllFiles() {
        return Array.from(this.files.values());
    }

    /**
     * Create a FileTree from an array of file paths
     * @param {string[]} filePaths 
     * @returns {Promise<FileTree>}
     */
    static async fromPaths(filePaths) {
        const tree = new FileTree();
        
        for (const filePath of filePaths) {
            const fileNode = await FileNode.fromPath(filePath);
            tree.addFile(fileNode);
        }

        return tree;
    }

    /**
     * Get the hash of the entire tree
     * @returns {string}
     */
    getHash() {
        const sortedFiles = Array.from(this.files.values())
            .sort((a, b) => a.path.localeCompare(b.path));
        
        return sortedFiles
            .map(file => `${file.path} ${file.hash}`)
            .join('\n');
    }

    /**
     * Cache file metadata to avoid redundant file reads.
     * @param {string} filePath - The file path to cache.
     * @returns {Promise<FileNode>}
     */
    static async getFileMetadata(filePath) {
        const cached = metadataCache.get(filePath);
        if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
            return cached.fileNode;
        }

        try {
            const fileNode = await FileNode.fromPath(filePath);
            metadataCache.set(filePath, { fileNode, timestamp: Date.now() });
            return fileNode;
        } catch (error) {
            logger.error(`Failed to read file metadata for ${filePath}: ${error.message}`);
            throw new Error(`Failed to read file metadata for ${filePath}: ${error.message}`);
        }
    }

    /**
     * Expand file patterns using glob
     * @param {string[]} patterns 
     * @returns {Promise<string[]>}
     */
    static async expandFilePatterns(patterns) {
        return new Promise((resolve, reject) => {
            glob(patterns.join(' '), (err, files) => {
                if (err) {
                    return reject(err);
                }
                resolve(files);
            });
        });
    }

    /**
     * Exclude files based on .gitignore-style rules
     * @param {string[]} filePaths - Array of file paths to check
     * @param {string} gitignorePath - Path to the .gitignore file
     * @returns {Promise<string[]>} - Filtered file paths
     */
    static async filterIgnoredFiles(filePaths, gitignorePath) {
        try {
            const ig = ignore();
            const gitignoreContent = await fs.readFile(gitignorePath, 'utf8');
            ig.add(gitignoreContent);

            return filePaths.filter(filePath => !ig.ignores(filePath));
        } catch (error) {
            logger.error(`Failed to filter ignored files: ${error.message}`);
            throw new Error(`Failed to filter ignored files: ${error.message}`);
        }
    }

    /**
     * Lock file operation (example usage of lockfile)
     * @param {string} filePath - The path of the file to lock
     * @returns {Promise<void>}
     */
    static async lockFile(filePath) {
        const lockFilePath = `${filePath}.lock`;

        try {
            await lockfile.lock(lockFilePath);
            logger.debug(`Successfully locked file: ${filePath}`);
        } catch (error) {
            logger.error(`Failed to lock file: ${filePath}: ${error.message}`);
            throw new Error(`Failed to lock file: ${filePath}`);
        }
    }

    /**
     * Unlock the file after operation
     * @param {string} filePath - The path of the file to unlock
     * @returns {Promise<void>}
     */
    static async unlockFile(filePath) {
        const lockFilePath = `${filePath}.lock`;

        try {
            await lockfile.unlock(lockFilePath);
            logger.debug(`Successfully unlocked file: ${filePath}`);
        } catch (error) {
            logger.error(`Failed to unlock file: ${filePath}: ${error.message}`);
            throw new Error(`Failed to unlock file: ${filePath}`);
        }
    }
}

module.exports = FileTree;
