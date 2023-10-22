import createDebug from 'debug'
import _ini from 'ini'
const {encode: encodeAsIni} = _ini

const USERLIST_NAMESPACE = 'userlist'
const USERLIST_TXT = 'userlist.txt'

const HBA_NAMESPACE = 'hba'
const HBA_CONF = 'hba.conf'

const PGBOUNCER_INI = 'pgbouncer.ini'
// key namespaces that belong in their own file(s)
const EXTRA_NAMESPACES = new Map([
	[USERLIST_NAMESPACE, USERLIST_TXT],
	[HBA_NAMESPACE, HBA_CONF], // todo: support generating it
])

const INI_DATABASES_NAMESPACE = 'databases'
const INI_USERS_NAMESPACE = 'users'
const INI_PEERS_NAMESPACE = 'peers'
const INI_NAMESPACES = [
	INI_DATABASES_NAMESPACE,
	INI_USERS_NAMESPACE,
	INI_PEERS_NAMESPACE,
]

const debugParseEtcd = createDebug('pgbouncer-etcd-adapter:parse-etcd')
const debugPgbouncerIni = createDebug('pgbouncer-etcd-adapter:pgbouncer-ini')
const debugUserlistTxt = createDebug('pgbouncer-etcd-adapter:userlist-txt')

// todo: use dot-prop instead?
const setNestedProp = (target, keys, val) => {
	for (const keyPart of keys.slice(0, -1)) {
		if (!(keyPart in target)) {
			target[keyPart] = {}
		}
		target = target[keyPart]
	}
	const leafKey = keys[keys.length - 1]
	target[leafKey] = val
}

const parseEtcdEntries = (rawEntries) => {
	debugParseEtcd('rawEntries', rawEntries)
	const target = {}
	// turn dot props into nested objects
	for (const [dotKey, val] of Object.entries(rawEntries)) {
		const etcdKeys = dotKey.split('.')
		let keys = [...etcdKeys]

		if (EXTRA_NAMESPACES.has(etcdKeys[0])) {
			keys[0] = EXTRA_NAMESPACES.get(etcdKeys[0])
		} else { // pgbouncer.ini
			// put all unprefixed (not in INI_NAMESPACES) entries into `pgbouncer`
			if (!INI_NAMESPACES.includes(etcdKeys[0])) {
				keys.unshift('pgbouncer')
			}
			keys.unshift(PGBOUNCER_INI)
		}

		setNestedProp(target, keys, val)
	}
	debugParseEtcd('target', target)

	return target
}

const mapEtcdEntriesToPgbouncerIni = (rawEntries) => {
	const {
		[PGBOUNCER_INI]: pgbouncerIni = {},
	} = parseEtcdEntries(rawEntries)

	const data = encodeAsIni(pgbouncerIni, {
		newline: true,

		// > String to define which platform this INI file is expected to be used with:
		// > when platform is win32, line terminations are CR+LF, for other platforms
		// > line termination is LF. By default, the current platform name is used.
		// pgbouncer very likely doesn't want Windows-style CR+LF line endings
		platform: 'linux',

		// > Boolean to specify whether array values are appended with []. By default this is true but there are some ini parsers that instead treat duplicate names as arrays.
		// pgbouncer `host` docs:
		// > Example:
		// > ```
		// > host=localhost
		// > host=127.0.0.1
		// > host=2001:0db8:85a3:0000:0000:8a2e:0370:7334
		// > host=/var/run/pgbouncer-1
		// > ```
		bracketedArrays: false,
	})
	debugPgbouncerIni('data', data)
	return data
}

const mapEtcdEntriesToUserlistTxt = (rawEntries) => {
	const {
		[USERLIST_TXT]: userlistTxt = {},
	} = parseEtcdEntries(rawEntries)
	let data = ''
	for (const [key, val] of Object.entries(userlistTxt)) {
		// todo: escape `"` within keys & values
		data += `"${key}" "${val}"\n`
	}
	debugUserlistTxt('data', data)

	return data
}

export {
	parseEtcdEntries,
	mapEtcdEntriesToPgbouncerIni,
	mapEtcdEntriesToUserlistTxt,
}
