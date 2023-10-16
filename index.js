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
		...opt,
	}
	debug('options', opt)
	const {
		etcdPrefix,
		pathToPgbouncerIni,
		pathToUserlistTxt,
	} = opt

	const _etcd = await connectToEtcd()
	const etcd = _etcd.namespace(etcdPrefix)

	const generateConfig = async () => {
		debug('regenerating config')
		const etcdEntries = await etcd.getAll().strings()
		debug('etcd entries', etcdEntries)
		const pgbouncerIni = mapEtcdEntriesToPgbouncerIni(etcdEntries)
		const userlistTxt = mapEtcdEntriesToUserlistTxt(etcdEntries)

		const _write = opt.writeAtomically ? writeAtomically : fsWriteFile
		await Promise.all([
			writeFileAndLog(_write, pathToPgbouncerIni, pgbouncerIni),
			writeFileAndLog(_write, pathToUserlistTxt, userlistTxt),
		])
	}

	await generateConfig()
}

export {
	generatePgbouncerConfigFromEtc,
}
