/**
 * Base error class for DotGit specific errors
 */
class DotGitError extends Error {
    constructor(message) {
        super(message);
        this.name = 'DotGitError';
    }
}

/**
 * Error thrown when .dotgit directory is not found
 */
class RepositoryNotFoundError extends DotGitError {
    constructor(dir = '.') {
        super(`Not a repository: .dotgit directory not found in ${dir}`);
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
        super(`Commit ${hash} not found`);
        this.name = 'CommitNotFoundError';
    }
}

module.exports = {
    DotGitError,
    RepositoryNotFoundError,
    InvalidHeadError,
    CommitNotFoundError
};