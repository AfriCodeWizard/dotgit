#!/usr/bin/env node

const { program } = require('commander');
const path = require('path');
const { DotGit } = require('./DotGit');
const { logger } = require('./Logger');
const packageJson = require('../package.json');

// Initialize DotGit instance
const dotgit = new DotGit(process.cwd());

// Configure CLI
program
    .name('dotgit')
    .description('A simplified Git implementation')
    .version(packageJson.version);

// Initialize repository
program
    .command('init')
    .description('Initialize a new repository')
    .action(async () => {
        try {
            await dotgit.init();
            logger.success('Initialized empty DotGit repository');
        } catch (error) {
            logger.error(error.message);
            process.exit(1);
        }
    });

// Add files to staging area
program
    .command('add')
    .description('Add files to the staging area')
    .argument('<files...>', 'Files to add')
    .action(async (files) => {
        try {
            await dotgit.add(files);
        } catch (error) {
            logger.error(error.message);
            process.exit(1);
        }
    });

// Commit changes
program
    .command('commit')
    .description('Commit staged changes')
    .option('-m, --message <message>', 'Commit message')
    .action(async (options) => {
        try {
            if (!options.message) {
                logger.error('Commit message is required');
                process.exit(1);
            }
            await dotgit.commit(options.message);
        } catch (error) {
            logger.error(error.message);
            process.exit(1);
        }
    });

// Show repository status
program
    .command('status')
    .description('Show repository status')
    .action(async () => {
        try {
            await dotgit.status();
        } catch (error) {
            logger.error(error.message);
            process.exit(1);
        }
    });

// Branch operations
program
    .command('branch')
    .description('Branch operations')
    .argument('[name]', 'Branch name')
    .option('-d, --delete', 'Delete branch')
    .option('-c, --checkout', 'Checkout branch after creation')
    .action(async (name, options) => {
        try {
            if (options.delete) {
                await dotgit.branchManager.deleteBranch(name);
            } else {
                await dotgit.branch(name, options);
            }
        } catch (error) {
            logger.error(error.message);
            process.exit(1);
        }
    });

// Checkout branch or commit
program
    .command('checkout')
    .description('Checkout a branch or commit')
    .argument('<ref>', 'Branch or commit reference')
    .option('-b, --branch', 'Create and checkout new branch')
    .action(async (ref, options) => {
        try {
            if (options.branch) {
                await dotgit.branch(ref, { checkout: true });
            } else {
                await dotgit.checkout(ref);
            }
        } catch (error) {
            logger.error(error.message);
            process.exit(1);
        }
    });

// Merge branches
program
    .command('merge')
    .description('Merge branches')
    .argument('<branch>', 'Branch to merge')
    .option('--no-ff', 'Create merge commit even if fast-forward is possible')
    .option('--ff-only', 'Only allow fast-forward merges')
    .action(async (branch, options) => {
        try {
            await dotgit.merge(branch, options);
        } catch (error) {
            logger.error(error.message);
            process.exit(1);
        }
    });

// Remote operations
program
    .command('remote')
    .description('Remote operations')
    .argument('[command]', 'Command (add, remove)')
    .argument('[name]', 'Remote name')
    .argument('[url]', 'Remote URL')
    .action(async (command, name, url) => {
        try {
            await dotgit.remote(command, name, url);
        } catch (error) {
            logger.error(error.message);
            process.exit(1);
        }
    });

// Show differences
program
    .command('diff')
    .description('Show changes between commits, commit and working tree, etc')
    .option('--staged', 'Show staged changes')
    .option('--cached', 'Alias for --staged')
    .action(async (options) => {
        try {
            await dotgit.diff(options);
        } catch (error) {
            logger.error(error.message);
            process.exit(1);
        }
    });

