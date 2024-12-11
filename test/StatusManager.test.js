const { describe, it, beforeEach, afterEach } = require('mocha');
const { expect } = require('chai');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const  StatusManager  = require('../src/StatusManager');


describe('StatusManager', () => {
    let testDir;
    let dotgitDir;
    let workDir;
    let statusManager;

    beforeEach(async () => {
        // Create temporary test directory
        testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'dotgit-test-'));
        dotgitDir = path.join(testDir, '.dotgit');
        workDir = path.join(testDir, 'work');
        await fs.mkdir(dotgitDir);
        await fs.mkdir(workDir);
        await fs.mkdir(path.join(dotgitDir, 'refs', 'heads'), { recursive: true });
        statusManager = new StatusManager(dotgitDir);
    });

    afterEach(async () => {
        // Clean up test directory
        await fs.rm(testDir, { recursive: true, force: true });
    });

    describe('getStatus()', () => {
        beforeEach(async () => {
            // Initialize required components
            await statusManager.indexManager.load();
            await fs.writeFile(
                path.join(dotgitDir, 'HEAD'),
                'ref: refs/heads/main'
            );
        });

        it('should show clean status for new repository', async () => {
            const status = await statusManager.getStatus();
            expect(status.branch.current).to.equal('main');
            expect(status.staged.new).to.be.empty;
            expect(status.staged.modified).to.be.empty;
            expect(status.staged.deleted).to.be.empty;
            expect(status.unstaged.modified).to.be.empty;
            expect(status.unstaged.deleted).to.be.empty;
            expect(status.untracked).to.be.empty;
        });

        it('should detect staged new file', async () => {
            const file = path.join(workDir, 'new.txt');
            await fs.writeFile(file, 'content');
            await statusManager.indexManager.add(file, Buffer.from('content'));

            const status = await statusManager.getStatus();
            expect(status.staged.new).to.include(file);
        });

        it('should detect staged modified file', async () => {
            const file = path.join(workDir, 'test.txt');
            
            // Add initial version
            await fs.writeFile(file, 'initial');
            await statusManager.indexManager.add(file, Buffer.from('initial'));
            await statusManager.indexManager.save();
            
            // Modify and stage
            await fs.writeFile(file, 'modified');
            await statusManager.indexManager.add(file, Buffer.from('modified'));

            const status = await statusManager.getStatus();
            expect(status.staged.modified).to.include(file);
        });

        it('should detect unstaged modified file', async () => {
            const file = path.join(workDir, 'test.txt');
            
            // Add and commit file
            await fs.writeFile(file, 'initial');
            await statusManager.indexManager.add(file, Buffer.from('initial'));
            await statusManager.indexManager.save();
            
            // Modify file
            await fs.writeFile(file, 'modified');

            const status = await statusManager.getStatus();
            expect(status.unstaged.modified).to.include(file);
        });

        it('should detect deleted file', async () => {
            const file = path.join(workDir, 'test.txt');
            
            // Add and commit file
            await fs.writeFile(file, 'content');
            await statusManager.indexManager.add(file, Buffer.from('content'));
            await statusManager.indexManager.save();
            
            // Delete file
            await fs.unlink(file);

            const status = await statusManager.getStatus();
            expect(status.unstaged.deleted).to.include(file);
        });

        it('should detect untracked file', async () => {
            const file = path.join(workDir, 'untracked.txt');
            await fs.writeFile(file, 'content');

            const status = await statusManager.getStatus();
            expect(status.untracked).to.include(file);
        });
    });

    describe('getBranchStatus()', () => {
        beforeEach(async () => {
            await fs.writeFile(
                path.join(dotgitDir, 'HEAD'),
                'ref: refs/heads/main'
            );
        });

        it('should get current branch status', async () => {
            const status = await statusManager.getBranchStatus();
            expect(status.current).to.equal('main');
        });

        it('should detect detached HEAD', async () => {
            await fs.writeFile(
                path.join(dotgitDir, 'HEAD'),
                '1234567890abcdef'
            );

            const status = await statusManager.getBranchStatus();
            expect(status.detached).to.be.true;
        });

        it('should include upstream information', async () => {
            // Set up upstream tracking
            await fs.writeFile(
                path.join(dotgitDir, 'refs', 'remotes', 'origin', 'main'),
                '1234567890abcdef'
            );
            await statusManager.configManager.set(
                'branch.main',
                'remote',
                'origin'
            );
            await statusManager.configManager.set(
                'branch.main',
                'merge',
                'refs/heads/main'
            );

            const status = await statusManager.getBranchStatus();
            expect(status.upstream).to.exist;
            expect(status.upstream.remote).to.equal('origin');
        });
    });

    describe('formatStatus()', () => {
        it('should format clean status', async () => {
            const status = {
                branch: { current: 'main' },
                staged: { new: [], modified: [], deleted: [] },
                unstaged: { modified: [], deleted: [] },
                untracked: [],
                conflicts: []
            };

            const output = await statusManager.formatStatus(status);
            expect(output).to.include('On branch main');
            expect(output).to.include('nothing to commit');
        });

        it('should format staged changes', async () => {
            const status = {
                branch: { current: 'main' },
                staged: {
                    new: ['new.txt'],
                    modified: ['modified.txt'],
                    deleted: ['deleted.txt']
                },
                unstaged: { modified: [], deleted: [] },
                untracked: [],
                conflicts: []
            };

            const output = await statusManager.formatStatus(status);
            expect(output).to.include('Changes to be committed');
            expect(output).to.include('new file:');
            expect(output).to.include('modified:');
            expect(output).to.include('deleted:');
        });

        it('should format unstaged changes', async () => {
            const status = {
                branch: { current: 'main' },
                staged: { new: [], modified: [], deleted: [] },
                unstaged: {
                    modified: ['modified.txt'],
                    deleted: ['deleted.txt']
                },
                untracked: [],
                conflicts: []
            };

            const output = await statusManager.formatStatus(status);
            expect(output).to.include('Changes not staged for commit');
            expect(output).to.include('modified:');
            expect(output).to.include('deleted:');
        });

        it('should format untracked files', async () => {
            const status = {
                branch: { current: 'main' },
                staged: { new: [], modified: [], deleted: [] },
                unstaged: { modified: [], deleted: [] },
                untracked: ['untracked.txt'],
                conflicts: []
            };

            const output = await statusManager.formatStatus(status);
            expect(output).to.include('Untracked files');
            expect(output).to.include('untracked.txt');
        });

        it('should format merge conflicts', async () => {
            const status = {
                branch: { current: 'main' },
                staged: { new: [], modified: [], deleted: [] },
                unstaged: { modified: [], deleted: [] },
                untracked: [],
                conflicts: ['conflict.txt']
            };

            const output = await statusManager.formatStatus(status);
            expect(output).to.include('Unmerged paths');
            expect(output).to.include('both modified:');
        });
    });
});
