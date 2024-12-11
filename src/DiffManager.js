const fs = require('fs').promises;
const path = require('path');
const { logger } = require('./Logger');

// Custom error for failed file reading
class FileNotFoundError extends Error {
    constructor(filePath) {
        super(`File not found: ${filePath}`);
        this.name = 'FileNotFoundError';
    }
}

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
            if (oldIndex < oldLines.length && newIndex < newLines.length) {
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
                } else {
                    // Lines are different, treat as modification
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
            } else if (oldIndex < oldLines.length) {
                // Remaining old lines are deletions
                changes.push({
                    type: 'delete',
                    oldStart: oldIndex,
                    oldLines: [oldLines[oldIndex]],
                    newStart: newIndex,
                    newLines: 0
                });
                oldIndex++;
            } else if (newIndex < newLines.length) {
                // Remaining new lines are additions
                changes.push({
                    type: 'add',
                    oldStart: oldIndex,
                    oldLines: 0,
                    newStart: newIndex,
                    newLines: [newLines[newIndex]]
                });
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
        let lastChangeIndex = -1;

        for (let i = 0; i < changes.length; i++) {
            const change = changes[i];

            if (change.type === 'same') {
                // Handle context lines around changes
                if (unified) {
                    const isBeforeChange =
                        i > 0 && changes[i - 1].type !== 'same';
                    const isAfterChange =
                        i < changes.length - 1 && changes[i + 1].type !== 'same';

                    if (isBeforeChange || isAfterChange) {
                        const inContextRange =
                            lastChangeIndex === -1 ||
                            i - lastChangeIndex <= context;

                        if (inContextRange) {
                            output.push(this.formatLine(' ', change.oldLines[0], colorize));
                            lastChangeIndex = i;
                        }
                    }
                } else {
                    output.push(this.formatLine(' ', change.oldLines[0], colorize));
                }
            } else {
                // Handle non-context changes
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

                lastChangeIndex = i; // Update lastChangeIndex for context tracking
            }
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
            throw new FileNotFoundError(hash);
        }
    }
}

module.exports = DiffManager;
