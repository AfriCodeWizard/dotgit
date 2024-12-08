const fs = require('fs').promises;
const ignore = require('ignore');

class IgnoreManager {
    constructor() {
        this.ig = ignore();
        this.rules = new Map();
        this.ig.add([
            '.dotgit/',
            '.dotgitignore',
            '.DS_Store',
            'Thumbs.db',
            'desktop.ini',
            'node_modules/',
            'npm-debug.log',
            '*.swp',
            '*~',
            '.idea/',
            '.vscode/'
        ]);
    }

    async loadIgnoreFile(filePath = '.dotgitignore') {
        try {
            const content = await fs.readFile(filePath, 'utf8');
            const lines = content.split('\n').filter(line => line.trim() && !line.startsWith('#'));
            this.ig.add(lines); // Properly add lines to the ignore instance
        } catch (error) {
            if (error.code !== 'ENOENT') {
                console.warn(`Failed to load ignore file: ${error.message}`);
            }
        }
    }

    isIgnored(filePath) {
        return this.ig.ignores(filePath);
    }

    getRules() {
        return Array.from(this.rules.values());
    }

    printRules() {
        console.log('Current ignore rules:');
        this.getRules().forEach(rule => console.log(`- ${rule}`));
    }
}

module.exports = IgnoreManager;
