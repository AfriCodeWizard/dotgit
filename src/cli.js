/**
 * Manage remote repositories
 */
program
    .command('remote')
    .description('Manage remote repositories')
    .argument('<subcommand>', 'add')
    .argument('<name>', 'name of the remote')
    .argument('<url>', 'url of the remote')
    .action(async (subcommand, name, url) => {
        try {
            if (!await repo.isRepository()) {
                throw new RepositoryNotFoundError();
            }

            if (subcommand === 'add') {
                await repo.addRemote(name, url);
                console.log(`Added remote '${name}' with url '${url}'`);
            } else {
                console.error('Unknown subcommand:', subcommand);
                process.exit(1);
            }
        } catch (error) {
            console.error('Error managing remote:', error.message);
            process.exit(1);
        }
    }); 