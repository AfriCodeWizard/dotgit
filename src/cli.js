#!/usr/bin/env node

const { Command } = require('commander');
const path = require('path');
const Repository = require('./Repository');
const { RepositoryNotFoundError } = require('./errors');

const program = new Command();

// Initialize repository instance
const repo = new Repository(process.cwd());

/**
 * Initialize a new repository
 */
program
    .command('init')
    .description('Initialize a new repository')
    .action(async () => {
        try {
            await repo.init();
            console.log('Initialized empty repository in .dotgit/');
        } catch (error) {
            console.error('Error initializing repository:', error.message);
            process.exit(1);
        }
    });

/**
 * Create a new commit
 */
program
    .command('commit')
    .description('Create a new commit')
    .requiredOption('-m, --message <message>', 'commit message')
    .action(async (options) => {
        try {
            if (!await repo.isRepository()) {
                throw new RepositoryNotFoundError();
            }
            const hash = await repo.commit(options.message);
            console.log(`[${hash}] ${options.message}`);
        } catch (error) {
            console.error('Error creating commit:', error.message);
            process.exit(1);
        }
    });

/**
 * Show repository status
 */
program
    .command('status')
    .description('Show repository status')
    .action(async () => {
        try {
            if (!await repo.isRepository()) {
                throw new RepositoryNotFoundError();
            }
            const currentCommit = await repo.getCurrentCommit();
            console.log(`On commit: ${currentCommit || '(no commits yet)'}`);
            
            // TODO: Show working tree status
            
        } catch (error) {
            console.error('Error showing status:', error.message);
            process.exit(1);
        }
    });

// Parse command line arguments
program.parse(process.argv); 