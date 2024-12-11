const { describe, it, beforeEach, afterEach } = require('mocha');
const { expect } = require('chai');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const  RemoteManager  = require('../src/RemoteManager');

describe('RemoteManager', () => {
    let testDir;
    let dotgitDir;
    let remoteManager;

    beforeEach(async () => {
        // Create temporary test directory
        testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'dotgit-test-'));
        dotgitDir = path.join(testDir, '.dotgit');
        await fs.mkdir(dotgitDir);
        remoteManager = new RemoteManager(dotgitDir);
    });

    afterEach(async () => {
        // Clean up test directory
        await fs.rm(testDir, { recursive: true, force: true });
    });

    describe('init()', () => {
        it('should initialize remotes file', async () => {
            await remoteManager.init();
            
            const remotesExists = await fs.access(remoteManager.remotesPath)
                .then(() => true)
                .catch(() => false);
            expect(remotesExists).to.be.true;

            const content = await fs.readFile(remoteManager.remotesPath, 'utf8');
            expect(JSON.parse(content)).to.deep.equal({});
        });

        it('should load existing remotes file', async () => {
            const testRemotes = {
                origin: { url: 'https://example.com/repo.git' }
            };
            
            await fs.writeFile(
                remoteManager.remotesPath,
                JSON.stringify(testRemotes)
            );

            await remoteManager.init();
            const remotes = await remoteManager.getRemotes();
            expect(remotes).to.deep.equal(testRemotes);
        });
    });

    describe('addRemote()', () => {
        beforeEach(async () => {
            await remoteManager.init();
        });

        it('should add new remote', async () => {
            await remoteManager.addRemote('origin', 'https://example.com/repo.git');
            
            const remotes = await remoteManager.getRemotes();
            expect(remotes.origin).to.exist;
            expect(remotes.origin.url).to.equal('https://example.com/repo.git');
        });

        it('should throw error if remote already exists', async () => {
            await remoteManager.addRemote('origin', 'https://example.com/repo.git');
            
            try {
                await remoteManager.addRemote('origin', 'https://other.com/repo.git');
                expect.fail('Should have thrown error');
            } catch (error) {
                expect(error.message).to.include('already exists');
            }
        });

        it('should validate remote name and URL', async () => {
            try {
                await remoteManager.addRemote('', 'https://example.com/repo.git');
                expect.fail('Should have thrown error');
            } catch (error) {
                expect(error.message).to.include('required');
            }

            try {
                await remoteManager.addRemote('origin', '');
                expect.fail('Should have thrown error');
            } catch (error) {
                expect(error.message).to.include('required');
            }
        });
    });

    describe('removeRemote()', () => {
        beforeEach(async () => {
            await remoteManager.init();
        });

        it('should remove existing remote', async () => {
            await remoteManager.addRemote('origin', 'https://example.com/repo.git');
            await remoteManager.removeRemote('origin');
            
            const remotes = await remoteManager.getRemotes();
            expect(remotes.origin).to.be.undefined;
        });

        it('should throw error for non-existent remote', async () => {
            try {
                await remoteManager.removeRemote('nonexistent');
                expect.fail('Should have thrown error');
            } catch (error) {
                expect(error.message).to.include('does not exist');
            }
        });
    });

    describe('setRemoteUrl()', () => {
        beforeEach(async () => {
            await remoteManager.init();
            await remoteManager.addRemote('origin', 'https://example.com/repo.git');
        });

        it('should update remote URL', async () => {
            await remoteManager.setRemoteUrl('origin', 'https://new.com/repo.git');
            
            const remotes = await remoteManager.getRemotes();
            expect(remotes.origin.url).to.equal('https://new.com/repo.git');
        });

        it('should throw error for non-existent remote', async () => {
            try {
                await remoteManager.setRemoteUrl('nonexistent', 'https://new.com/repo.git');
                expect.fail('Should have thrown error');
            } catch (error) {
                expect(error.message).to.include('does not exist');
            }
        });
    });

    describe('setRemoteFetch()', () => {
        beforeEach(async () => {
            await remoteManager.init();
            await remoteManager.addRemote('origin', 'https://example.com/repo.git');
        });

        it('should set fetch refspec', async () => {
            const refspec = '+refs/heads/*:refs/remotes/origin/*';
            await remoteManager.setRemoteFetch('origin', refspec);
            
            const remotes = await remoteManager.getRemotes();
            expect(remotes.origin.fetch).to.equal(refspec);
        });
    });

    describe('setRemotePush()', () => {
        beforeEach(async () => {
            await remoteManager.init();
            await remoteManager.addRemote('origin', 'https://example.com/repo.git');
        });

        it('should set push refspec', async () => {
            const refspec = 'refs/heads/main:refs/heads/main';
            await remoteManager.setRemotePush('origin', refspec);
            
            const remotes = await remoteManager.getRemotes();
            expect(remotes.origin.push).to.equal(refspec);
        });
    });

    describe('setRemoteMirror()', () => {
        beforeEach(async () => {
            await remoteManager.init();
            await remoteManager.addRemote('origin', 'https://example.com/repo.git');
        });

        it('should set mirror flag', async () => {
            await remoteManager.setRemoteMirror('origin', true);
            
            const remotes = await remoteManager.getRemotes();
            expect(remotes.origin.mirror).to.be.true;
        });
    });

    describe('listRemotes()', () => {
        beforeEach(async () => {
            await remoteManager.init();
        });

        it('should list remotes without details', async () => {
            await remoteManager.addRemote('origin', 'https://example.com/repo.git');
            await remoteManager.addRemote('upstream', 'https://upstream.com/repo.git');
            
            const remotes = await remoteManager.listRemotes();
            expect(remotes).to.have.members(['origin', 'upstream']);
        });

        it('should list remotes with details', async () => {
            await remoteManager.addRemote('origin', 'https://example.com/repo.git');
            await remoteManager.setRemoteFetch('origin', '+refs/heads/*:refs/remotes/origin/*');
            
            const remotes = await remoteManager.listRemotes(true);
            expect(remotes[0].name).to.equal('origin');
            expect(remotes[0].url).to.equal('https://example.com/repo.git');
            expect(remotes[0].fetch).to.exist;
        });
    });

    describe('validateRemote()', () => {
        beforeEach(async () => {
            await remoteManager.init();
        });

        it('should validate existing remote', async () => {
            await remoteManager.addRemote('origin', 'https://example.com/repo.git');
            
            const remote = await remoteManager.validateRemote('origin');
            expect(remote).to.exist;
            expect(remote.url).to.equal('https://example.com/repo.git');
        });

        it('should throw error for non-existent remote', async () => {
            try {
                await remoteManager.validateRemote('nonexistent');
                expect.fail('Should have thrown error');
            } catch (error) {
                expect(error.message).to.include('does not exist');
            }
        });
    });
});
