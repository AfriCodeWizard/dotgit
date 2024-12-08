const colors = {
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    reset: '\x1b[0m'
};

class Logger {
    constructor(options = {}) {
        this.debugMode = options.debug || false;
        this.quiet = options.quiet || false;
        this.logLevel = options.logLevel || 'info';
        
        // Log levels: debug < info < warn < error
        this.levels = {
            debug: 0,
            info: 1,
            warn: 2,
            error: 3
        };
    }

    shouldLog(level) {
        return !this.quiet && this.levels[level] >= this.levels[this.logLevel];
    }

    debug(message, ...args) {
        if (this.debugMode && this.shouldLog('debug')) {
            console.log(colors.cyan + '[DEBUG] ' + colors.reset + message, ...args);
        }
    }

    info(message, ...args) {
        if (this.shouldLog('info')) {
            console.log(colors.green + '[INFO] ' + colors.reset + message, ...args);
        }
    }

    warn(message, ...args) {
        if (this.shouldLog('warn')) {
            console.warn(colors.yellow + '[WARN] ' + colors.reset + message, ...args);
        }
    }

    error(message, ...args) {
        if (this.shouldLog('error')) {
            console.error(colors.red + '[ERROR] ' + colors.reset + message, ...args);
        }
    }

    success(message, ...args) {
        if (this.shouldLog('info')) {
            console.log(colors.green + '[SUCCESS] ' + colors.reset + message, ...args);
        }
    }

    // Special logging methods for specific operations
    commitInfo(hash, message) {
        this.info(`[${hash.slice(0, 7)}] ${message}`);
    }

    fileStatus(status, path) {
        const statusColors = {
            added: colors.green,
            modified: colors.yellow,
            deleted: colors.red,
            renamed: colors.blue
        };
        
        const color = statusColors[status] || colors.reset;
        this.info(`${color}${status.padEnd(8)}${colors.reset} ${path}`);
    }

    progressBar(current, total, width = 40) {
        if (!this.shouldLog('info')) return;

        const percentage = Math.round((current / total) * 100);
        const filled = Math.round((width * current) / total);
        const empty = width - filled;

        const bar = '█'.repeat(filled) + '░'.repeat(empty);
        process.stdout.write(`\r${colors.cyan}Progress: ${colors.reset}${bar} ${percentage}%`);
        
        if (current === total) {
            process.stdout.write('\n');
        }
    }
}

// Create and export a singleton instance
const logger = new Logger();

module.exports = {
    Logger,
    logger
};
