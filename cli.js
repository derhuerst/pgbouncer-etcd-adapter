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
		'etcd-prefix': {
			type: 'string',
			short: 'p',
		},
		'no-atomic-writes': {
			type: 'boolean',
		},
		'path-to-pgbouncer-ini': {
			type: 'string',
			short: 'c',
		},
		'path-to-userlist-txt': {
			type: 'string',
			short: 'u',
		},
		quiet: {
			type: 'boolean',
			short: 'q',
		},
	},
})

if (flags.help) {
	process.stdout.write(`
Usage:
    configure-pgbouncer-using-etcd
Options:
    -p  --etcd-prefix               Key prefix in etcd to query/watch.
                                      Default: pgbouncer.
    -c  --path-to-pgbouncer-ini     Where pgbouncer's pgbouncer.ini shall be written to.
                                      Default: $PWD/pgbouncer.ini
    -u  --path-to-userlist-txt      Where pgbouncer's userlist.txt shall be written to.
                                      Default: $PWD/pgbouncer.ini
    -q  --quiet                     Do not print a message to stdout whenever pgbouncer's
                                      config has been modified.
                                      Default: false
        --no-atomic-writes          Instead of writing atomically by
                                       1) writing into a temporary file and
                                       2) moving this temp file to the target path,
                                      *do not* write atomically.
                                      Default: false
Examples:
    configure-pgbouncer-using-etcd -c /etc/pgbouncer/pgbouncer.ini
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

if ('etcd-prefix' in flags) {
	opt.etcdPrefix = flags['etcd-prefix']
}

if ('no-atomic-writes' in flags) {
	opt.writeAtomically = !flags['no-atomic-writes']
}

if ('path-to-pgbouncer-ini' in flags) {
	opt.pathToPgbouncerIni = flags['path-to-pgbouncer-ini']
}

if ('path-to-userlist-txt' in flags) {
	opt.pathToUserlistTxt = flags['path-to-userlist-txt']
}

if (!flags.quiet) {
	opt.onConfigWritten = ({pgbouncerIniWritten, userlistTxtWritten}) => {
		const filesWritten = [
			...(pgbouncerIniWritten ? ['pgbouncer.ini'] : []),
			...(userlistTxtWritten ? ['userlist.txt'] : []),
		]
		console.info(filesWritten.join(' & ') + ' written')
	}
}

await generatePgbouncerConfigFromEtc(opt)
