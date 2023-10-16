import createDebug from 'debug'
import {writeFile} from 'node:fs/promises'
import {connectToEtcd} from './lib/etcd.js'
import {
	mapEtcdEntriesToPgbouncerIni,
	mapEtcdEntriesToUserlistTxt,
} from './lib/map.js'

const LINUX_DEFAULT_CONFIG_BASE_DIR = '/etc/pgbouncer'

const debug = createDebug('pgbouncer-etcd-adapter')

const writeFileAndLog = async (file, data) => {
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
		...opt,
	}
	debug('options', opt)

	const etcd = await connectToEtcd()

	const generateConfig = async () => {
		debug('regenerating config')
		const etcdEntries = await etcd.getAll().strings()
		debug('etcd entries', etcdEntries)
		const pgbouncerIni = mapEtcdEntriesToPgbouncerIni(etcdEntries)
		const userlistTxt = mapEtcdEntriesToUserlistTxt(etcdEntries)

		await Promise.all([
			writeFileAndLog(LINUX_DEFAULT_CONFIG_BASE_DIR + '/pgbouncer.ini', pgbouncerIni),
			writeFileAndLog(LINUX_DEFAULT_CONFIG_BASE_DIR + '/userlist.txt', userlistTxt),
		])
	}

	await generateConfig()
}

export {
	generatePgbouncerConfigFromEtc,
}
