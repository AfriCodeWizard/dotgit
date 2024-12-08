const { describe, it, beforeEach, afterEach } = require('mocha');
const { expect } = require('chai');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const { DiffManager } = require('../src/DiffManager');

describe('DiffManager', () => {
    let testDir;
    let dotgitDir;
    let diffManager;

    beforeEach(async () => {
        // Create temporary test directory
        testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'dotgit-test-'));
        dotgitDir = path.join(testDir, '.dotgit');
        await fs.mkdir(path.join(dotgitDir, 'objects'), { recursive: true });
        diffManager = new DiffManager(dotgitDir);
    });

    afterEach(async () => {
        // Clean up test directory
        await fs.rm(testDir, { recursive: true, force: true });
    });

    describe('compareFiles()', () => {
        it('should detect added lines', async () => {
            const oldContent = 'line1\nline2\n';
            const newContent = 'line1\nline2\nline3\n';

            const diff = await diffManager.compareFiles(oldContent, newContent);
            expect(diff).to.include('+line3');
        });

        it('should detect removed lines', async () => {
            const oldContent = 'line1\nline2\nline3\n';
            const newContent = 'line1\nline3\n';

            const diff = await diffManager.compareFiles(oldContent, newContent);
            expect(diff).to.include('-line2');
        });

        it('should detect modified lines', async () => {
            const oldContent = 'line1\nline2\nline3\n';
            const newContent = 'line1\nmodified\nline3\n';

            const diff = await diffManager.compareFiles(oldContent, newContent);
            expect(diff).to.include('-line2');
            expect(diff).to.include('+modified');
        });

        it('should handle empty files', async () => {
            const oldContent = '';
            const newContent = 'line1\n';

            const diff = await diffManager.compareFiles(oldContent, newContent);
            expect(diff).to.include('+line1');
        });
    });

    describe('computeDiff()', () => {
        it('should find matching lines', () => {
            const oldLines = ['a', 'b', 'c'];
            const newLines = ['a', 'x', 'c'];

            const changes = diffManager.computeDiff(oldLines, newLines);
            expect(changes).to.have.lengthOf(3);
            expect(changes[0].type).to.equal('same');
            expect(changes[1].type).to.equal('modify');
            expect(changes[2].type).to.equal('same');
        });

        it('should handle completely different content', () => {
            const oldLines = ['a', 'b'];
            const newLines = ['x', 'y'];

            const changes = diffManager.computeDiff(oldLines, newLines);
            expect(changes.every(change => change.type !== 'same')).to.be.true;
        });

        it('should handle empty arrays', () => {
            const changes = diffManager.computeDiff([], []);
            expect(changes).to.be.empty;
        });
    });

    describe('formatDiff()', () => {
        it('should format unified diff', () => {
            const changes = [
                {
                    type: 'same',
                    oldLines: ['context'],
                    newLines: ['context']
                },
                {
                    type: 'add',
                    oldLines: [],
                    newLines: ['new line']
                }
            ];

            const output = diffManager.formatDiff(changes, { unified: true });
            expect(output).to.include(' context');
            expect(output).to.include('+new line');
        });

        it('should respect context lines option', () => {
            const changes = Array(10).fill({
                type: 'same',
                oldLines: ['context'],
                newLines: ['context']
            });
            changes.push({
                type: 'add',
                oldLines: [],
                newLines: ['new line']
            });

            const output = diffManager.formatDiff(changes, { unified: true, context: 3 });
            const contextLines = output.split('\n').filter(line => line.startsWith(' ')).length;
            expect(contextLines).to.be.at.most(3);
        });

        it('should handle colorized output', () => {
            const changes = [
                {
                    type: 'add',
                    oldLines: [],
                    newLines: ['new line']
                }
            ];

            const colorized = diffManager.formatDiff(changes, { colorize: true });
            const plain = diffManager.formatDiff(changes, { colorize: false });
            expect(colorized).to.not.equal(plain);
            expect(colorized).to.include('\x1b[32m');  // Green color code
        });
    });

    describe('getFileDiff()', () => {
        it('should generate diff between file versions', async () => {
            // Save two versions of a file
            const oldContent = 'version 1\n';
            const newContent = 'version 2\n';
            
            const oldHash = await fs.writeFile(
                path.join(dotgitDir, 'objects', 'old'),
                oldContent
            );
            const newHash = await fs.writeFile(
                path.join(dotgitDir, 'objects', 'new'),
                newContent
            );

            const diff = await diffManager.getFileDiff('test.txt', 'old', 'new');
            expect(diff).to.include('-version 1');
            expect(diff).to.include('+version 2');
        });

        it('should handle new files', async () => {
            const content = 'new file\n';
            const hash = await fs.writeFile(
                path.join(dotgitDir, 'objects', 'new'),
                content
            );

            const diff = await diffManager.getFileDiff('test.txt', null, 'new');
            expect(diff).to.include('+new file');
        });

        it('should handle deleted files', async () => {
            const content = 'old file\n';
            const hash = await fs.writeFile(
                path.join(dotgitDir, 'objects', 'old'),
                content
            );

            const diff = await diffManager.getFileDiff('test.txt', 'old', null);
            expect(diff).to.include('-old file');
        });
    });

    describe('formatLine()', () => {
        it('should format added lines', () => {
            const line = diffManager.formatLine('+', 'added line', true);
            expect(line).to.include('\x1b[32m');  // Green color
            expect(line).to.include('added line');
        });

        it('should format deleted lines', () => {
            const line = diffManager.formatLine('-', 'deleted line', true);
            expect(line).to.include('\x1b[31m');  // Red color
            expect(line).to.include('deleted line');
        });

        it('should format context lines', () => {
            const line = diffManager.formatLine(' ', 'context line', true);
            expect(line).to.not.include('\x1b[');  // No color codes
            expect(line).to.include('context line');
        });

        it('should handle non-colorized output', () => {
            const line = diffManager.formatLine('+', 'added line', false);
            expect(line).to.not.include('\x1b[');
            expect(line).to.equal('+added line');
        });
    });
});
