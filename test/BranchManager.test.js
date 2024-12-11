const { describe, it, beforeEach, afterEach } = require('mocha');
const { expect } = require('chai');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const BranchManager = require('../src/BranchManager');
const { InvalidHeadError } = require('../src/errors');

const TEST_BRANCH = 'test-branch';
const MAIN_BRANCH = 'main';
const COMMIT_HASH = '1234567890abcdef';

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
            await branchManager.createBranch(TEST_BRANCH, COMMIT_HASH);

            const branchPath = path.join(dotgitDir, 'refs', 'heads', TEST_BRANCH);
            const content = await fs.readFile(branchPath, 'utf8');
            expect(content).to.equal(COMMIT_HASH);
        });

        it('should throw error if branch already exists', async () => {
            await branchManager.createBranch(TEST_BRANCH, COMMIT_HASH);

            try {
                await branchManager.createBranch(TEST_BRANCH, COMMIT_HASH);
                expect.fail('Should have thrown error');
            } catch (error) {
                expect(error.message).to.include('already exists');
            }
        });

        it('should throw error if branch name is invalid', async () => {
            try {
                await branchManager.createBranch('', COMMIT_HASH);
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
            await branchManager.createBranch(MAIN_BRANCH, COMMIT_HASH);
            await branchManager.createBranch('develop', COMMIT_HASH);
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
            await branchManager.createBranch(MAIN_BRANCH, COMMIT_HASH);
            await branchManager.createBranch('develop', COMMIT_HASH);

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
            await branchManager.createBranch(TEST_BRANCH, COMMIT_HASH);
            await branchManager.createBranch(MAIN_BRANCH, COMMIT_HASH);
            await fs.writeFile(
                path.join(dotgitDir, 'HEAD'),
                'ref: refs/heads/main'
            );

            await branchManager.deleteBranch(TEST_BRANCH);

            const branchExists = await fs.access(
                path.join(dotgitDir, 'refs', 'heads', TEST_BRANCH)
            ).then(() => true).catch(() => false);
            expect(branchExists).to.be.false;
        });

        it('should not allow deleting current branch', async () => {
            await branchManager.createBranch(MAIN_BRANCH, COMMIT_HASH);
            await fs.writeFile(
                path.join(dotgitDir, 'HEAD'),
                'ref: refs/heads/main'
            );

            try {
                await branchManager.deleteBranch(MAIN_BRANCH);
                expect.fail('Should have thrown error');
            } catch (error) {
                expect(error.message).to.include('currently checked out');
            }
        });
    });
});
