const { describe, it, beforeEach, afterEach } = require('mocha');
const { expect } = require('chai');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const  IndexManager  = require('../src/IndexManager');

describe('IndexManager', () => {
    let testDir;
    let dotgitDir;
    let workDir;
    let indexManager;

    beforeEach(async () => {
        // Create temporary test directory
        testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'dotgit-test-'));
        dotgitDir = path.join(testDir, '.dotgit');
        workDir = path.join(testDir, 'work');
        await fs.mkdir(dotgitDir);
        await fs.mkdir(workDir);
        indexManager = new IndexManager(dotgitDir);
    });

    afterEach(async () => {
        // Clean up test directory
        await fs.rm(testDir, { recursive: true, force: true });
    });

    describe('load()', () => {
        it('should create empty index if file does not exist', async () => {
            await indexManager.load();
            expect(indexManager.entries.size).to.equal(0);
        });

        it('should load existing index file', async () => {
            const testIndex = {
                'test.txt': {
                    hash: '1234',
                    size: 100,
                    mtime: new Date().toISOString(),
                    mode: 33188,
                    staged: true
                }
            };

            await fs.writeFile(
                path.join(dotgitDir, 'index'),
                JSON.stringify(testIndex)
            );

            await indexManager.load();
            expect(indexManager.entries.size).to.equal(1);
            expect(indexManager.entries.get('test.txt')).to.exist;
        });

        it('should handle corrupted index file', async () => {
            await fs.writeFile(
                path.join(dotgitDir, 'index'),
                'invalid json'
            );

            try {
                await indexManager.load();
                expect.fail('Should have thrown error');
            } catch (error) {
                expect(error.message).to.include('Failed to load index');
            }
        });
    });

    describe('save()', () => {
        it('should save index to file', async () => {
            await indexManager.load();
            await indexManager.add('test.txt', Buffer.from('content'));
            await indexManager.save();

            const content = await fs.readFile(
                path.join(dotgitDir, 'index'),
                'utf8'
            );
            const saved = JSON.parse(content);
            expect(saved['test.txt']).to.exist;
        });

        it('should handle save errors', async () => {
            await indexManager.load();
            await fs.chmod(dotgitDir, 0o444); // Make directory read-only

            try {
                await indexManager.save();
                expect.fail('Should have thrown error');
            } catch (error) {
                expect(error.message).to.include('Failed to save index');
            }
        });
    });

    describe('add()', () => {
        beforeEach(async () => {
            await indexManager.load();
        });

        it('should add file to index', async () => {
            const content = 'test content';
            await fs.writeFile(path.join(workDir, 'test.txt'), content);

            const hash = await indexManager.add(
                path.join(workDir, 'test.txt'),
                Buffer.from(content)
            );

            const entry = indexManager.entries.get(path.join(workDir, 'test.txt'));
            expect(entry).to.exist;
            expect(entry.hash).to.equal(hash);
            expect(entry.staged).to.be.true;
        });

        it('should update existing file in index', async () => {
            const file = path.join(workDir, 'test.txt');
            
            // Add initial version
            await fs.writeFile(file, 'initial');
            const hash1 = await indexManager.add(file, Buffer.from('initial'));
            
            // Update file
            await fs.writeFile(file, 'updated');
            const hash2 = await indexManager.add(file, Buffer.from('updated'));
            
            expect(hash1).to.not.equal(hash2);
            expect(indexManager.entries.get(file).hash).to.equal(hash2);
        });
    });

    describe('remove()', () => {
        beforeEach(async () => {
            await indexManager.load();
        });

        it('should remove file from index', async () => {
            const file = path.join(workDir, 'test.txt');
            await fs.writeFile(file, 'content');
            await indexManager.add(file, Buffer.from('content'));

            await indexManager.remove(file);
            expect(indexManager.entries.has(file)).to.be.false;
        });

        it('should handle non-existent files', async () => {
            try {
                await indexManager.remove('nonexistent.txt');
                expect.fail('Should have thrown error');
            } catch (error) {
                expect(error.message).to.include('not in index');
            }
        });
    });

    describe('getChanges()', () => {
        beforeEach(async () => {
            await indexManager.load();
        });

        it('should detect modified files', async () => {
            const file = path.join(workDir, 'test.txt');
            
            // Add initial version
            await fs.writeFile(file, 'initial');
            await indexManager.add(file, Buffer.from('initial'));
            
            // Modify file
            await fs.writeFile(file, 'modified');
            
            const changes = await indexManager.getChanges(workDir);
            expect(changes.modified).to.include(file);
        });

        it('should detect deleted files', async () => {
            const file = path.join(workDir, 'test.txt');
            
            // Add file
            await fs.writeFile(file, 'content');
            await indexManager.add(file, Buffer.from('content'));
            
            // Delete file
            await fs.unlink(file);
            
            const changes = await indexManager.getChanges(workDir);
            expect(changes.deleted).to.include(file);
        });

        it('should detect untracked files', async () => {
            const file = path.join(workDir, 'untracked.txt');
            await fs.writeFile(file, 'content');
            
            const changes = await indexManager.getChanges(workDir);
            expect(changes.untracked).to.include(file);
        });
    });

    describe('writeTree()', () => {
        beforeEach(async () => {
            await indexManager.load();
        });

        it('should generate tree from staged files', async () => {
            // Add some files
            await fs.writeFile(path.join(workDir, 'file1.txt'), 'content1');
            await fs.writeFile(path.join(workDir, 'file2.txt'), 'content2');
            
            await indexManager.add(
                path.join(workDir, 'file1.txt'),
                Buffer.from('content1')
            );
            await indexManager.add(
                path.join(workDir, 'file2.txt'),
                Buffer.from('content2')
            );

            const tree = await indexManager.writeTree();
            expect(Object.keys(tree)).to.have.lengthOf(2);
            expect(tree[path.join(workDir, 'file1.txt')]).to.exist;
            expect(tree[path.join(workDir, 'file2.txt')]).to.exist;
        });

        it('should only include staged files', async () => {
            // Add staged file
            await fs.writeFile(path.join(workDir, 'staged.txt'), 'content');
            await indexManager.add(
                path.join(workDir, 'staged.txt'),
                Buffer.from('content')
            );
            
            // Add unstaged file
            await fs.writeFile(path.join(workDir, 'unstaged.txt'), 'content');
            
            const tree = await indexManager.writeTree();
            expect(Object.keys(tree)).to.have.lengthOf(1);
            expect(tree[path.join(workDir, 'staged.txt')]).to.exist;
        });
    });
});
