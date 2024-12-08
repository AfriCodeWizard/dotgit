const { describe, it, beforeEach, afterEach } = require('mocha');
const { expect } = require('chai');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const { BranchManager } = require('../src/BranchManager');
const { InvalidHeadError } = require('../src/errors');

describe('BranchManager', () => {
    let testDir;
    let dotgitDir;
    let branchManager;

    beforeEach(async () => {
        // Create temporary test directory
        testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'dotgit-test-'));
        dotgitDir = path.join(testDir, '.dotgit');
        await fs.mkdir(dotgitDir);
        await fs.mkdir(path.join(dotgitDir, 'refs', 'heads'), { recursive: true });
        branchManager = new BranchManager(dotgitDir);
    });

    afterEach(async () => {
        // Clean up test directory
        await fs.rm(testDir, { recursive: true, force: true });
    });

    describe('createBranch()', () => {
        it('should create a new branch', async () => {
            const commitHash = '1234567890abcdef';
            await branchManager.createBranch('test-branch', commitHash);

            const branchPath = path.join(dotgitDir, 'refs', 'heads', 'test-branch');
            const content = await fs.readFile(branchPath, 'utf8');
            expect(content).to.equal(commitHash);
        });

        it('should throw error if branch already exists', async () => {
            await branchManager.createBranch('test-branch', '1234567890abcdef');

            try {
                await branchManager.createBranch('test-branch', 'fedcba0987654321');
                expect.fail('Should have thrown error');
            } catch (error) {
                expect(error.message).to.include('already exists');
            }
        });

        it('should throw error if branch name is invalid', async () => {
            try {
                await branchManager.createBranch('', '1234567890abcdef');
                expect.fail('Should have thrown error');
            } catch (error) {
                expect(error.message).to.include('required');
            }
        });
    });

    describe('getCurrentBranch()', () => {
        it('should return current branch name', async () => {
            await fs.writeFile(
                path.join(dotgitDir, 'HEAD'),
                'ref: refs/heads/main'
            );

            const branch = await branchManager.getCurrentBranch();
            expect(branch).to.equal('main');
        });

        it('should throw error if HEAD is invalid', async () => {
            await fs.writeFile(
                path.join(dotgitDir, 'HEAD'),
                'invalid content'
            );

            try {
                await branchManager.getCurrentBranch();
                expect.fail('Should have thrown error');
            } catch (error) {
                expect(error).to.be.instanceOf(InvalidHeadError);
            }
        });
    });

    describe('listBranches()', () => {
        it('should list all branches', async () => {
            await branchManager.createBranch('main', '1234567890abcdef');
            await branchManager.createBranch('develop', 'fedcba0987654321');
            await fs.writeFile(
                path.join(dotgitDir, 'HEAD'),
                'ref: refs/heads/main'
            );

            const branches = await branchManager.listBranches();
            expect(branches.current).to.equal('main');
            expect(branches.all).to.have.members(['main', 'develop']);
            expect(branches.details).to.have.lengthOf(2);
            expect(branches.details.find(b => b.name === 'main').current).to.be.true;
        });

        it('should return empty list for new repository', async () => {
            const branches = await branchManager.listBranches();
            expect(branches.all).to.be.empty;
            expect(branches.details).to.be.empty;
        });
    });

    describe('switchBranch()', () => {
        it('should update HEAD to point to new branch', async () => {
            await branchManager.createBranch('main', '1234567890abcdef');
            await branchManager.createBranch('develop', 'fedcba0987654321');

            await branchManager.switchBranch('develop');

            const headContent = await fs.readFile(
                path.join(dotgitDir, 'HEAD'),
                'utf8'
            );
            expect(headContent).to.equal('ref: refs/heads/develop');
        });

        it('should throw error for non-existent branch', async () => {
            try {
                await branchManager.switchBranch('nonexistent');
                expect.fail('Should have thrown error');
            } catch (error) {
                expect(error.message).to.include('does not exist');
            }
        });
    });

    describe('deleteBranch()', () => {
        it('should delete branch', async () => {
            await branchManager.createBranch('test-branch', '1234567890abcdef');
            await branchManager.createBranch('main', 'fedcba0987654321');
            await fs.writeFile(
                path.join(dotgitDir, 'HEAD'),
                'ref: refs/heads/main'
            );

            await branchManager.deleteBranch('test-branch');

            const branchExists = await fs.access(
                path.join(dotgitDir, 'refs', 'heads', 'test-branch')
            ).then(() => true).catch(() => false);
            expect(branchExists).to.be.false;
        });

        it('should not allow deleting current branch', async () => {
            await branchManager.createBranch('main', '1234567890abcdef');
            await fs.writeFile(
                path.join(dotgitDir, 'HEAD'),
                'ref: refs/heads/main'
            );

            try {
                await branchManager.deleteBranch('main');
                expect.fail('Should have thrown error');
            } catch (error) {
                expect(error.message).to.include('currently checked out');
            }
        });
    });
});
