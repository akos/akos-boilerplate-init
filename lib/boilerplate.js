'use strict';
const urllib = require('urllib');
const updater = require('npm-updater');
const inquirer = require('inquirer');
const ProxyAgent = require('proxy-agent');
const ora = require('ora');
const chalk = require('chalk');
const symbols = require('log-symbols');
const baseClass = require('./base');

require('colors');

module.exports = class Command extends baseClass {
  constructor(options) {
    super();
    options = options || {};
    this.name = options.name || 'create-akos';
    this.configName = options.configName || 'akos-boilerplate-init-config';
    this.pkgInfo = options.pkgInfo || require('../package.json');
    this.needUpdate = options.needUpdate !== false;
    this.httpClient = urllib.create();

    this.inquirer = inquirer;
    this.fileMapping = {
      gitignore: '.gitignore',
      _gitignore: '.gitignore',
      '_.gitignore': '.gitignore',
      '_package.json': 'package.json',
      '_.eslintignore': '.eslintignore',
      '_.npmignore': '.npmignore',
    };
  }

  async run(cwd, args) {
    const argv = this.argv = this.getParser().parse(args || []);
    this.cwd = cwd;
    // console.log('%j', argv);

    const proxyHost = process.env.http_proxy || process.env.HTTP_PROXY;
    if (proxyHost) {
      const proxyAgent = new ProxyAgent(proxyHost);
      this.httpClient.agent = proxyAgent;
      this.httpClient.httpsAgent = proxyAgent;
      this.log(`use http_proxy: ${proxyHost}`);
    }

    // detect registry url
    this.registryUrl = this.getRegistryByType(argv.registry);
    this.log(`use registry: ${this.registryUrl}`);

    if (this.needUpdate) {
      // check update
      const npmSpinner = ora('create-akos is newest');
      npmSpinner.start();
      await updater({
        package: this.pkgInfo,
        registry: this.registryUrl,
        level: 'major',
      });
      npmSpinner.succeed();
    }

    // ask for target dir
    this.targetDir = await this.getTargetDirectory();

    // use local template
    let templateDir = await this.getTemplateDir();
    let pkgName = '';
    if (!templateDir) {
      // support --package=<npm name>
      pkgName = this.argv.package;
      if (!pkgName) {
        // list boilerplate
        const boilerplateMapping = await this.fetchBoilerplateMapping();
        // ask for boilerplate
        let boilerplate;
        if (argv.type && boilerplateMapping.hasOwnProperty(argv.type)) {
          boilerplate = boilerplateMapping[argv.type];
        } else {
          boilerplate = await this.askForBoilerplateType(boilerplateMapping);
          if (!boilerplate) return;
        }
        this.log(`use boilerplate: ${boilerplate.name}(${boilerplate.package})`);
        // boilerplate all info in akos-boilerplate-init-config
        pkgName = boilerplate.package;
      }

      // download boilerplate
      templateDir = await this.downloadBoilerplate(pkgName);
    }
    // copy template
    await this.processFiles(this.targetDir, templateDir);

    // deal with pkgName's keyword'akos-fullstack-{...}
    const pkgNameArray = pkgName.split('-');
    const biolerplateType = pkgNameArray[1];
    // done
    // fill in fullstack
    if (biolerplateType === 'fullstack') {
      //  // fill in fullstack -> client
      const clientBoilerplateMapping = await this.fetchBoilerplateMapping(pkgName, 'client');
      const clientBoilerplate = await this.askForBoilerplateType(clientBoilerplateMapping, 'client');

      if (!clientBoilerplate) return;

      const clientPkgName = clientBoilerplate.package;
      templateDir = await this.downloadBoilerplate(clientPkgName);

      const clientDir = this.targetDir + '/client';
      await this.processFiles(clientDir, templateDir);
      console.log(symbols.success, chalk.green(`fullstack-client:${clientPkgName} init is success`));

      // fill in fullstack -> server
      const serverBoilerplateMapping = await this.fetchBoilerplateMapping(pkgName, 'server');
      const serverBoilerplate = await this.askForBoilerplateType(serverBoilerplateMapping, 'server');

      if (!serverBoilerplate) return;

      const serverPkgName = serverBoilerplate.package;
      templateDir = await this.downloadBoilerplate(serverPkgName);

      const serverDir = this.targetDir + '/server';
      await this.processFiles(serverDir, templateDir);
      console.log(symbols.success, chalk.green(`fullstack-server:${serverPkgName} init is success`));

      this.fullstackPrintUsage(this.targetDir);
    } else {
      this.printUsage(this.targetDir);
    }

    console.log(symbols.success, chalk.green('akos-biolerplate-init is success'));
  }
};
