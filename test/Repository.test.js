const { describe, it, beforeEach, afterEach } = require('mocha');
const { expect } = require('chai');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const { Repository } = require('../src/Repository');

describe('Repository', () => {
    let testDir;
    let repository;

    beforeEach(async () => {
        // Create a temporary directory for each test
        testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'dotgit-test-'));
        repository = new Repository(testDir);
    });

    afterEach(async () => {
        // Clean up temporary directory after each test
        await fs.rm(testDir, { recursive: true, force: true });
    });

    describe('init()', () => {
        it('should create a new repository', async () => {
            await repository.init();
            
            // Verify .dotgit directory exists
            const dotgitExists = await fs.stat(repository.dotgitDir)
                .then(stats => stats.isDirectory())
                .catch(() => false);
            expect(dotgitExists).to.be.true;

            // Verify repository structure
            const objectsExists = await fs.stat(repository.objectsDir)
                .then(stats => stats.isDirectory())
                .catch(() => false);
            expect(objectsExists).to.be.true;

            const refsExists = await fs.stat(repository.refsDir)
                .then(stats => stats.isDirectory())
                .catch(() => false);
            expect(refsExists).to.be.true;
        });

        it('should initialize HEAD to point to main branch', async () => {
            await repository.init();
            
            const headContent = await fs.readFile(repository.headFile, 'utf8');
            expect(headContent).to.equal('ref: refs/heads/main');
        });

        it('should initialize empty remotes file', async () => {
            await repository.init();
            
            const remotesContent = await fs.readFile(repository.remotesFile, 'utf8');
            expect(JSON.parse(remotesContent)).to.deep.equal({});
        });
    });

    describe('isRepository()', () => {
        it('should return true for initialized repository', async () => {
            await repository.init();
            expect(await repository.isRepository()).to.be.true;
        });

        it('should return false for uninitialized directory', async () => {
            expect(await repository.isRepository()).to.be.false;
        });
    });

    describe('getCurrentCommit()', () => {
        it('should return null for new repository', async () => {
            await repository.init();
            expect(await repository.getCurrentCommit()).to.be.null;
        });

        it('should return commit hash when HEAD points to a commit', async () => {
            await repository.init();
            const hash = 'abcdef1234567890';
            await fs.writeFile(path.join(repository.refsDir, 'heads/main'), hash);
            expect(await repository.getCurrentCommit()).to.equal(hash);
        });
    });

    describe('saveObject()', () => {
        it('should save and return hash of content', async () => {
            await repository.init();
            const content = 'test content';
            const hash = await repository.saveObject(content);
            
            const savedContent = await fs.readFile(
                path.join(repository.objectsDir, hash),
                'utf8'
            );
            expect(savedContent).to.equal(content);
        });
    });

    describe('getObject()', () => {
        it('should retrieve saved object content', async () => {
            await repository.init();
            const content = 'test content';
            const hash = await repository.saveObject(content);
            
            const retrievedContent = await repository.getObject(hash);
            expect(retrievedContent).to.equal(content);
        });

        it('should throw error for non-existent object', async () => {
            await repository.init();
            try {
                await repository.getObject('nonexistent');
                expect.fail('Should have thrown error');
            } catch (error) {
                expect(error.name).to.equal('CommitNotFoundError');
            }
        });
    });
});
