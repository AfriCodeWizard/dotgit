const fs = require('fs').promises;
const path = require('path');
const { FileTree } = require('./FileTree');

async function getWorkingDirectoryFiles(_options = { useCache: true }) {
    const tree = new FileTree();
    const ig = getIgnoreRules();
    const processedPaths = new Set();
    const BATCH_SIZE = 1000;

    async function processDirectory(dir = '.') {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        const files = [];
        
        // Process entries in batches
        for (let i = 0; i < entries.length; i += BATCH_SIZE) {
            const batch = entries.slice(i, i + BATCH_SIZE);
            await Promise.all(batch.map(async (entry) => {
                const fullPath = path.join(dir, entry.name);
                const relativePath = fullPath === '.' ? entry.name : fullPath;
                
                if (processedPaths.has(fullPath) || ig.ignores(relativePath)) {
                    return;
                }
                
                processedPaths.add(fullPath);
                
                try {
                    if (entry.isDirectory()) {
                        await processDirectory(relativePath);
                    } else if (entry.isFile()) {
                        files.push({ path: relativePath, entry });
                    }
                } catch (error) {
                    console.warn(`Warning: Failed to process ${fullPath}: ${error.message}`);
                }
            }));
        }

        // Process file contents in parallel
        await Promise.all(files.map(async ({ path: filePath }) => {
            try {
                const content = await fs.readFile(filePath);
                await tree.addFile(filePath, content);
            } catch (error) {
                console.warn(`Warning: Failed to read file ${filePath}: ${error.message}`);
            }
        }));
    }

    await processDirectory();
    return tree;
}

async function hasUncommittedChanges() {
    try {
        const dotgitPath = path.resolve('.dotgit');
        
        // Initialize and load ignore rules
        const ignoreManager = new IgnoreManager();
        await ignoreManager.loadIgnoreFile();
        
        // Print current ignore rules
        ignoreManager.printRules();
        
        // Get staged files
        const staging = new StagingArea(dotgitPath);
        await staging.load();
        
        console.log('\nChecking for uncommitted changes:');
        console.log('--------------------------------');
        
        // Get working directory files (excluding ignored files)
        const workingFiles = glob.sync('**/*', { 
            nodir: true,
            ignore: ['.dotgit/**', '.dotgitignore']
        }).filter(file => !ignoreManager.isIgnored(file));

        console.log('Working directory files (after ignore rules):', workingFiles);
        
        // Get last commit state
        const lastCommitHash = await repoOps.getCurrentCommitHash();
        console.log('Last commit hash:', lastCommitHash);

        if (!lastCommitHash) {
            const hasFiles = workingFiles.length > 0;
            console.log('No previous commits. Has files:', hasFiles);
            return hasFiles;
        }

        // Get last commit tree
        const lastCommitTree = await repoOps.getCommitTree(lastCommitHash);
        const lastCommitFiles = Object.keys(lastCommitTree.toObject());
        
        // Compare files
        const changes = {
            new: workingFiles.filter(file => !lastCommitFiles.includes(file)),
            missing: lastCommitFiles.filter(file => !workingFiles.includes(file)),
            staged: Array.from(staging.stagedFiles.keys())
        };

        console.log('\nChanges detected:');
        console.log('New files:', changes.new);
        console.log('Missing files:', changes.missing);
        console.log('Staged files:', changes.staged);

        const hasChanges = changes.new.length > 0 || 
                          changes.missing.length > 0 || 
                          changes.staged.length > 0;

        console.log('Has uncommitted changes:', hasChanges);
        return hasChanges;

    } catch (error) {
        console.error('Error in hasUncommittedChanges:', error);
        throw error;
    }
}

module.exports = {
    getWorkingDirectoryFiles,
    hasUncommittedChanges
};
