import createDebug from 'debug'
import writeAtomically from 'write-file-atomic'
import {writeFile as fsWriteFile} from 'node:fs/promises'
import {connectToEtcd} from './lib/etcd.js'
import {
	mapEtcdEntriesToPgbouncerIni,
	mapEtcdEntriesToUserlistTxt,
} from './lib/map.js'

const LINUX_DEFAULT_CONFIG_BASE_DIR = '/etc/pgbouncer'

const debug = createDebug('pgbouncer-etcd-adapter')

const writeFileAndLog = async (writeFile, file, data) => {
	try {
		await writeFile(file, data)
		debug('successfully written', file)
	} catch (err) {
		debug('failed to write to', file, err)
		throw err
	}
}

const generatePgbouncerConfigFromEtc = async (opt = {}) => {
	opt = {
		etcdPrefix: 'pgbouncer.',
		writeAtomically: true,
		pathToPgbouncerIni: LINUX_DEFAULT_CONFIG_BASE_DIR + '/pgbouncer.ini',
		pathToUserlistTxt: LINUX_DEFAULT_CONFIG_BASE_DIR + '/userlist.txt',
		onConfigWritten: () => {},
		...opt,
	}
	debug('options', opt)
	const {
		etcdPrefix,
		pathToPgbouncerIni,
		pathToUserlistTxt,
		onConfigWritten,
	} = opt

	const _etcd = await connectToEtcd()
	const etcd = _etcd.namespace(etcdPrefix)

	let previousPgbouncerIni = null
	let previousUserlistTxt = null
	const generateConfig = async () => {
		debug('regenerating config')
		const etcdEntries = await etcd.getAll().strings()
		debug('etcd entries', etcdEntries)
		const pgbouncerIni = mapEtcdEntriesToPgbouncerIni(etcdEntries)
		const userlistTxt = mapEtcdEntriesToUserlistTxt(etcdEntries)

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

	await generateConfig()
}

export {
	generatePgbouncerConfigFromEtc,
}
