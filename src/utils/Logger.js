class Logger {
    static LEVELS = {
        DEBUG: 0,
        INFO: 1,
        WARN: 2,
        ERROR: 3
    };

    constructor(options = {}) {
        this.level = options.level || Logger.LEVELS.INFO;
        this.verbose = options.verbose || false;
        this.logToFile = options.logToFile || false;
        this.logPath = options.logPath || '.dotgit/logs/dotgit.log';
    }

    async log(level, message, ...args) {
        if (level < this.level) return;

        const timestamp = new Date().toISOString();
        const formattedMessage = `[${timestamp}] [${this.getLevelName(level)}] ${message}`;
        
        console.log(formattedMessage, ...args);

        if (this.logToFile) {
            await this.writeToFile(formattedMessage, ...args);
        }
    }

    debug(message, ...args) {
        return this.log(Logger.LEVELS.DEBUG, message, ...args);
    }

    info(message, ...args) {
        return this.log(Logger.LEVELS.INFO, message, ...args);
    }

    warn(message, ...args) {
        return this.log(Logger.LEVELS.WARN, message, ...args);
    }

    error(message, ...args) {
        return this.log(Logger.LEVELS.ERROR, message, ...args);
    }

    getLevelName(level) {
        return Object.entries(Logger.LEVELS)
            .find(([, value]) => value === level)?.[0] || 'UNKNOWN';
    }

    async writeToFile(message, ...args) {
        // Implementation for file logging
    }
}