// Config operations
program
    .command('config')
    .description('Get and set repository options')
    .argument('[key]', 'Config key')
    .argument('[value]', 'Config value')
    .option('-l, --list', 'List all config values')
    .action(async (key, value, options) => {
        try {
            if (options.list) {
                const config = await dotgit.configManager.get();
                console.log(JSON.stringify(config, null, 2));
            } else if (key && value) {
                const [section, name] = key.split('.');
                await dotgit.configManager.set(section, name, value);
            } else if (key) {
                const [section, name] = key.split('.');
                const value = await dotgit.configManager.get(section, name);
                console.log(value);
            }
        } catch (error) {
            logger.error(error.message);
            process.exit(1);
        }
    });

// Debug mode
program
    .option('--debug', 'Enable debug mode')
    .hook('preAction', (thisCommand) => {
        if (thisCommand.opts().debug) {
            logger.debugMode = true;
        }
    });

// Log command
program
    .command('log')
    .description('Show commit logs')
    .option('-n, --number <number>', 'Limit number of commits', parseInt)
    .option('--oneline', 'Show each commit on a single line')
    .option('--graph', 'Show ASCII graph of branch and merge history')
    .action(async (options) => {
        try {
            await dotgit.log(options);
        } catch (error) {
            logger.error(error.message);
            process.exit(1);
        }
    });

// Tag operations
program
    .command('tag')
    .description('Create, list, delete or verify tags')
    .argument('[tagname]', 'Tag name')
    .option('-a, --annotate', 'Create an annotated tag')
    .option('-m, --message <message>', 'Tag message')
    .option('-d, --delete', 'Delete tag')
    .option('-l, --list', 'List tags')
    .action(async (tagname, options) => {
        try {
            if (options.list) {
                const tags = await dotgit.refManager.listTags();
                tags.forEach(tag => {
                    console.log(tag.name);
                });
            } else if (options.delete) {
                await dotgit.refManager.deleteTag(tagname);
            } else if (tagname) {
                const head = await dotgit.refManager.getHead();
                await dotgit.refManager.createTag(tagname, head.hash, options.message);
            }
        } catch (error) {
            logger.error(error.message);
            process.exit(1);
        }
    });

// Reset command
program
    .command('reset')
    .description('Reset current HEAD to specified state')
    .argument('<commit>', 'Commit hash or reference')
    .option('--hard', 'Reset working tree and index')
    .option('--soft', 'Only reset HEAD')
    .option('--mixed', 'Reset HEAD and index')
    .action(async (commit, options) => {
        try {
            await dotgit.reset(commit, {
                mode: options.hard ? 'hard' : options.soft ? 'soft' : 'mixed'
            });
        } catch (error) {
            logger.error(error.message);
            process.exit(1);
        }
    });

// Stash operations
program
    .command('stash')
    .description('Stash working directory changes')
    .argument('[command]', 'Stash command (push, pop, list, drop)')
    .option('-m, --message <message>', 'Stash message')
    .action(async (command = 'push', options) => {
        try {
            switch (command) {
                case 'push':
                    await dotgit.stash.push(options.message);
                    break;
                case 'pop':
                    await dotgit.stash.pop();
                    break;
                case 'list':
                    const stashes = await dotgit.stash.list();
                    stashes.forEach(stash => {
                        console.log(`stash@{${stash.index}}: ${stash.message}`);
                    });
                    break;
                case 'drop':
                    await dotgit.stash.drop();
                    break;
                default:
                    logger.error(`Unknown stash command: ${command}`);
                    process.exit(1);
            }
        } catch (error) {
            logger.error(error.message);
            process.exit(1);
        }
    });

// Clean command
program
    .command('clean')
    .description('Remove untracked files from working tree')
    .option('-n, --dry-run', 'Show what would be done')
    .option('-f, --force', 'Force clean')
    .option('-d, --directories', 'Remove untracked directories too')
    .action(async (options) => {
        try {
            await dotgit.clean(options);
        } catch (error) {
            logger.error(error.message);
            process.exit(1);
        }
    });

// Show command
program
    .command('show')
    .description('Show various types of objects')
    .argument('<object>', 'Object to show (commit, tag, etc.)')
    .action(async (object) => {
        try {
            await dotgit.show(object);
        } catch (error) {
            logger.error(error.message);
            process.exit(1);
        }
    });

// Parse command line arguments
program.parse();