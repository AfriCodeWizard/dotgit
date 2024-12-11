const { describe, it, beforeEach, afterEach } = require('mocha');
const { expect } = require('chai');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const  RefManager  = require('../src/RefManager');

describe('RefManager', () => {
    let testDir;
    let dotgitDir;
    let refManager;

    beforeEach(async () => {
        // Create temporary test directory
        testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'dotgit-test-'));
        dotgitDir = path.join(testDir, '.dotgit');
        await fs.mkdir(dotgitDir);
        refManager = new RefManager(dotgitDir);
    });

    afterEach(async () => {
        // Clean up test directory
        await fs.rm(testDir, { recursive: true, force: true });
    });

    describe('init()', () => {
        it('should create refs directory structure', async () => {
            await refManager.init();

            const refsExists = await fs.stat(path.join(dotgitDir, 'refs'))
                .then(stats => stats.isDirectory())
                .catch(() => false);
            expect(refsExists).to.be.true;

            const headsExists = await fs.stat(path.join(dotgitDir, 'refs', 'heads'))
                .then(stats => stats.isDirectory())
                .catch(() => false);
            expect(headsExists).to.be.true;

            const tagsExists = await fs.stat(path.join(dotgitDir, 'refs', 'tags'))
                .then(stats => stats.isDirectory())
                .catch(() => false);
            expect(tagsExists).to.be.true;
        });

        it('should initialize HEAD to main branch', async () => {
            await refManager.init();
            
            const headContent = await fs.readFile(
                path.join(dotgitDir, 'HEAD'),
                'utf8'
            );
            expect(headContent).to.equal('ref: refs/heads/main');
        });
    });

    describe('setHead()', () => {
        beforeEach(async () => {
            await refManager.init();
        });

        it('should update HEAD to ref', async () => {
            await refManager.setHead('refs/heads/develop');
            
            const headContent = await fs.readFile(
                path.join(dotgitDir, 'HEAD'),
                'utf8'
            );
            expect(headContent).to.equal('ref: refs/heads/develop');
        });

        it('should update HEAD to hash', async () => {
            const hash = '1234567890abcdef';
            await refManager.setHead(null, hash);
            
            const headContent = await fs.readFile(
                path.join(dotgitDir, 'HEAD'),
                'utf8'
            );
            expect(headContent).to.equal(hash);
        });
    });

    describe('getHead()', () => {
        beforeEach(async () => {
            await refManager.init();
        });

        it('should get HEAD when pointing to ref', async () => {
            const hash = '1234567890abcdef';
            await refManager.updateRef('refs/heads/main', hash);
            
            const head = await refManager.getHead();
            expect(head.type).to.equal('ref');
            expect(head.ref).to.equal('refs/heads/main');
            expect(head.hash).to.equal(hash);
        });

        it('should get HEAD when detached', async () => {
            const hash = '1234567890abcdef';
            await refManager.setHead(null, hash);
            
            const head = await refManager.getHead();
            expect(head.type).to.equal('hash');
            expect(head.hash).to.equal(hash);
        });

        it('should return null for new repository', async () => {
            const head = await refManager.getHead();
            expect(head).to.be.null;
        });
    });

    describe('updateRef()', () => {
        beforeEach(async () => {
            await refManager.init();
        });

        it('should create new ref', async () => {
            const hash = '1234567890abcdef';
            await refManager.updateRef('refs/heads/test', hash);
            
            const content = await fs.readFile(
                path.join(dotgitDir, 'refs', 'heads', 'test'),
                'utf8'
            );
            expect(content.trim()).to.equal(hash);
        });

        it('should update existing ref', async () => {
            const hash1 = '1234567890abcdef';
            const hash2 = 'fedcba0987654321';
            
            await refManager.updateRef('refs/heads/test', hash1);
            await refManager.updateRef('refs/heads/test', hash2);
            
            const content = await fs.readFile(
                path.join(dotgitDir, 'refs', 'heads', 'test'),
                'utf8'
            );
            expect(content.trim()).to.equal(hash2);
        });
    });

    describe('deleteRef()', () => {
        beforeEach(async () => {
            await refManager.init();
        });

        it('should delete existing ref', async () => {
            await refManager.updateRef('refs/heads/test', '1234567890abcdef');
            const deleted = await refManager.deleteRef('refs/heads/test');
            
            expect(deleted).to.be.true;
            const exists = await fs.access(
                path.join(dotgitDir, 'refs', 'heads', 'test')
            ).then(() => true).catch(() => false);
            expect(exists).to.be.false;
        });

        it('should return false for non-existent ref', async () => {
            const deleted = await refManager.deleteRef('refs/heads/nonexistent');
            expect(deleted).to.be.false;
        });
    });

    describe('resolveRef()', () => {
        beforeEach(async () => {
            await refManager.init();
        });

        it('should resolve ref to hash', async () => {
            const hash = '1234567890abcdef';
            await refManager.updateRef('refs/heads/test', hash);
            
            const resolved = await refManager.resolveRef('refs/heads/test');
            expect(resolved).to.equal(hash);
        });

        it('should return null for non-existent ref', async () => {
            const resolved = await refManager.resolveRef('refs/heads/nonexistent');
            expect(resolved).to.be.null;
        });
    });

    describe('listRefs()', () => {
        beforeEach(async () => {
            await refManager.init();
        });

        it('should list all refs', async () => {
            await refManager.updateRef('refs/heads/main', '1234567890abcdef');
            await refManager.updateRef('refs/heads/develop', 'fedcba0987654321');
            await refManager.updateRef('refs/tags/v1.0', 'abcdef1234567890');
            
            const refs = await refManager.listRefs();
            expect(refs.size).to.equal(3);
            expect(refs.get('refs/heads/main')).to.exist;
            expect(refs.get('refs/heads/develop')).to.exist;
            expect(refs.get('refs/tags/v1.0')).to.exist;
        });

        it('should list refs with prefix filter', async () => {
            await refManager.updateRef('refs/heads/main', '1234567890abcdef');
            await refManager.updateRef('refs/tags/v1.0', 'abcdef1234567890');
            
            const refs = await refManager.listRefs('heads');
            expect(refs.size).to.equal(1);
            expect(refs.get('refs/heads/main')).to.exist;
        });
    });

    describe('tag operations', () => {
        beforeEach(async () => {
            await refManager.init();
        });

        it('should create tag', async () => {
            const hash = '1234567890abcdef';
            const tagData = await refManager.createTag('v1.0', hash, 'Release 1.0');
            
            expect(tagData.object).to.equal(hash);
            expect(tagData.tag).to.equal('v1.0');
            expect(tagData.message).to.equal('Release 1.0');
        });

        it('should list tags', async () => {
            await refManager.createTag('v1.0', '1234567890abcdef', 'Release 1.0');
            await refManager.createTag('v2.0', 'fedcba0987654321', 'Release 2.0');
            
            const tags = await refManager.listTags();
            expect(tags).to.have.lengthOf(2);
            expect(tags[0].name).to.equal('v1.0');
            expect(tags[1].name).to.equal('v2.0');
        });

        it('should delete tag', async () => {
            await refManager.createTag('v1.0', '1234567890abcdef');
            const deleted = await refManager.deleteTag('v1.0');
            
            expect(deleted).to.be.true;
            const tags = await refManager.listTags();
            expect(tags).to.be.empty;
        });
    });
});
