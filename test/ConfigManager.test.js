const { describe, it, beforeEach, afterEach } = require('mocha');
const { expect } = require('chai');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const { ConfigManager } = require('../src/ConfigManager');

describe('ConfigManager', () => {
    let testDir;
    let dotgitDir;
    let configManager;

    beforeEach(async () => {
        // Create temporary test directory
        testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'dotgit-test-'));
        dotgitDir = path.join(testDir, '.dotgit');
        await fs.mkdir(dotgitDir, { recursive: true });
        configManager = new ConfigManager(dotgitDir);
    });

    afterEach(async () => {
        // Clean up test directory
        await fs.rm(testDir, { recursive: true, force: true });
    });

    describe('load()', () => {
        it('should create default config if file does not exist', async () => {
            await configManager.load();
            
            const config = configManager.get();
            expect(config.core).to.exist;
            expect(config.user).to.exist;
            expect(config.branch.default).to.equal('main');
        });

        it('should load existing config file', async () => {
            const testConfig = {
                core: { bare: true },
                user: { name: 'test-user' }
            };
            
            await fs.writeFile(
                path.join(dotgitDir, 'config'),
                JSON.stringify(testConfig)
            );

            await configManager.load();
            expect(configManager.get()).to.deep.equal(testConfig);
        });

        it('should handle invalid config file', async () => {
            await fs.writeFile(
                path.join(dotgitDir, 'config'),
                'invalid json'
            );

            try {
                await configManager.load();
                expect.fail('Should have thrown error');
            } catch (error) {
                expect(error.message).to.include('Failed to load config');
            }
        });
    });

    describe('save()', () => {
        it('should save config to file', async () => {
            await configManager.load();
            await configManager.set('test', 'key', 'value');
            await configManager.save();

            const content = await fs.readFile(
                path.join(dotgitDir, 'config'),
                'utf8'
            );
            const saved = JSON.parse(content);
            expect(saved.test.key).to.equal('value');
        });
    });

    describe('get()', () => {
        beforeEach(async () => {
            await configManager.load();
        });

        it('should get entire config when no arguments', () => {
            const config = configManager.get();
            expect(config).to.be.an('object');
            expect(config.core).to.exist;
        });

        it('should get section when only section provided', () => {
            const core = configManager.get('core');
            expect(core).to.be.an('object');
            expect(core.bare).to.be.false;
        });

        it('should get specific value when section and key provided', () => {
            const bare = configManager.get('core', 'bare');
            expect(bare).to.be.false;
        });

        it('should return undefined for non-existent section/key', () => {
            expect(configManager.get('nonexistent')).to.be.undefined;
            expect(configManager.get('core', 'nonexistent')).to.be.undefined;
        });
    });

    describe('set()', () => {
        beforeEach(async () => {
            await configManager.load();
        });

        it('should set new value', async () => {
            await configManager.set('test', 'key', 'value');
            expect(configManager.get('test', 'key')).to.equal('value');
        });

        it('should update existing value', async () => {
            await configManager.set('core', 'bare', true);
            expect(configManager.get('core', 'bare')).to.be.true;
        });

        it('should create new section if needed', async () => {
            await configManager.set('newSection', 'key', 'value');
            expect(configManager.get('newSection')).to.exist;
            expect(configManager.get('newSection', 'key')).to.equal('value');
        });

        it('should throw error if config not loaded', async () => {
            configManager = new ConfigManager(dotgitDir);
            try {
                await configManager.set('test', 'key', 'value');
                expect.fail('Should have thrown error');
            } catch (error) {
                expect(error.message).to.equal('Config not loaded');
            }
        });
    });

    describe('unset()', () => {
        beforeEach(async () => {
            await configManager.load();
        });

        it('should remove existing value', async () => {
            await configManager.set('test', 'key', 'value');
            const removed = await configManager.unset('test', 'key');
            expect(removed).to.be.true;
            expect(configManager.get('test', 'key')).to.be.undefined;
        });

        it('should return false for non-existent value', async () => {
            const removed = await configManager.unset('nonexistent', 'key');
            expect(removed).to.be.false;
        });

        it('should remove empty sections', async () => {
            await configManager.set('test', 'key', 'value');
            await configManager.unset('test', 'key');
            expect(configManager.get('test')).to.be.undefined;
        });
    });

    describe('user management', () => {
        beforeEach(async () => {
            await configManager.load();
        });

        it('should set user information', async () => {
            await configManager.setUser('test-user', 'test@example.com');
            const user = configManager.getUser();
            expect(user.name).to.equal('test-user');
            expect(user.email).to.equal('test@example.com');
        });
    });

    describe('remote management', () => {
        beforeEach(async () => {
            await configManager.load();
        });

        it('should add remote', async () => {
            await configManager.addRemote('origin', 'https://example.com/repo.git');
            const remotes = configManager.getRemotes();
            expect(remotes.origin.url).to.equal('https://example.com/repo.git');
        });
    });

    describe('branch management', () => {
        beforeEach(async () => {
            await configManager.load();
        });

        it('should set default branch', async () => {
            await configManager.setDefaultBranch('develop');
            expect(configManager.getDefaultBranch()).to.equal('develop');
        });

        it('should return main as default branch if not set', async () => {
            expect(configManager.getDefaultBranch()).to.equal('main');
        });
    });
});
