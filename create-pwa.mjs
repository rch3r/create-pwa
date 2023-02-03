#!/usr/bin/env node
const [, , ...args] = process.argv;

import { dirname } from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { exec } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

import chokidar from 'chokidar';
import { format } from 'prettier';

const pwd = process.cwd();
const run = promisify(exec);
const commands = new Set(['development', 'watch']);
const __dirname = dirname(fileURLToPath(import.meta.url));

if (args.length) {
  const missing = args.every((arg) => {
    const has = commands.has(arg);
    if (!has) {
      console.error(`ERROR > ${arg} is not a valid option`);
      console.error('INFO > Options: development | watch}');
    }
    return has;
  });
}

const watch = args.some((arg) => arg === 'watch');
const development = args.some((arg) => arg === 'development');

console.log({ pwd, args, __dirname });
console.log({ watch, development });

const generate = async () => {
  const folder = './public';
  if (existsSync(folder)) {
    const { stdout } = await run(
      `find ${folder} -type f | egrep -v ".map|service-worker.js" | cut -d '/' -f 3-`,
    );
    const std = stdout
      .split('\n')
      .filter((file) => !!file)
      .map((file) => `/${file}`);

    let build = std.filter((file) => file.startsWith('/build/'));
    const files = std.filter((file) => !file.startsWith('/build/'));
    const version = build
      .find((file) => file.indexOf('manifest') !== -1)
      ?.split('-')
      .pop()
      .split('.')
      .shift();

    if (development) {
      build = [];
    }

    if (version) {
      const file = readFileSync(`${__dirname}/service-worker.js`, {
        encoding: 'utf-8',
      })
        .replace('${version}', version)
        .replace("'${build}'", JSON.stringify(build))
        .replace("'${files}'", JSON.stringify(files));

      const result = format(file, {
        parser: 'babel',
        tabWidth: 2,
        useTabs: false,
        singleQuote: true,
        trailingComma: 'all',
        printWidth: 80,
      });

      writeFileSync(`${pwd}/public/service-worker.js`, result);
    } else {
      console.error(`ERROR > manifest file doesn't exist`);
    }
  } else {
    console.error(`ERROR > ${folder} doesn't exist`);
  }
};

await generate();

if (watch) {
  chokidar
    .watch(`${pwd}/public/`, {
      ignoreInitial: true,
      ignored: ['**/service-worker.js', '**/*.js.map'],
      // awaitWriteFinish: true,
    })
    .on('add', async (path) => {
      console.log(`${path}`);
      if (path.indexOf('manifest') !== -1) {
        await generate();
      }
    });
}
