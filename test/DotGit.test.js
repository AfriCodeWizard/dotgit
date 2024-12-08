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

    describe('merge operations', () => {
        beforeEach(async () => {
            await dotgit.init();
            await fs.writeFile(path.join(testDir, 'test.txt'), 'initial');
            await dotgit.add(['test.txt']);
            await dotgit.commit('Initial commit');
        });

        it('should merge branches without conflicts', async () => {
            // Create and switch to feature branch
            await dotgit.branch('feature');
            await dotgit.checkout('feature');
            await fs.writeFile(path.join(testDir, 'feature.txt'), 'feature content');
            await dotgit.add(['feature.txt']);
            await dotgit.commit('Feature commit');

            // Switch back to main and merge
            await dotgit.checkout('main');
            const result = await dotgit.merge('feature');
            
            expect(result.success).to.be.true;
            expect(result.conflicts).to.be.empty;
            
            // Verify merged file exists
            const featureExists = await fs.access(path.join(testDir, 'feature.txt'))
                .then(() => true)
                .catch(() => false);
            expect(featureExists).to.be.true;
        });

        it('should handle merge conflicts', async () => {
            // Create conflicting changes
            await fs.writeFile(path.join(testDir, 'test.txt'), 'main change');
            await dotgit.add(['test.txt']);
            await dotgit.commit('Main change');

            await dotgit.branch('feature');
            await dotgit.checkout('feature');
            await fs.writeFile(path.join(testDir, 'test.txt'), 'feature change');
            await dotgit.add(['test.txt']);
            await dotgit.commit('Feature change');

            // Try to merge
            await dotgit.checkout('main');
            const result = await dotgit.merge('feature');
            
            expect(result.success).to.be.false;
            expect(result.conflicts).to.include('test.txt');
        });
    });

    describe('stash operations', () => {
        beforeEach(async () => {
            await dotgit.init();
            await fs.writeFile(path.join(testDir, 'test.txt'), 'initial');
            await dotgit.add(['test.txt']);
            await dotgit.commit('Initial commit');
        });

        it('should stash changes', async () => {
            await fs.writeFile(path.join(testDir, 'test.txt'), 'modified');
            await dotgit.stash('save', 'WIP changes');

            // Verify working directory is clean
            const status = await dotgit.status();
            expect(status).to.include('nothing to commit');

            // Verify stash exists
            const stashes = await dotgit.stash('list');
            expect(stashes).to.include('WIP changes');
        });

        it('should apply stashed changes', async () => {
            await fs.writeFile(path.join(testDir, 'test.txt'), 'modified');
            await dotgit.stash('save');
            await dotgit.stash('apply');

            const content = await fs.readFile(path.join(testDir, 'test.txt'), 'utf8');
            expect(content).to.equal('modified');
        });
    });

    describe('tag operations', () => {
        beforeEach(async () => {
            await dotgit.init();
            await fs.writeFile(path.join(testDir, 'test.txt'), 'initial');
            await dotgit.add(['test.txt']);
            await dotgit.commit('Initial commit');
        });

        it('should create annotated tag', async () => {
            await dotgit.tag('v1.0.0', 'Version 1.0.0');
            
            const tags = await dotgit.refManager.listTags();
            expect(tags).to.have.lengthOf(1);
            expect(tags[0].name).to.equal('v1.0.0');
            expect(tags[0].message).to.equal('Version 1.0.0');
        });

        it('should delete tag', async () => {
            await dotgit.tag('v1.0.0');
            await dotgit.tag('-d', 'v1.0.0');
            
            const tags = await dotgit.refManager.listTags();
            expect(tags).to.be.empty;
        });
    });

    describe('log operations', () => {
        beforeEach(async () => {
            await dotgit.init();
        });

        it('should show commit history', async () => {
            // Create multiple commits
            await fs.writeFile(path.join(testDir, 'test1.txt'), 'content1');
            await dotgit.add(['test1.txt']);
            const commit1 = await dotgit.commit('First commit');

            await fs.writeFile(path.join(testDir, 'test2.txt'), 'content2');
            await dotgit.add(['test2.txt']);
            const commit2 = await dotgit.commit('Second commit');

            const log = await dotgit.log();
            expect(log).to.include(commit1.slice(0, 7));
            expect(log).to.include(commit2.slice(0, 7));
            expect(log).to.include('First commit');
            expect(log).to.include('Second commit');
        });

        it('should show commit history with patches', async () => {
            await fs.writeFile(path.join(testDir, 'test.txt'), 'initial');
            await dotgit.add(['test.txt']);
            await dotgit.commit('Initial commit');

            await fs.writeFile(path.join(testDir, 'test.txt'), 'modified');
            await dotgit.add(['test.txt']);
            await dotgit.commit('Modified file');

            const log = await dotgit.log({ patch: true });
            expect(log).to.include('-initial');
            expect(log).to.include('+modified');
        });
    });

    describe('reset operations', () => {
        beforeEach(async () => {
            await dotgit.init();
            await fs.writeFile(path.join(testDir, 'test.txt'), 'initial');
            await dotgit.add(['test.txt']);
            await dotgit.commit('Initial commit');
        });

        it('should reset staged changes', async () => {
            await fs.writeFile(path.join(testDir, 'test.txt'), 'modified');
            await dotgit.add(['test.txt']);
            
            await dotgit.reset(['test.txt']);
            const status = await dotgit.status();
            expect(status).to.not.include('Changes to be committed');
        });

        it('should reset to commit', async () => {
            const initialCommit = await dotgit.commitManager.getCurrentCommit();
            
            await fs.writeFile(path.join(testDir, 'test.txt'), 'modified');
            await dotgit.add(['test.txt']);
            await dotgit.commit('Modified file');

            await dotgit.reset('--hard', initialCommit);
            const content = await fs.readFile(path.join(testDir, 'test.txt'), 'utf8');
            expect(content).to.equal('initial');
        });
    });

    describe('error handling', () => {
        beforeEach(async () => {
            await dotgit.init();
        });

        it('should handle invalid file paths', async () => {
            try {
                await dotgit.add(['nonexistent.txt']);
                expect.fail('Should have thrown error');
            } catch (error) {
                expect(error.message).to.include('does not exist');
            }
        });

        it('should handle invalid branch names', async () => {
            try {
                await dotgit.branch('invalid/name');
                expect.fail('Should have thrown error');
            } catch (error) {
                expect(error.message).to.include('invalid branch name');
            }
        });

        it('should handle invalid commit hashes', async () => {
            try {
                await dotgit.checkout('1234567');
                expect.fail('Should have thrown error');
            } catch (error) {
                expect(error.message).to.include('not found');
            }
        });

        it('should handle merge with unborn HEAD', async () => {
            try {
                await dotgit.merge('main');
                expect.fail('Should have thrown error');
            } catch (error) {
                expect(error.message).to.include('no commits yet');
            }
        });
    });

    describe('edge cases', () => {
        beforeEach(async () => {
            await dotgit.init();
        });

        it('should handle empty directories', async () => {
            await fs.mkdir(path.join(testDir, 'empty'));
            await dotgit.add(['empty']);
            const status = await dotgit.status();
            expect(status).to.not.include('empty');
        });

        it('should handle binary files', async () => {
            const binaryData = Buffer.from([0x00, 0x01, 0x02, 0x03]);
            await fs.writeFile(path.join(testDir, 'binary.bin'), binaryData);
            await dotgit.add(['binary.bin']);
            await dotgit.commit('Add binary file');

            // Modify binary file
            await fs.writeFile(path.join(testDir, 'binary.bin'), Buffer.from([0x03, 0x02, 0x01, 0x00]));
            const diff = await dotgit.diff();
            expect(diff).to.include('Binary files differ');
        });

        it('should handle large files', async () => {
            const largeContent = 'x'.repeat(1024 * 1024); // 1MB file
            await fs.writeFile(path.join(testDir, 'large.txt'), largeContent);
            await dotgit.add(['large.txt']);
            await dotgit.commit('Add large file');

            const status = await dotgit.status();
            expect(status).to.include('nothing to commit');
        });

        it('should handle special characters in filenames', async () => {
            const specialFile = 'special!@#$%^&*().txt';
            await fs.writeFile(path.join(testDir, specialFile), 'content');
            await dotgit.add([specialFile]);
            await dotgit.commit('Add special file');

            const status = await dotgit.status();
            expect(status).to.include('nothing to commit');
        });

        it('should handle unicode filenames', async () => {
            const unicodeFile = '文件.txt';
            await fs.writeFile(path.join(testDir, unicodeFile), 'content');
            await dotgit.add([unicodeFile]);
            await dotgit.commit('Add unicode file');

            const status = await dotgit.status();
            expect(status).to.include('nothing to commit');
        });
    });

    describe('concurrent operations', () => {
        beforeEach(async () => {
            await dotgit.init();
        });

        it('should handle concurrent file modifications', async () => {
            const file = path.join(testDir, 'test.txt');
            await fs.writeFile(file, 'initial');
            await dotgit.add(['test.txt']);
            await dotgit.commit('Initial commit');

            // Simulate concurrent modifications
            const promises = [
                fs.writeFile(file, 'change 1'),
                fs.writeFile(file, 'change 2')
            ];
            await Promise.all(promises);

            const status = await dotgit.status();
            expect(status).to.include('modified:');
        });

        it('should handle concurrent branch operations', async () => {
            await fs.writeFile(path.join(testDir, 'test.txt'), 'content');
            await dotgit.add(['test.txt']);
            await dotgit.commit('Initial commit');

            // Simulate concurrent branch operations
            const promises = [
                dotgit.branch('branch1'),
                dotgit.branch('branch2')
            ];
            await Promise.all(promises);

            const branches = await dotgit.branchManager.listBranches();
            expect(branches.all).to.include('branch1');
            expect(branches.all).to.include('branch2');
        });
    });

    describe('recovery scenarios', () => {
        beforeEach(async () => {
            await dotgit.init();
        });

        it('should recover from interrupted commit', async () => {
            await fs.writeFile(path.join(testDir, 'test.txt'), 'content');
            await dotgit.add(['test.txt']);
            
            // Simulate interrupted commit by corrupting HEAD
            await fs.writeFile(path.join(testDir, '.dotgit', 'HEAD'), 'corrupted');
            
            // Try to commit again
            try {
                await dotgit.commit('Test commit');
                expect.fail('Should have thrown error');
            } catch (error) {
                // Fix HEAD
                await fs.writeFile(
                    path.join(testDir, '.dotgit', 'HEAD'),
                    'ref: refs/heads/main'
                );
                // Retry commit
                const hash = await dotgit.commit('Test commit');
                expect(hash).to.be.a('string');
            }
        });

        it('should handle corrupted index', async () => {
            await fs.writeFile(path.join(testDir, 'test.txt'), 'content');
            await dotgit.add(['test.txt']);
            
            // Corrupt index file
            await fs.writeFile(
                path.join(testDir, '.dotgit', 'index'),
                'corrupted'
            );
            
            // Force index rebuild
            await dotgit.indexManager.load();
            await dotgit.add(['test.txt']);
            
            const status = await dotgit.status();
            expect(status).to.include('new file:');
        });
    });

    describe('advanced branch operations', () => {
        beforeEach(async () => {
            await dotgit.init();
            await fs.writeFile(path.join(testDir, 'test.txt'), 'initial');
            await dotgit.add(['test.txt']);
            await dotgit.commit('Initial commit');
        });

        it('should handle orphan branches', async () => {
            await dotgit.checkout('--orphan', 'orphan');
            
            // Verify working directory is clean
            const status = await dotgit.status();
            expect(status).to.include('on orphan branch');
            expect(status).to.include('no commits yet');

            // Create commit on orphan branch
            await fs.writeFile(path.join(testDir, 'orphan.txt'), 'content');
            await dotgit.add(['orphan.txt']);
            const hash = await dotgit.commit('Orphan commit');

            // Verify commit has no parent
            const commit = await dotgit.commitManager.getCommit(hash);
            expect(commit.parent).to.be.null;
        });

        it('should handle branch renaming', async () => {
            await dotgit.branch('old-name');
            await dotgit.branch('-m', 'old-name', 'new-name');

            const branches = await dotgit.branchManager.listBranches();
            expect(branches.all).to.not.include('old-name');
            expect(branches.all).to.include('new-name');
        });

        it('should track remote branches', async () => {
            await dotgit.remote('add', 'origin', 'https://example.com/repo.git');
            await dotgit.branch('--track', 'feature', 'origin/feature');

            const config = await dotgit.configManager.get('branch.feature');
            expect(config.remote).to.equal('origin');
            expect(config.merge).to.equal('refs/heads/feature');
        });
    });

    describe('advanced merge scenarios', () => {
        beforeEach(async () => {
            await dotgit.init();
            await fs.writeFile(path.join(testDir, 'test.txt'), 'initial');
            await dotgit.add(['test.txt']);
            await dotgit.commit('Initial commit');
        });

        it('should handle octopus merge', async () => {
            // Create multiple branches with changes
            for (let i = 1; i <= 3; i++) {
                await dotgit.branch(`branch${i}`);
                await dotgit.checkout(`branch${i}`);
                await fs.writeFile(path.join(testDir, `file${i}.txt`), `content${i}`);
                await dotgit.add([`file${i}.txt`]);
                await dotgit.commit(`Commit ${i}`);
            }

            // Perform octopus merge
            await dotgit.checkout('main');
            const result = await dotgit.merge(['branch1', 'branch2', 'branch3']);
            
            expect(result.success).to.be.true;
            for (let i = 1; i <= 3; i++) {
                const exists = await fs.access(path.join(testDir, `file${i}.txt`))
                    .then(() => true)
                    .catch(() => false);
                expect(exists).to.be.true;
            }
        });

        it('should handle merge strategies', async () => {
            await dotgit.branch('feature');
            await dotgit.checkout('feature');
            await fs.writeFile(path.join(testDir, 'test.txt'), 'feature change');
            await dotgit.add(['test.txt']);
            await dotgit.commit('Feature change');

            await dotgit.checkout('main');
            await fs.writeFile(path.join(testDir, 'test.txt'), 'main change');
            await dotgit.add(['test.txt']);
            await dotgit.commit('Main change');

            // Try different merge strategies
            const strategies = ['ours', 'theirs'];
            for (const strategy of strategies) {
                await dotgit.reset('--hard', 'HEAD');
                const result = await dotgit.merge('feature', { strategy });
                expect(result.success).to.be.true;
            }
        });
    });

    describe('advanced stash operations', () => {
        beforeEach(async () => {
            await dotgit.init();
            await fs.writeFile(path.join(testDir, 'test.txt'), 'initial');
            await dotgit.add(['test.txt']);
            await dotgit.commit('Initial commit');
        });

        it('should handle stash with untracked files', async () => {
            await fs.writeFile(path.join(testDir, 'tracked.txt'), 'modified');
            await fs.writeFile(path.join(testDir, 'untracked.txt'), 'new');

            await dotgit.stash('save', '--include-untracked');
            
            // Verify both files are stashed
            const status = await dotgit.status();
            expect(status).to.include('nothing to commit');
            
            await dotgit.stash('pop');
            const untrackedExists = await fs.access(path.join(testDir, 'untracked.txt'))
                .then(() => true)
                .catch(() => false);
            expect(untrackedExists).to.be.true;
        });

        it('should handle stash conflicts', async () => {
            // Create and stash changes
            await fs.writeFile(path.join(testDir, 'test.txt'), 'stashed');
            await dotgit.stash('save');

            // Create conflicting changes
            await fs.writeFile(path.join(testDir, 'test.txt'), 'conflicting');

            // Try to apply stash
            try {
                await dotgit.stash('pop');
            } catch (error) {
                expect(error.message).to.include('conflict');
            }

            // Verify conflict markers
            const content = await fs.readFile(path.join(testDir, 'test.txt'), 'utf8');
            expect(content).to.include('<<<<<<<');
            expect(content).to.include('>>>>>>>');
        });
    });

    describe('advanced tag operations', () => {
        beforeEach(async () => {
            await dotgit.init();
            await fs.writeFile(path.join(testDir, 'test.txt'), 'initial');
            await dotgit.add(['test.txt']);
            await dotgit.commit('Initial commit');
        });

        it('should handle signed tags', async () => {
            // Mock GPG signing
            dotgit.configManager.set('user.signingkey', 'TEST-KEY');
            
            await dotgit.tag('-s', 'v1.0.0', 'Signed release');
            
            const tags = await dotgit.refManager.listTags();
            const tag = tags.find(t => t.name === 'v1.0.0');
            expect(tag.signed).to.be.true;
        });

        it('should verify tags', async () => {
            await dotgit.tag('-s', 'v1.0.0', 'Signed release');
            
            const verification = await dotgit.tag('-v', 'v1.0.0');
            expect(verification).to.include('signature');
        });
    });

    describe('worktree operations', () => {
        beforeEach(async () => {
            await dotgit.init();
            await fs.writeFile(path.join(testDir, 'test.txt'), 'initial');
            await dotgit.add(['test.txt']);
            await dotgit.commit('Initial commit');
        });

        it('should handle multiple worktrees', async () => {
            const worktreePath = path.join(testDir, 'worktree');
            await dotgit.worktree('add', worktreePath, 'main');

            // Verify worktree is functional
            const worktreeFile = path.join(worktreePath, 'worktree.txt');
            await fs.writeFile(worktreeFile, 'content');
            
            // Create commit in worktree
            const worktreeDotgit = new DotGit(worktreePath);
            await worktreeDotgit.add(['worktree.txt']);
            await worktreeDotgit.commit('Worktree commit');

            // Verify commit is visible in main repository
            const log = await dotgit.log();
            expect(log).to.include('Worktree commit');
        });

        it('should handle worktree removal', async () => {
            const worktreePath = path.join(testDir, 'worktree');
            await dotgit.worktree('add', worktreePath, 'main');
            await dotgit.worktree('remove', worktreePath);

            const exists = await fs.access(worktreePath)
                .then(() => true)
                .catch(() => false);
            expect(exists).to.be.false;
        });
    });
});
