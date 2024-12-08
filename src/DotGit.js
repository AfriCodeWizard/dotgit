const fs = require('fs').promises;
const path = require('path');
const { logger } = require('./Logger');
const { Repository } = require('./Repository');
const { BranchManager } = require('./BranchManager');
const { CommitManager } = require('./CommitManager');
const { ConfigManager } = require('./ConfigManager');
const { DiffManager } = require('./DiffManager');
const { IndexManager } = require('./IndexManager');
const { MergeManager } = require('./MergeManager');
const { RefManager } = require('./RefManager');
const { RemoteManager } = require('./RemoteManager');
const { StatusManager } = require('./StatusManager');

class DotGit {
    constructor(rootDir = '.') {
        this.rootDir = path.resolve(rootDir);
        this.dotgitPath = path.join(this.rootDir, '.dotgit');

        // Initialize all managers
        this.repository = new Repository(this.rootDir);
        this.branchManager = new BranchManager(this.dotgitPath);
        this.commitManager = new CommitManager(this.dotgitPath);
        this.configManager = new ConfigManager(this.dotgitPath);
        this.diffManager = new DiffManager(this.dotgitPath);
        this.indexManager = new IndexManager(this.dotgitPath);
        this.mergeManager = new MergeManager(this.dotgitPath);
        this.refManager = new RefManager(this.dotgitPath);
        this.remoteManager = new RemoteManager(this.dotgitPath);
        this.statusManager = new StatusManager(this.dotgitPath);
    }

    async init() {
        try {
            // Check if repository already exists
            const exists = await this.repository.isRepository();
            if (exists) {
                throw new Error('Repository already exists');
            }

            // Create .dotgit directory structure
            await fs.mkdir(this.dotgitPath);
            logger.info(`Initialized empty DotGit repository in ${this.dotgitPath}`);

            // Initialize all components
            await this.repository.init();
            await this.configManager.load();
            await this.refManager.init();
            await this.remoteManager.init();
            await this.indexManager.load();

            // Set up initial configuration
            await this.configManager.setUser(process.env.USER || 'unknown', '');
            await this.configManager.setDefaultBranch('main');

            return true;
        } catch (error) {
            logger.error(`Failed to initialize repository: ${error.message}`);
            throw error;
        }
    }

    async add(patterns) {
        try {
            await this.indexManager.load();
            const files = await this.expandFilePatterns(patterns);
            
            for (const file of files) {
                const content = await fs.readFile(file);
                await this.indexManager.add(file, content);
            }
            
            logger.info(`Added ${files.length} files to staging area`);
        } catch (error) {
            logger.error(`Failed to add files: ${error.message}`);
            throw error;
        }
    }

    async commit(message) {
        try {
            await this.indexManager.load();
            const tree = await this.indexManager.writeTree();
            
            const parent = await this.refManager.getCurrentCommit();
            const hash = await this.commitManager.createCommit(tree, message, parent);
            
            await this.refManager.updateCurrentBranch(hash);
            await this.indexManager.clear();
            
            logger.success(`[${hash.slice(0, 7)}] ${message}`);
            return hash;
        } catch (error) {
            logger.error(`Failed to commit: ${error.message}`);
            throw error;
        }
    }

    async status() {
        try {
            const status = await this.statusManager.getStatus();
            console.log(this.statusManager.formatStatus(status));
        } catch (error) {
            logger.error(`Failed to get status: ${error.message}`);
            throw error;
        }
    }

    async branch(name, options = {}) {
        try {
            if (name) {
                await this.branchManager.createBranch(name, options.startPoint);
                if (options.checkout) {
                    await this.checkout(name);
                }
            } else {
                const branches = await this.branchManager.listBranches();
                this.printBranches(branches);
            }
        } catch (error) {
            logger.error(`Branch operation failed: ${error.message}`);
            throw error;
        }
    }

    async checkout(ref) {
        try {
            await this.indexManager.load();
            const status = await this.statusManager.getStatus();
            
            if (this.hasUncommittedChanges(status)) {
                throw new Error('You have uncommitted changes');
            }
            
            await this.branchManager.switchBranch(ref);
            logger.info(`Switched to branch '${ref}'`);
        } catch (error) {
            logger.error(`Checkout failed: ${error.message}`);
            throw error;
        }
    }

    async merge(branch, options = {}) {
        try {
            const result = await this.mergeManager.merge(branch, options);
            if (result.conflicts) {
                logger.warn('Merge conflicts detected. Please resolve conflicts and commit');
            } else {
                logger.success('Merge completed successfully');
            }
            return result;
        } catch (error) {
            logger.error(`Merge failed: ${error.message}`);
            throw error;
        }
    }

    async remote(command, name, url) {
        try {
            switch (command) {
                case 'add':
                    await this.remoteManager.addRemote(name, url);
                    break;
                case 'remove':
                    await this.remoteManager.removeRemote(name);
                    break;
                default:
                    const remotes = await this.remoteManager.listRemotes(true);
                    this.printRemotes(remotes);
            }
        } catch (error) {
            logger.error(`Remote operation failed: ${error.message}`);
            throw error;
        }
    }

    async diff(options = {}) {
        try {
            const changes = await this.diffManager.getChanges(options);
            console.log(changes);
        } catch (error) {
            logger.error(`Diff failed: ${error.message}`);
            throw error;
        }
    }

    // Helper methods
    async expandFilePatterns(patterns) {
        // Implementation for expanding file patterns (e.g., *.js)
        return [];
    }

    hasUncommittedChanges(status) {
        return (
            status.staged.new.length > 0 ||
            status.staged.modified.length > 0 ||
            status.staged.deleted.length > 0 ||
            status.unstaged.modified.length > 0 ||
            status.unstaged.deleted.length > 0
        );
    }

    printBranches(branches) {
        branches.forEach(branch => {
            const prefix = branch.current ? '* ' : '  ';
            console.log(`${prefix}${branch.name}`);
        });
    }

    printRemotes(remotes) {
        remotes.forEach(remote => {
            console.log(`${remote.name}\t${remote.url}`);
        });
    }
}

module.exports = DotGit;
