import createDebug from 'debug'
import writeAtomically from 'write-file-atomic'
import {writeFile as fsWriteFile} from 'node:fs/promises'
import debounce from 'lodash.debounce'
import {connectToEtcd} from './lib/etcd.js'
import {
	mapEtcdEntriesToPgbouncerIni,
	mapEtcdEntriesToUserlistTxt,
} from './lib/map.js'
import {GenerationError} from './lib/generation-error.js'

const LINUX_DEFAULT_CONFIG_BASE_DIR = '/etc/pgbouncer'

const debug = createDebug('pgbouncer-etcd-adapter')
const debugWatcher = createDebug('pgbouncer-etcd-adapter:watcher')

const writeFileAndLog = async (writeFile, file, data) => {
	try {
		await writeFile(file, data)
		debug('successfully written', file)
	} catch (err) {
		debug('failed to write to', file, err)
		throw err
	}
}

const defaultOnGenerationFailed = ({error}) => {
	console.error('failed to generate pgbouncer config:', error)
}
const defaultOnWatcherDisconnected = () => {
	console.warn('pgbouncer etcd watcher disconnected')
}
const defaultOnWatcherConnected = () => {
	console.info('pgbouncer etcd watcher (re)connected')
}
const defaultOnWatcherError = ({error}) => {
	console.error('pgbouncer etcd watcher error:', error)
}

const generatePgbouncerConfigFromEtc = async (opt = {}) => {
	opt = {
		etcdPrefix: 'pgbouncer.',
		writeAtomically: true,
		watch: false,
		// delay generation to handle bursts of etcd writes, 0 to disable
		debounce: 200,
		pathToPgbouncerIni: LINUX_DEFAULT_CONFIG_BASE_DIR + '/pgbouncer.ini',
		pathToUserlistTxt: LINUX_DEFAULT_CONFIG_BASE_DIR + '/userlist.txt',
		onGenerationFailed: defaultOnGenerationFailed,
		onConfigWritten: () => {},
		onWatcherDisconnected: defaultOnWatcherDisconnected,
		onWatcherConnected: defaultOnWatcherConnected,
		onWatcherError: defaultOnWatcherError,
		...opt,
	}
	debug('options', opt)
	const {
		etcdPrefix,
		pathToPgbouncerIni,
		pathToUserlistTxt,
		onGenerationFailed,
		onConfigWritten,
		onWatcherDisconnected,
		onWatcherConnected,
		onWatcherError,
	} = opt

	const _etcd = await connectToEtcd()
	const etcd = _etcd.namespace(etcdPrefix)

	let previousPgbouncerIni = null
	let previousUserlistTxt = null
	const generateConfig = async (reportGenFailed = true) => {
		debug('regenerating config')
		let etcdEntries = null
		let pgbouncerIni = null
		let userlistTxt = null
		try {
			etcdEntries = await etcd.getAll().strings()
			debug('etcd entries', etcdEntries)

			pgbouncerIni = mapEtcdEntriesToPgbouncerIni(etcdEntries)
			userlistTxt = mapEtcdEntriesToUserlistTxt(etcdEntries)
		} catch (err) {
			if (reportGenFailed && (err instanceof GenerationError)) {
				const ev = {
					error: err,
					etcdEntries,
				}
				onGenerationFailed(ev)
				return;
			}
			throw err
		}

		const _write = opt.writeAtomically ? writeAtomically : fsWriteFile
		const writeTasks = []
		const pgbouncerIniHasChanged = pgbouncerIni !== previousPgbouncerIni
		if (pgbouncerIniHasChanged) {
			writeTasks.push(writeFileAndLog(_write, pathToPgbouncerIni, pgbouncerIni))
		}
		const userlistTxtHasChanged = userlistTxt !== previousUserlistTxt
		if (userlistTxtHasChanged) {
			writeTasks.push(writeFileAndLog(_write, pathToUserlistTxt, userlistTxt))
		}
		await Promise.all(writeTasks)

		const ev = {
			pgbouncerIniWritten: pgbouncerIniHasChanged,
			userlistTxtWritten: userlistTxtHasChanged,
		}
		onConfigWritten(ev)
	}

	await generateConfig(false)

	if (opt.watch) {
		// Note: `.prefix('')` is necessary for it to work.
		const watcher = await etcd.watch().prefix('').create()
		watcher.on('disconnected', () => {
			debugWatcher('disconnected')
			onWatcherDisconnected()
		})
		watcher.on('connected', (_) => {
			debugWatcher('connected')
			onWatcherConnected()
		})
		watcher.on('error', (err) => {
			debugWatcher('error', err)
			onWatcherError({
				error: err,
			})
		})

		await new Promise((_, reject) => {
			const _gen = () => {
				// todo: this doesn't take promise resolution settling time into account – use p-debounce instead?
				generateConfig()
				.catch(reject)
			}
			const gen = opt.debounce !== 0
				? debounce(_gen, opt.debounce)
				: _gen
			
			watcher.on('put', ({key, value: val}) => {
				if (debugWatcher.enabled) {
					debugWatcher('watch: put', key.toString(), val.toString())
				}
				gen()
			})
			watcher.on('delete', ({key}) => {
				if (debugWatcher.enabled) {
					debugWatcher('watch: delete', key.toString())
				}
				gen()
			})
		})
	}
}

export {
	generatePgbouncerConfigFromEtc,
	GenerationError,
}
