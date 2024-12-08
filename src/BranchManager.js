const fs = require('fs').promises;
const path = require('path');
const { logger } = require('./Logger');
const { InvalidHeadError } = require('./errors');

class BranchManager {
    constructor(dotgitPath) {
        this.dotgitPath = dotgitPath;
        this.refsPath = path.join(dotgitPath, 'refs', 'heads');
        this.headPath = path.join(dotgitPath, 'HEAD');
    }

    async createBranch(branchName, startPoint) {
        if (!branchName || typeof branchName !== 'string') {
            throw new Error('Branch name is required');
        }

        const branchPath = path.join(this.refsPath, branchName);

        // Check if branch already exists
        try {
            await fs.access(branchPath);
            throw new Error(`Branch '${branchName}' already exists`);
        } catch (error) {
            if (error.code !== 'ENOENT') throw error;
        }

        // Create branch pointing to startPoint or current HEAD
        const commitHash = startPoint || await this.getCurrentCommit();
        if (!commitHash) {
            throw new Error('No commit hash available for branch creation');
        }

        await fs.mkdir(path.dirname(branchPath), { recursive: true });
        await fs.writeFile(branchPath, commitHash);
        logger.info(`Created branch '${branchName}' at ${commitHash}`);

        return commitHash;
    }

    async getCurrentBranch() {
        try {
            const headContent = await fs.readFile(this.headPath, 'utf8');
            const match = headContent.match(/^ref: refs\/heads\/(.+)$/);
            
            if (!match) {
                throw new InvalidHeadError('HEAD is not pointing to a branch');
            }

            return match[1];
        } catch (error) {
            if (error.code === 'ENOENT') {
                throw new InvalidHeadError('HEAD file not found');
            }
            throw error;
        }
    }

    async listBranches() {
        try {
            const branches = await fs.readdir(this.refsPath);
            const currentBranch = await this.getCurrentBranch();
            
            return {
                current: currentBranch,
                all: branches,
                details: await Promise.all(
                    branches.map(async branch => ({
                        name: branch,
                        commit: await this.getBranchCommit(branch),
                        current: branch === currentBranch
                    }))
                )
            };
        } catch (error) {
            if (error.code === 'ENOENT') {
                return { current: null, all: [], details: [] };
            }
            throw error;
        }
    }

    async switchBranch(branchName) {
        const branchPath = path.join(this.refsPath, branchName);
        
        // Check if branch exists
        try {
            await fs.access(branchPath);
        } catch (error) {
            throw new Error(`Branch '${branchName}' does not exist`);
        }

        // Update HEAD to point to new branch
        await fs.writeFile(this.headPath, `ref: refs/heads/${branchName}`);
        logger.info(`Switched to branch '${branchName}'`);
    }

    async deleteBranch(branchName, force = false) {
        const currentBranch = await this.getCurrentBranch();
        if (branchName === currentBranch) {
            throw new Error('Cannot delete the currently checked out branch');
        }

        const branchPath = path.join(this.refsPath, branchName);
        
        try {
            await fs.unlink(branchPath);
            logger.info(`Deleted branch '${branchName}'`);
        } catch (error) {
            if (error.code === 'ENOENT') {
                throw new Error(`Branch '${branchName}' does not exist`);
            }
            throw error;
        }
    }

    async getBranchCommit(branchName) {
        const branchPath = path.join(this.refsPath, branchName);
        try {
            return (await fs.readFile(branchPath, 'utf8')).trim();
        } catch (error) {
            if (error.code === 'ENOENT') {
                throw new Error(`Branch '${branchName}' does not exist`);
            }
            throw error;
        }
    }

    async getCurrentCommit() {
        try {
            const currentBranch = await this.getCurrentBranch();
            return await this.getBranchCommit(currentBranch);
        } catch (error) {
            if (error instanceof InvalidHeadError) {
                // HEAD might be detached
                const headContent = await fs.readFile(this.headPath, 'utf8');
                return headContent.trim();
            }
            throw error;
        }
    }
}

module.exports = BranchManager;
