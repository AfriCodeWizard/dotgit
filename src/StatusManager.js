const fs = require('fs').promises;
const path = require('path');
const { logger } = require('./Logger');
const { IndexManager } = require('./IndexManager');
const { BranchManager } = require('./BranchManager');
const { RefManager } = require('./RefManager');

class StatusManager {
    constructor(dotgitPath) {
        this.dotgitPath = dotgitPath;
        this.indexManager = new IndexManager(dotgitPath);
        this.branchManager = new BranchManager(dotgitPath);
        this.refManager = new RefManager(dotgitPath);
    }

    async getStatus() {
        await this.indexManager.load();

        const status = {
            branch: await this.getBranchStatus(),
            staged: {
                new: [],
                modified: [],
                deleted: []
            },
            unstaged: {
                modified: [],
                deleted: []
            },
            untracked: [],
            conflicts: []
        };

        const changes = await this.indexManager.getChanges(path.dirname(this.dotgitPath));
        
        // Process staged changes
        for (const file of changes.staged) {
            const entry = this.indexManager.entries.get(file);
            if (!entry) {
                status.staged.new.push(file);
            } else {
                status.staged.modified.push(file);
            }
        }

        // Process unstaged changes
        for (const file of changes.modified) {
            status.unstaged.modified.push(file);
        }
        for (const file of changes.deleted) {
            status.unstaged.deleted.push(file);
        }

        // Process untracked files
        status.untracked = Array.from(changes.untracked);

        // Check for merge conflicts
        status.conflicts = await this.getConflicts();

        return status;
    }

    async getBranchStatus() {
        try {
            const currentBranch = await this.branchManager.getCurrentBranch();
            const head = await this.refManager.getHead();
            const upstream = await this.getUpstreamStatus(currentBranch);

            return {
                current: currentBranch,
                detached: head.type === 'hash',
                upstream
            };
        } catch (error) {
            logger.error(`Error getting branch status: ${error.message}`);
            return {
                current: null,
                detached: false,
                upstream: null
            };
        }
    }

    async getUpstreamStatus(branch) {
        try {
            const remoteBranch = await this.getTrackingBranch(branch);
            if (!remoteBranch) {
                return null;
            }

            const localCommit = await this.refManager.resolveRef(`refs/heads/${branch}`);
            const remoteCommit = await this.refManager.resolveRef(`refs/remotes/${remoteBranch}`);

            if (!localCommit || !remoteCommit) {
                return null;
            }

            const ahead = await this.countCommits(remoteCommit, localCommit);
            const behind = await this.countCommits(localCommit, remoteCommit);

            return {
                upstream: remoteBranch,
                ahead,
                behind
            };
        } catch (error) {
            logger.error(`Error getting upstream status: ${error.message}`);
            return null;
        }
    }

    async getTrackingBranch(branch) {
        try {
            const config = await this.getConfig();
            return config?.branch?.[branch]?.remote;
        } catch (error) {
            return null;
        }
    }

    async countCommits(fromHash, toHash) {
        // This is a simplified version. In a real implementation,
        // you would traverse the commit graph and count commits.
        return 0;
    }

    async getConflicts() {
        try {
            const mergePath = path.join(this.dotgitPath, 'MERGE_HEAD');
            await fs.access(mergePath);
            
            // Read index for conflict markers
            const conflicts = [];
            for (const [file, entry] of this.indexManager.entries) {
                if (entry.conflict) {
                    conflicts.push(file);
                }
            }
            
            return conflicts;
        } catch (error) {
            return [];
        }
    }

    async getConfig() {
        try {
            const configPath = path.join(this.dotgitPath, 'config');
            const content = await fs.readFile(configPath, 'utf8');
            return JSON.parse(content);
        } catch (error) {
            return null;
        }
    }

    formatStatus(status) {
        const lines = [];

        // Branch status
        lines.push(`On branch ${status.branch.current}`);
        if (status.branch.upstream) {
            const { ahead, behind } = status.branch.upstream;
            if (ahead > 0 && behind > 0) {
                lines.push(`Your branch is ${ahead} commits ahead and ${behind} commits behind '${status.branch.upstream.upstream}'`);
            } else if (ahead > 0) {
                lines.push(`Your branch is ${ahead} commits ahead of '${status.branch.upstream.upstream}'`);
            } else if (behind > 0) {
                lines.push(`Your branch is ${behind} commits behind '${status.branch.upstream.upstream}'`);
            }
        }

        // Conflicts
        if (status.conflicts.length > 0) {
            lines.push('\nUnmerged paths:');
            status.conflicts.forEach(file => {
                lines.push(`\tboth modified:\t${file}`);
            });
        }

        // Staged changes
        if (status.staged.new.length || status.staged.modified.length || status.staged.deleted.length) {
            lines.push('\nChanges to be committed:');
            status.staged.new.forEach(file => lines.push(`\tnew file:\t${file}`));
            status.staged.modified.forEach(file => lines.push(`\tmodified:\t${file}`));
            status.staged.deleted.forEach(file => lines.push(`\tdeleted:\t${file}`));
        }

        // Unstaged changes
        if (status.unstaged.modified.length || status.unstaged.deleted.length) {
            lines.push('\nChanges not staged for commit:');
            status.unstaged.modified.forEach(file => lines.push(`\tmodified:\t${file}`));
            status.unstaged.deleted.forEach(file => lines.push(`\tdeleted:\t${file}`));
        }

        // Untracked files
        if (status.untracked.length) {
            lines.push('\nUntracked files:');
            status.untracked.forEach(file => lines.push(`\t${file}`));
        }

        if (!lines.length) {
            lines.push('nothing to commit, working tree clean');
        }

        return lines.join('\n');
    }
}

module.exports = StatusManager;
