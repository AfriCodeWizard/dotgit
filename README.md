# Distributed-Source-Control-System-DSCS---Inspired-by-Git
This project is a lightweight, file-based distributed source control system designed in the style of Git. It provides core version control functionalities to track file changes, manage branches, and collaborate on projects—all within a custom repository structure.

# Features
Initialize a Repository: Create a .dotgit directory with all necessary subdirectories and configuration files.
Staging Area (git add): Stage files for commits by tracking changes and preparing snapshots.
Committing Changes: Save a snapshot of staged files with metadata like author, timestamp, and message.
View Commit History: Traverse the commit graph to display detailed commit logs.
Branching: Create and switch between branches for parallel development.
Merging: Combine changes from different branches with basic conflict detection.
Diffing: Compare changes between commits or branches.
Cloning: Copy an existing repository to a new location on disk.
Ignore Files: Use a .dotgitignore file to exclude specific files or patterns from tracking.

# How It Works
The system mimics Git's architecture:
All repository data is stored in a .dotgit directory.
Files are hashed and stored as objects.
Branches are managed through reference files under .dotgit/refs/heads.
The HEAD file tracks the current branch.

# dotgit Documentation

## Table of Contents
- [Overview](#overview)
- [Installation](#installation)
- [CLI Commands](#cli-commands)
- [Repository Structure](#repository-structure)
- [Advanced Features](#advanced-features)
- [Troubleshooting](#troubleshooting)
- [Extending dotgit](#extending-dotgit)

## Overview

dotgit is a lightweight version control system inspired by Git. It provides basic version control functionality including commits, branches, and merges, with special attention to handling binary files and large repositories.

## Installation

npm install -g dotgit

## CLI Commands

### Repository Initialization

dotgit init
Initializes a new dotgit repository in the current directory.

### Basic Operations

#### Status

dotgit status [--verbose]
Shows the current state of the working directory:
- Untracked files
- Modified files
- Staged changes
- Current branch

#### Add

dotgit add <file|pattern>
Stages files for commit:

# Add specific file

dotgit add file.txt

# Add files matching pattern

dotgit add "*.js"
```

#### Commit
```bash

dotgit commit -m "commit message"
Creates a new commit with staged changes:

# Basic commit

dotgit commit -m "Add new feature"

# Verbose commit

dotgit commit -m "Add new feature" --verbose

### Branch Operations

#### Create Branch

dotgit branch <branch-name>
Creates a new branch from the current HEAD.

#### List Branches

dotgit branch
Lists all local branches.

#### Switch Branches

dotgit checkout <branch-name>
Switches to specified branch:

# Safe checkout

dotgit checkout feature-branch

# Force checkout (discard changes)

dotgit checkout feature-branch --force

#### Merge Branches

dotgit merge <source-branch>
Merges specified branch into current branch:

# Merge feature branch into current branch

dotgit merge feature-branch

# Verbose merge with detailed output

dotgit merge feature-branch --verbose

### History and Logs

#### View History

dotgit log [--verbose]
Shows commit history with:
- Commit hash
- Author
- Date
- Message
- File changes (in verbose mode)

#### Check Ignored Files

dotgit check-ignore [files...] [--verbose] [--all]
Shows which files are ignored by .dotgitignore:

# Check specific files

dotgit check-ignore file1.txt file2.txt

# Show all ignored files

dotgit check-ignore --all

# Show detailed ignore reasons

dotgit check-ignore --verbose --all

## Repository Structure

### .dotgit Directory Layout
.dotgit/
├── HEAD # Points to current branch
├── index # Staged changes
├── objects/ # Stored objects
│ ├── commits/ # Commit objects
│ └── blobs/ # File content objects
├── refs/
│ └── heads/ # Branch references
└── .dotgitignore # Ignore patterns

### Object Types

#### Commits
Stored in `.dotgit/objects/commits/` as JSON files:

### Object Types

#### Commits
Stored in `.dotgit/objects/commits/` as JSON files:
json
{
"hash": "commit_hash",
"parent": "parent_hash",
"author": "author_name",
"timestamp": "ISO_date",
"message": "commit_message",
"files": {
"file_path": {
"hash": "content_hash",
"size": 1234,
"binary": false
}
}
}

#### Blobs
Stored in `.dotgit/objects/blobs/` with content hash as filename.

## Advanced Features

### Binary File Handling
dotgit automatically detects and properly handles binary files:
- Base64 encoding for storage
- Efficient diffing
- Proper merge handling

### Large Repository Support
Optimizations for large repositories:
- Batch processing
- Parallel operations
- Memory-efficient algorithms

### Conflict Resolution
When merge conflicts occur:
1. Automatic resolution for non-overlapping changes
2. Clear conflict markers with context
3. Detailed resolution instructions

## Troubleshooting

### Common Issues

#### Repository Not Found
Error: Not a dotgit repository
**Solution**: Ensure you're in the correct directory and run `dotgit init`.

#### Uncommitted Changes
Error: You have uncommitted changes

**Solution**: Commit or stash changes before checkout.

#### Merge Conflicts

Error: Merge conflicts detected
**Solution**:
1. Open conflicted files
2. Look for conflict markers (`<<<<<<<`, `=======`, `>>>>>>>`)
3. Edit files to resolve conflicts
4. Add resolved files
5. Commit the merge

### Performance Issues
- Use `--verbose` flag for detailed logging
- Check .dotgitignore patterns
- Consider batch operations for large changes

## Extending dotgit

### Adding New Commands

1. Create command handler:
javascript
async function handleNewCommand(options) {
// Command implementation
}

2. Register with CLI:

javascript
program
.command('new-command')
.description('New command description')
.option('-o, --option', 'Option description')
.action(handleNewCommand);


### Adding New Features

1. Extend core classes:
class ExtendedFileTree extends FileTree {

    // Add new functionality
}

2. Add new utilities:
javascript
class NewFeatureManager {
// Implement new feature
}


### Best Practices
- Follow existing code structure
- Add comprehensive tests
- Update documentation
- Handle errors gracefully
- Support verbose logging

### Example: Adding File Statistics
javascript
class FileStats {
static async getStats(filePath) {
// Implementation
}
}
// Register command
program
.command('stats [file]')
.description('Show file statistics')
.action(async (file) => {
const stats = await FileStats.getStats(file);
console.log(stats);
});


## Contributing

1. Fork the repository
2. Create feature branch
3. Add tests
4. Submit pull request

For a detailed development process, see DEVELOPMENT.md.

