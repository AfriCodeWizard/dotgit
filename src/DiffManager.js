const fs = require('fs').promises;
const path = require('path');
const { logger } = require('./Logger');

class DiffManager {
    constructor(dotgitPath) {
        this.dotgitPath = dotgitPath;
        this.objectsPath = path.join(dotgitPath, 'objects');
    }

    async compareFiles(oldContent, newContent, options = {}) {
        const oldLines = this.splitLines(oldContent);
        const newLines = this.splitLines(newContent);
        
        const diff = this.computeDiff(oldLines, newLines);
        return this.formatDiff(diff, options);
    }

    splitLines(content) {
        if (Buffer.isBuffer(content)) {
            content = content.toString('utf8');
        }
        return content.split(/\r?\n/);
    }

    computeDiff(oldLines, newLines) {
        const changes = [];
        let oldIndex = 0;
        let newIndex = 0;

        while (oldIndex < oldLines.length || newIndex < newLines.length) {
            if (oldIndex >= oldLines.length) {
                // Rest of newLines are additions
                changes.push({
                    type: 'add',
                    oldStart: oldIndex,
                    oldLines: 0,
                    newStart: newIndex,
                    newLines: newLines.slice(newIndex)
                });
                break;
            }

            if (newIndex >= newLines.length) {
                // Rest of oldLines are deletions
                changes.push({
                    type: 'delete',
                    oldStart: oldIndex,
                    oldLines: oldLines.slice(oldIndex),
                    newStart: newIndex,
                    newLines: 0
                });
                break;
            }

            if (oldLines[oldIndex] === newLines[newIndex]) {
                // Lines are identical
                changes.push({
                    type: 'same',
                    oldStart: oldIndex,
                    oldLines: [oldLines[oldIndex]],
                    newStart: newIndex,
                    newLines: [newLines[newIndex]]
                });
                oldIndex++;
                newIndex++;
                continue;
            }

            // Look ahead for matching lines
            const matchResult = this.findNextMatch(
                oldLines.slice(oldIndex),
                newLines.slice(newIndex)
            );

            if (matchResult.found) {
                if (matchResult.oldOffset > 0) {
                    changes.push({
                        type: 'delete',
                        oldStart: oldIndex,
                        oldLines: oldLines.slice(oldIndex, oldIndex + matchResult.oldOffset),
                        newStart: newIndex,
                        newLines: 0
                    });
                }

                if (matchResult.newOffset > 0) {
                    changes.push({
                        type: 'add',
                        oldStart: oldIndex + matchResult.oldOffset,
                        oldLines: 0,
                        newStart: newIndex,
                        newLines: newLines.slice(newIndex, newIndex + matchResult.newOffset)
                    });
                }

                oldIndex += matchResult.oldOffset;
                newIndex += matchResult.newOffset;
            } else {
                // No match found, treat as modification
                changes.push({
                    type: 'modify',
                    oldStart: oldIndex,
                    oldLines: [oldLines[oldIndex]],
                    newStart: newIndex,
                    newLines: [newLines[newIndex]]
                });
                oldIndex++;
                newIndex++;
            }
        }

        return changes;
    }

    findNextMatch(oldLines, newLines, maxLookAhead = 10) {
        for (let i = 1; i <= maxLookAhead; i++) {
            for (let j = 1; j <= maxLookAhead; j++) {
                if (i <= oldLines.length && 
                    j <= newLines.length && 
                    oldLines[i - 1] === newLines[j - 1]) {
                    return {
                        found: true,
                        oldOffset: i - 1,
                        newOffset: j - 1
                    };
                }
            }
        }

        return { found: false };
    }

    formatDiff(changes, options = {}) {
        const {
            context = 3,
            colorize = true,
            unified = true
        } = options;

        let output = [];
        let lastPrinted = -1;

        for (let i = 0; i < changes.length; i++) {
            const change = changes[i];

            if (change.type === 'same') {
                // In unified diff, only show context lines around changes
                if (unified) {
                    const nextChange = changes.slice(i + 1)
                        .find(c => c.type !== 'same');
                    
                    if (nextChange && 
                        nextChange.oldStart - (change.oldStart + change.oldLines.length) <= context * 2) {
                        output.push(this.formatLine(' ', change.oldLines[0], colorize));
                        lastPrinted = change.oldStart;
                    }
                } else {
                    output.push(this.formatLine(' ', change.oldLines[0], colorize));
                }
                continue;
            }

            // Add separator if there's a gap in line numbers
            if (lastPrinted !== -1 && change.oldStart - lastPrinted > context * 2) {
                output.push('...');
            }

            if (change.type === 'delete' || change.type === 'modify') {
                change.oldLines.forEach(line => {
                    output.push(this.formatLine('-', line, colorize));
                });
            }

            if (change.type === 'add' || change.type === 'modify') {
                change.newLines.forEach(line => {
                    output.push(this.formatLine('+', line, colorize));
                });
            }

            lastPrinted = change.oldStart + (change.oldLines?.length || 0);
        }

        return output.join('\n');
    }

    formatLine(prefix, content, colorize = true) {
        if (!colorize) {
            return `${prefix}${content}`;
        }

        const colors = {
            '+': '\x1b[32m', // green
            '-': '\x1b[31m', // red
            ' ': '',
            reset: '\x1b[0m'
        };

        return `${colors[prefix]}${prefix}${content}${colors.reset}`;
    }

    async getFileDiff(filePath, oldHash, newHash) {
        try {
            const oldContent = oldHash ? await this.getFileContent(oldHash, filePath) : '';
            const newContent = newHash ? await this.getFileContent(newHash, filePath) : '';
            
            return await this.compareFiles(oldContent, newContent);
        } catch (error) {
            logger.error(`Failed to get diff for ${filePath}: ${error.message}`);
            throw error;
        }
    }

    async getFileContent(hash, filePath) {
        const objectPath = path.join(this.objectsPath, hash);
        try {
            return await fs.readFile(objectPath, 'utf8');
        } catch (error) {
            throw new Error(`Failed to read object ${hash}: ${error.message}`);
        }
    }
}

module.exports = DiffManager;
