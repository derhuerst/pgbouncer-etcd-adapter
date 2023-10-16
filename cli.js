#!/usr/bin/env node

// todo: use import assertions once they're supported by Node.js & ESLint
// https://github.com/tc39/proposal-import-assertions
import {createRequire} from 'module'
const require = createRequire(import.meta.url)

import {parseArgs} from 'node:util'
const pkg = require('./package.json')

const {
	values: flags,
} = parseArgs({
	options: {
		help: {
			type: 'boolean',
			short: 'h',
		},
		version: {
			type: 'boolean',
			short: 'v',
		},
		'no-atomic-writes': {
			type: 'boolean',
		},
	},
})

if (flags.help) {
	process.stdout.write(`
Usage:
    configure-pgbouncer-using-etcd
Options:
        --no-atomic-writes          Instead of writing atomically by
                                       1) writing into a temporary file and
                                       2) moving this temp file to the target path,
                                      *do not* write atomically.
                                      Default: false
Examples:
    configure-pgbouncer-using-etcd --etcd-prefix pgb --no-atomic-writes
\n`)
	process.exit(0)
}

if (flags.version) {
	process.stdout.write(`${pkg.name} v${pkg.version}\n`)
	process.exit(0)
}

import {generatePgbouncerConfigFromEtc} from './index.js'

const opt = {}

if ('no-atomic-writes' in flags) {
	opt.writeAtomically = !flags['no-atomic-writes']
}

await generatePgbouncerConfigFromEtc(opt)
