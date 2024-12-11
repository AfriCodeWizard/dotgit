const fs = require('fs').promises;
const ignore = require('ignore');

class IgnoreManager {
    constructor() {
        this.ig = ignore(); // Create ignore instance
        this.rules = new Set(); // Use Set for better rule management (ensures uniqueness)
        
        // Default rules
        const defaultRules = [
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
        ];
        
        this.addRules(defaultRules); // Add default rules to both ig and rules set
    }

    /**
     * Add ignore rules to the ignore instance and rules set
     * @param {string[]} rules - Array of rules to add
     */
    addRules(rules) {
        rules.forEach(rule => {
            if (!this.rules.has(rule)) {
                this.rules.add(rule);
                this.ig.add(rule); // Add to ignore instance
            }
        });
    }

    /**
     * Load ignore rules from a file and add to ignore instance
     * @param {string} filePath - Path to the .dotgitignore file
     */
    async loadIgnoreFile(filePath = '.dotgitignore') {
        try {
            const content = await fs.readFile(filePath, 'utf8');
            const lines = content.split('\n').filter(line => line.trim() && !line.startsWith('#'));
            this.addRules(lines); // Add lines to the ignore instance and rules set
        } catch (error) {
            if (error.code !== 'ENOENT') {
                console.warn(`Failed to load ignore file: ${error.message}`);
            }
        }
    }

    /**
     * Check if a file is ignored based on the current rules
     * @param {string} filePath - Path to the file to check
     * @returns {boolean} - Whether the file is ignored
     */
    isIgnored(filePath) {
        return this.ig.ignores(filePath);
    }

    /**
     * Get all the ignore rules
     * @returns {string[]} - Array of ignore rules
     */
    getRules() {
        return Array.from(this.rules);
    }

    /**
     * Print the current ignore rules
     */
    printRules() {
        console.log('Current ignore rules:');
        const sortedRules = [...this.rules].sort();
        sortedRules.forEach(rule => console.log(`- ${rule}`));
    }
}

module.exports = IgnoreManager;
