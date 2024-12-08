const fs = require('fs').promises;
const path = require('path');
const { logger } = require('./Logger');
const { CommitManager } = require('./CommitManager');
const { BranchManager } = require('./BranchManager');

class MergeManager {
    constructor(dotgitPath) {
        this.dotgitPath = dotgitPath;
        this.commitManager = new CommitManager(dotgitPath);
        this.branchManager = new BranchManager(dotgitPath);
        this.mergePath = path.join(dotgitPath, 'MERGE_HEAD');
    }

    async merge(sourceBranch, options = {}) {
        const targetBranch = await this.branchManager.getCurrentBranch();
        logger.info(`Merging '${sourceBranch}' into '${targetBranch}'`);

        // Get commit hashes
        const sourceCommit = await this.branchManager.getBranchCommit(sourceBranch);
        const targetCommit = await this.branchManager.getCurrentCommit();

        // Find merge base
        const mergeBase = await this.findMergeBase(sourceCommit, targetCommit);
        logger.debug(`Merge base: ${mergeBase}`);

        // Get changes from merge base to both branches
        const sourceChanges = await this.getChangesSinceCommit(mergeBase, sourceCommit);
        const targetChanges = await this.getChangesSinceCommit(mergeBase, targetCommit);

        // Detect conflicts
        const conflicts = this.detectConflicts(sourceChanges, targetChanges);
        
        if (conflicts.length > 0) {
            if (options.force) {
                logger.warn('Force merging despite conflicts');
            } else {
                await this.writeMergeState(sourceCommit);
                throw new Error(`Merge conflicts found in: ${conflicts.join(', ')}`);
            }
        }

        // Perform merge
        const mergedTree = await this.mergeTrees(
            mergeBase,
            sourceCommit,
            targetCommit,
            conflicts,
            options
        );

        // Create merge commit
        const message = `Merge branch '${sourceBranch}' into ${targetBranch}`;
        const mergeCommit = await this.commitManager.createCommit(
            mergedTree,
            message,
            [targetCommit, sourceCommit]
        );

        // Update current branch
        await this.branchManager.updateBranch(targetBranch, mergeCommit);
        await this.clearMergeState();

        logger.success(`Successfully merged '${sourceBranch}' into '${targetBranch}'`);
        return mergeCommit;
    }

    async findMergeBase(commit1, commit2) {
        const history1 = await this.getCommitHistory(commit1);
        const history2 = await this.getCommitHistory(commit2);
        
        const set1 = new Set(history1);
        for (const commit of history2) {
            if (set1.has(commit)) {
                return commit;
            }
        }
        
        return null;
    }

    async getChangesSinceCommit(baseCommit, targetCommit) {
        const changes = new Map();
        const history = await this.commitManager.getCommitHistory(targetCommit);
        
        for (const commit of history) {
            if (commit.hash === baseCommit) break;
            
            const diff = await this.commitManager.getCommitDiff(commit.parent, commit.hash);
            for (const [type, files] of Object.entries(diff)) {
                for (const file of files) {
                    changes.set(file, { type, commit: commit.hash });
                }
            }
        }
        
        return changes;
    }

    detectConflicts(changes1, changes2) {
        const conflicts = [];
        
        for (const [file, change1] of changes1) {
            const change2 = changes2.get(file);
            if (change2 && change1.type !== 'deleted' && change2.type !== 'deleted') {
                conflicts.push(file);
            }
        }
        
        return conflicts;
    }

    async mergeTrees(baseCommit, sourceCommit, targetCommit, conflicts, options) {
        const baseTree = baseCommit ? await this.getTree(baseCommit) : {};
        const sourceTree = await this.getTree(sourceCommit);
        const targetTree = await this.getTree(targetCommit);
        
        const mergedTree = { ...targetTree };
        
        for (const [path, sourceData] of Object.entries(sourceTree)) {
            if (conflicts.includes(path)) {
                if (options.force) {
                    mergedTree[path] = sourceData;
                } else {
                    mergedTree[path] = this.createConflictMarkers(
                        path,
                        baseTree[path],
                        targetTree[path],
                        sourceData
                    );
                }
            } else if (!targetTree[path] || !baseTree[path]) {
                mergedTree[path] = sourceData;
            }
        }
        
        return mergedTree;
    }

    async getTree(commitHash) {
        const commit = await this.commitManager.getCommit(commitHash);
        return JSON.parse(await this.commitManager.getObject(commit.tree));
    }

    createConflictMarkers(path, base, target, source) {
        return {
            content: [
                '<<<<<<< HEAD',
                target?.content || '',
                '=======',
                source?.content || '',
                '>>>>>>> source'
            ].join('\n'),
            hash: null,
            conflict: true
        };
    }

    async writeMergeState(sourceCommit) {
        await fs.writeFile(this.mergePath, sourceCommit);
    }

    async clearMergeState() {
        try {
            await fs.unlink(this.mergePath);
        } catch (error) {
            if (error.code !== 'ENOENT') throw error;
        }
    }

    async isMerging() {
        try {
            await fs.access(this.mergePath);
            return true;
        } catch {
            return false;
        }
    }
}

module.exports = MergeManager;
