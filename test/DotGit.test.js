const { describe, it, beforeEach, afterEach } = require('mocha');
const { expect } = require('chai');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const { DotGit } = require('../src/DotGit');

describe('DotGit', () => {
    let testDir;
    let dotgit;

    beforeEach(async () => {
        // Create temporary test directory
        testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'dotgit-test-'));
        dotgit = new DotGit(testDir);
    });

    afterEach(async () => {
        // Clean up test directory
        await fs.rm(testDir, { recursive: true, force: true });
    });

    describe('init()', () => {
        it('should initialize new repository', async () => {
            await dotgit.init();

            // Verify directory structure
            const dotgitExists = await fs.stat(path.join(testDir, '.dotgit'))
                .then(stats => stats.isDirectory())
                .catch(() => false);
            expect(dotgitExists).to.be.true;

            // Verify components are initialized
            const configExists = await fs.access(path.join(testDir, '.dotgit', 'config'))
                .then(() => true)
                .catch(() => false);
            expect(configExists).to.be.true;

            const headExists = await fs.access(path.join(testDir, '.dotgit', 'HEAD'))
                .then(() => true)
                .catch(() => false);
            expect(headExists).to.be.true;
        });

        it('should throw error if repository already exists', async () => {
            await dotgit.init();
            
            try {
                await dotgit.init();
                expect.fail('Should have thrown error');
            } catch (error) {
                expect(error.message).to.include('already exists');
            }
        });
    });

    describe('add()', () => {
        beforeEach(async () => {
            await dotgit.init();
        });

        it('should stage single file', async () => {
            const file = path.join(testDir, 'test.txt');
            await fs.writeFile(file, 'content');

            await dotgit.add(['test.txt']);
            const status = await dotgit.statusManager.getStatus();
            expect(status.staged.new).to.include(file);
        });

        it('should stage multiple files', async () => {
            await fs.writeFile(path.join(testDir, 'file1.txt'), 'content1');
            await fs.writeFile(path.join(testDir, 'file2.txt'), 'content2');

            await dotgit.add(['file1.txt', 'file2.txt']);
            const status = await dotgit.statusManager.getStatus();
            expect(status.staged.new).to.have.lengthOf(2);
        });

        it('should handle file patterns', async () => {
            await fs.writeFile(path.join(testDir, 'test1.js'), 'content');
            await fs.writeFile(path.join(testDir, 'test2.js'), 'content');
            await fs.writeFile(path.join(testDir, 'other.txt'), 'content');

            await dotgit.add(['*.js']);
            const status = await dotgit.statusManager.getStatus();
            expect(status.staged.new).to.have.lengthOf(2);
        });
    });

    describe('commit()', () => {
        beforeEach(async () => {
            await dotgit.init();
        });

        it('should create commit with staged changes', async () => {
            await fs.writeFile(path.join(testDir, 'test.txt'), 'content');
            await dotgit.add(['test.txt']);

            const hash = await dotgit.commit('Test commit');
            expect(hash).to.be.a('string');

            const commit = await dotgit.commitManager.getCommit(hash);
            expect(commit.message).to.equal('Test commit');
        });

        it('should throw error if nothing staged', async () => {
            try {
                await dotgit.commit('Empty commit');
                expect.fail('Should have thrown error');
            } catch (error) {
                expect(error.message).to.include('nothing to commit');
            }
        });
    });

    describe('branch operations', () => {
        beforeEach(async () => {
            await dotgit.init();
            await fs.writeFile(path.join(testDir, 'test.txt'), 'content');
            await dotgit.add(['test.txt']);
            await dotgit.commit('Initial commit');
        });

        it('should create branch', async () => {
            await dotgit.branch('develop');
            const branches = await dotgit.branchManager.listBranches();
            expect(branches.all).to.include('develop');
        });

        it('should switch branch', async () => {
            await dotgit.branch('develop');
            await dotgit.checkout('develop');
            
            const status = await dotgit.statusManager.getStatus();
            expect(status.branch.current).to.equal('develop');
        });

        it('should delete branch', async () => {
            await dotgit.branch('develop');
            await dotgit.deleteBranch('develop');
            
            const branches = await dotgit.branchManager.listBranches();
            expect(branches.all).to.not.include('develop');
        });
    });

    describe('remote operations', () => {
        beforeEach(async () => {
            await dotgit.init();
        });

        it('should add remote', async () => {
            await dotgit.remote('add', 'origin', 'https://example.com/repo.git');
            const remotes = await dotgit.remoteManager.listRemotes();
            expect(remotes).to.include('origin');
        });

        it('should remove remote', async () => {
            await dotgit.remote('add', 'origin', 'https://example.com/repo.git');
            await dotgit.remote('remove', 'origin');
            
            const remotes = await dotgit.remoteManager.listRemotes();
            expect(remotes).to.not.include('origin');
        });
    });

    describe('status()', () => {
        beforeEach(async () => {
            await dotgit.init();
        });

        it('should show repository status', async () => {
            await fs.writeFile(path.join(testDir, 'staged.txt'), 'content');
            await dotgit.add(['staged.txt']);
            await fs.writeFile(path.join(testDir, 'unstaged.txt'), 'content');

            const status = await dotgit.status();
            expect(status).to.include('staged.txt');
            expect(status).to.include('unstaged.txt');
        });
    });

    describe('diff()', () => {
        beforeEach(async () => {
            await dotgit.init();
        });

        it('should show unstaged changes', async () => {
            const file = path.join(testDir, 'test.txt');
            await fs.writeFile(file, 'initial');
            await dotgit.add(['test.txt']);
            await dotgit.commit('Initial commit');
            
            await fs.writeFile(file, 'modified');
            
            const diff = await dotgit.diffManager.getChanges();
            expect(diff).to.include('-initial');
            expect(diff).to.include('+modified');
        });

        it('should show staged changes', async () => {
            const file = path.join(testDir, 'test.txt');
            await fs.writeFile(file, 'initial');
            await dotgit.add(['test.txt']);
            await dotgit.commit('Initial commit');
            
            await fs.writeFile(file, 'modified');
            await dotgit.add(['test.txt']);
            
            const diff = await dotgit.diffManager.getChanges({ staged: true });
            expect(diff).to.include('-initial');
            expect(diff).to.include('+modified');
        });
    });

    describe('config()', () => {
        beforeEach(async () => {
            await dotgit.init();
        });

        it('should set and get config values', async () => {
            await dotgit.configManager.set('user', 'name', 'Test User');
            const name = await dotgit.configManager.get('user', 'name');
            expect(name).to.equal('Test User');
        });
    });
});
