import {writeFile} from 'node:fs/promises'
import {connectToEtcd} from './lib/etcd.js'
import {
	mapEtcdEntriesToPgbouncerIni,
	mapEtcdEntriesToUserlistTxt,
} from './lib/map.js'

const LINUX_DEFAULT_CONFIG_BASE_DIR = '/etc/pgbouncer'

const generatePgbouncerConfigFromEtc = async (opt = {}) => {
	const etcd = await connectToEtcd()

	const generateConfig = async () => {
		const etcdEntries = await etcd.getAll().strings()
		const pgbouncerIni = mapEtcdEntriesToPgbouncerIni(etcdEntries)
		const userlistTxt = mapEtcdEntriesToUserlistTxt(etcdEntries)

		await Promise.all([
			writeFile(LINUX_DEFAULT_CONFIG_BASE_DIR + '/pgbouncer.ini', pgbouncerIni),
			writeFile(LINUX_DEFAULT_CONFIG_BASE_DIR + '/userlist.txt', userlistTxt),
		])
	}

	await generateConfig()
}

export {
	generatePgbouncerConfigFromEtc,
}
