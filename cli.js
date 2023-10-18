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
		watch: {
			type: 'boolean',
			short: 'w',
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
		'listen-for-sigusr1': {
			type: 'boolean',
		},
	},
})

if (flags.help) {
	process.stdout.write(`
Usage:
    configure-pgbouncer-using-etcd
Options:
    -w  --watch                     Watch the etcd namespace, and regenerate the pgbouncer
                                      config as soon as any value has changed.
                                      Default: false
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
    -d  --debounce                  With bursts of changes coming from etcds, the time to
                                      delay regeneration of the config for, at most, in
                                      milliseconds. Pass 0 to regenerate on every change
                                      immediately.
                                      Default: 200
        --listen-for-sigusr1        Reconfigure pgbouncer when the process receives a
                                      SIGUSR1 signal.
                                      Default: false
Examples:
    configure-pgbouncer-using-etcd -c /etc/pgbouncer/pgbouncer.ini --watch
    configure-pgbouncer-using-etcd --etcd-prefix pgb --no-atomic-writes
\n`)
	process.exit(0)
}

if (flags.version) {
	process.stdout.write(`${pkg.name} v${pkg.version}\n`)
	process.exit(0)
}

import {
	generatePgbouncerConfigFromEtc,
	GenerationError,
} from './index.js'

const onGenerationFailed = ({error}) => {
	if (!flags.quiet) {
		console.error('failed to generate pgbouncer config')
		console.error(error)
	}
	process.exitCode = 1
}

const opt = {
	onGenerationFailed,
}

if ('watch' in flags) {
	opt.watch = flags.watch
}

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

if ('debounce' in flags) {
	const ms = parseInt(flags.debounce)
	if (Number.isInteger(ms) || ms < 0) {
		console.error('Invalid --debounce value.')
		process.exit(1)
	}
	opt.debounce = ms
}

const handleError = (error) => {
	if (error instanceof GenerationError) {
		onGenerationFailed({error})
	} else {
		throw error
	}
}

let generator = null
try {
	generator = await generatePgbouncerConfigFromEtc(opt)
} catch (error) {
	handleError(error)
}

if (flags['listen-for-sigusr1']) {
	// Begin reading from stdin so the process does not exit.
	process.stdin.resume()

	// > 'SIGUSR1' is reserved by Node.js to start the debugger. It's possible to install a listener but doing so might interfere with the debugger.
	// https://nodejs.org/docs/latest-v20.x/api/process.html#signal-events
	process.on('SIGUSR1', () => {
		generator.generate()
		.catch(handleError)
	})
}
