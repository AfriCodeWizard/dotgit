const path = require('path');
const FileNode = require('./FileNode');

/**
 * Represents a tree of files in the working directory
 */
class FileTree {
    constructor() {
        this.files = new Map();
    }

    /**
     * Add a file to the tree
     * @param {FileNode} fileNode 
     */
    addFile(fileNode) {
        this.files.set(fileNode.path, fileNode);
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
}

module.exports = FileTree;