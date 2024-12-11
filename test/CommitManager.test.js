const { describe, it, beforeEach, afterEach } = require('mocha');
const { expect } = require('chai');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const  CommitManager  = require('../src/CommitManager');
const { CommitNotFoundError } = require('../src/errors');

describe('CommitManager', () => {
    let testDir;
    let dotgitDir;
    let commitManager;

    beforeEach(async () => {
        // Create temporary test directory
        testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'dotgit-test-'));
        dotgitDir = path.join(testDir, '.dotgit');
        await fs.mkdir(path.join(dotgitDir, 'objects'), { recursive: true });
        commitManager = new CommitManager(dotgitDir);
    });

    afterEach(async () => {
        // Clean up test directory
        await fs.rm(testDir, { recursive: true, force: true });
    });

    describe('createCommit()', () => {
        it('should create a new commit', async () => {
            const tree = { 'test.txt': { hash: '1234', mode: '100644' } };
            const message = 'Test commit';
            const hash = await commitManager.createCommit(tree, message);

            const commitPath = path.join(dotgitDir, 'objects', hash);
            const content = await fs.readFile(commitPath, 'utf8');
            const commit = JSON.parse(content);

            expect(commit.tree).to.deep.equal(tree);
            expect(commit.message).to.equal(message);
            expect(commit.parent).to.be.null;
            expect(commit.author).to.be.a('string');
            expect(commit.timestamp).to.be.a('string');
        });

        it('should create commit with parent', async () => {
            const parentHash = '1234567890abcdef';
            const tree = { 'test.txt': { hash: '1234', mode: '100644' } };
            const message = 'Test commit';
            
            const hash = await commitManager.createCommit(tree, message, parentHash);
            const commit = JSON.parse(await fs.readFile(
                path.join(dotgitDir, 'objects', hash),
                'utf8'
            ));

            expect(commit.parent).to.equal(parentHash);
        });
    });

    describe('getCommit()', () => {
        it('should retrieve commit by hash', async () => {
            const tree = { 'test.txt': { hash: '1234', mode: '100644' } };
            const message = 'Test commit';
            const hash = await commitManager.createCommit(tree, message);

            const commit = await commitManager.getCommit(hash);
            expect(commit.tree).to.deep.equal(tree);
            expect(commit.message).to.equal(message);
        });

        it('should throw error for non-existent commit', async () => {
            try {
                await commitManager.getCommit('nonexistent');
                expect.fail('Should have thrown error');
            } catch (error) {
                expect(error).to.be.instanceOf(CommitNotFoundError);
            }
        });
    });

    describe('getCommitHistory()', () => {
        it('should return commit history', async () => {
            const tree1 = { 'test1.txt': { hash: '1234', mode: '100644' } };
            const hash1 = await commitManager.createCommit(tree1, 'First commit');

            const tree2 = { 'test2.txt': { hash: '5678', mode: '100644' } };
            const hash2 = await commitManager.createCommit(tree2, 'Second commit', hash1);

            const history = await commitManager.getCommitHistory(hash2);
            expect(history).to.have.lengthOf(2);
            expect(history[0].hash).to.equal(hash2);
            expect(history[1].hash).to.equal(hash1);
        });

        it('should handle empty history', async () => {
            const history = await commitManager.getCommitHistory(null);
            expect(history).to.be.empty;
        });
    });

    describe('getCommitDiff()', () => {
        it('should return changes between commits', async () => {
            const tree1 = { 'test.txt': { hash: '1234', mode: '100644' } };
            const hash1 = await commitManager.createCommit(tree1, 'First commit');

            const tree2 = {
                'test.txt': { hash: '5678', mode: '100644' },
                'new.txt': { hash: '9012', mode: '100644' }
            };
            const hash2 = await commitManager.createCommit(tree2, 'Second commit', hash1);

            const diff = await commitManager.getCommitDiff(hash1, hash2);
            expect(diff.modified).to.include('test.txt');
            expect(diff.added).to.include('new.txt');
            expect(diff.deleted).to.be.empty;
        });

        it('should handle initial commit diff', async () => {
            const tree = { 'test.txt': { hash: '1234', mode: '100644' } };
            const hash = await commitManager.createCommit(tree, 'First commit');

            const diff = await commitManager.getCommitDiff(null, hash);
            expect(diff.added).to.include('test.txt');
            expect(diff.modified).to.be.empty;
            expect(diff.deleted).to.be.empty;
        });
    });

    describe('formatCommitMessage()', () => {
        it('should format commit message correctly', async () => {
            const commit = {
                message: 'Test commit',
                author: 'test-user',
                timestamp: '2024-01-01T00:00:00.000Z'
            };
            const hash = '1234567890abcdef';

            const formatted = commitManager.formatCommitMessage(commit, hash);
            expect(formatted).to.include('commit 1234567');
            expect(formatted).to.include('Author: test-user');
            expect(formatted).to.include('Test commit');
        });
    });

    describe('printCommitLog()', () => {
        it('should print commit log with diffs', async () => {
            const tree1 = { 'test.txt': { hash: '1234', mode: '100644' } };
            const hash1 = await commitManager.createCommit(tree1, 'First commit');

            const tree2 = {
                'test.txt': { hash: '5678', mode: '100644' },
                'new.txt': { hash: '9012', mode: '100644' }
            };
            const hash2 = await commitManager.createCommit(tree2, 'Second commit', hash1);

            // This is more of an integration test, mainly verifying it doesn't throw
            await commitManager.printCommitLog(hash2, { showDiff: true });
        });
    });

    describe('getObject()', () => {
        it('should throw an error if objectId is not a string', async () => {
            try {
                await commitManager.getObject(123); // Passing a number instead of a string
                expect.fail('Should have thrown an error');
            } catch (error) {
                expect(error).to.be.instanceOf(TypeError);
                expect(error.message).to.include('Invalid objectId type. Expected string');
            }
        });
    });

    describe('getCommitDiff()', () => {
        it('should throw an error if commit IDs are not strings', async () => {
            try {
                await commitManager.getCommitDiff(123, 'validCommitId'); // Passing a number as oldCommitId
                expect.fail('Should have thrown an error');
            } catch (error) {
                expect(error).to.be.instanceOf(TypeError);
                expect(error.message).to.include('Commit IDs must be strings');
            }
        });
    });
});
