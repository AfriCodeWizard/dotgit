/**
 * Base error class for DotGit specific errors
 */
class DotGitError extends Error {
    constructor(message) {
        super(message);
        this.name = 'DotGitError';
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, DotGitError);
        }
    }
}

/**
 * Error thrown when .dotgit directory is not found
 */
class RepositoryNotFoundError extends DotGitError {
    constructor(dir = '.') {
        const message = `Not a repository: .dotgit directory not found in ${dir}`;
        super(message);
        this.name = 'RepositoryNotFoundError';
    }
}

/**
 * Error thrown when HEAD file has invalid format
 */
class InvalidHeadError extends DotGitError {
    constructor(message = 'Invalid HEAD format') {
        super(message);
        this.name = 'InvalidHeadError';
    }
}

/**
 * Error thrown when a commit cannot be found
 */
class CommitNotFoundError extends DotGitError {
    constructor(hash) {
        const message = `Commit ${hash} not found`;
        super(message);
        this.name = 'CommitNotFoundError';
    }
}

module.exports = {
    DotGitError,
    RepositoryNotFoundError,
    InvalidHeadError,
    CommitNotFoundError
};
