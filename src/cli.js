#!/usr/bin/env node

const { program } = require('commander');
const { DotGit } = require('./DotGit');
const chalk = require('chalk');
const path = require('path');

// Create DotGit instance for current directory
const dotgit = new DotGit(process.cwd());

program
    .name('dotgit')
    .description('JavaScript implementation of Git core functionality')
    .version('1.0.0');

program
    .command('init')
    .description('Initialize a new repository')
    .action(async () => {
        try {
            await dotgit.init();
            console.log(chalk.green('Initialized empty DotGit repository'));
        } catch (error) {
            console.error(chalk.red(`Error: ${error.message}`));
            process.exit(1);
        }
    });

program
    .command('add <files...>')
    .description('Add files to staging area')
    .action(async (files) => {
        try {
            await dotgit.add(files);
            console.log(chalk.green(`Added ${files.length} files to staging area`));
        } catch (error) {
            console.error(chalk.red(`Error: ${error.message}`));
            process.exit(1);
        }
    });

program
    .command('commit')
    .description('Create a new commit')
    .option('-m, --message <message>', 'commit message')
    .action(async (options) => {
        try {
            if (!options.message) {
                console.error(chalk.red('Error: commit message is required'));
                process.exit(1);
            }
            const hash = await dotgit.commit(options.message);
            console.log(chalk.green(`Created commit ${hash}`));
        } catch (error) {
            console.error(chalk.red(`Error: ${error.message}`));
            process.exit(1);
        }
    });

program
    .command('status')
    .description('Show repository status')
    .action(async () => {
        try {
            const status = await dotgit.status();
            console.log(status);
        } catch (error) {
            console.error(chalk.red(`Error: ${error.message}`));
            process.exit(1);
        }
    });

program
    .command('branch [name]')
    .description('List or create branches')
    .option('-d, --delete', 'delete branch')
    .option('-m, --move <newName>', 'rename branch')
    .action(async (name, options) => {
        try {
            if (!name) {
                const branches = await dotgit.branchManager.listBranches();
                branches.all.forEach(branch => {
                    if (branch === branches.current) {
                        console.log(chalk.green(`* ${branch}`));
                    } else {
                        console.log(`  ${branch}`);
                    }
                });
                return;
            }

            if (options.delete) {
                await dotgit.deleteBranch(name);
                console.log(chalk.green(`Deleted branch ${name}`));
            } else if (options.move) {
                await dotgit.branch('-m', name, options.move);
                console.log(chalk.green(`Renamed branch ${name} to ${options.move}`));
            } else {
                await dotgit.branch(name);
                console.log(chalk.green(`Created branch ${name}`));
            }
        } catch (error) {
            console.error(chalk.red(`Error: ${error.message}`));
            process.exit(1);
        }
    });

program
    .command('checkout <branch>')
    .description('Switch branches')
    .option('-b', 'create and checkout new branch')
    .action(async (branch, options) => {
        try {
            if (options.b) {
                await dotgit.branch(branch);
            }
            await dotgit.checkout(branch);
            console.log(chalk.green(`Switched to branch ${branch}`));
        } catch (error) {
            console.error(chalk.red(`Error: ${error.message}`));
            process.exit(1);
        }
    });

program
    .command('diff')
    .description('Show changes')
    .option('--staged', 'show staged changes')
    .action(async (options) => {
        try {
            const diff = await dotgit.diff(options);
            console.log(diff);
        } catch (error) {
            console.error(chalk.red(`Error: ${error.message}`));
            process.exit(1);
        }
    });

program
    .command('remote')
    .description('Manage remote repositories')
    .argument('<command>', 'remote command (add, remove, etc.)')
    .argument('[args...]', 'command arguments')
    .action(async (command, args) => {
        try {
            await dotgit.remote(command, ...args);
            console.log(chalk.green('Remote operation completed successfully'));
        } catch (error) {
            console.error(chalk.red(`Error: ${error.message}`));
            process.exit(1);
        }
    });

program
    .command('merge <branch>')
    .description('Merge branches')
    .option('--no-ff', 'create merge commit even if fast-forward is possible')
    .action(async (branch, options) => {
        try {
            const result = await dotgit.merge(branch, options);
            if (result.success) {
                console.log(chalk.green('Merge completed successfully'));
            } else {
                console.log(chalk.yellow('Merge resulted in conflicts'));
                result.conflicts.forEach(file => {
                    console.log(chalk.yellow(`  ${file}`));
                });
            }
        } catch (error) {
            console.error(chalk.red(`Error: ${error.message}`));
            process.exit(1);
        }
    });

// Parse command line arguments
program.parse();