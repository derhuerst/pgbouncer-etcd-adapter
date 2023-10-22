import createDebug from 'debug'

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

// ini.encode() escapes values with `=` in quotes [1], but pgbouncer seems to *always*
// expect unquoted values. Given that
// - I don't know in which other ways pgbouncer's INI differs from `ini.encode()`,
// - all section & field names are known to be safe (don't need to be escaped),
// I hand-rolled the encoding. 😅
// [1] https://github.com/npm/ini/blob/v4.1.1/lib/ini.js#L218
const encodeAsIni = (data) => {
	let ini = ''
	for (const [section, fields] of Object.entries(data)) {
		ini += `[${section}]\n\n`
		for (const [key, val] of Object.entries(fields)) {
			ini += `${key}=${val}\n`
		}
		ini += '\n'
	}
	return ini
}

const formatDatabaseDsn = (cfg) => {
	return [
		cfg.host ? `host=${cfg.host}` : null,
		cfg.port ? `port=${cfg.port}` : null,
		cfg.user ? `user=${cfg.user}` : null,
		cfg.password ? `password=${cfg.password}` : null,
		cfg.dbname ? `dbname=${cfg.dbname}` : null,
	].filter(val => val !== null).join(' ')
}

const mapEtcdEntriesToDbs = (rawEntries) => {
	const {
		[PGBOUNCER_INI]: pgbouncerIni = {},
	} = parseEtcdEntries(rawEntries)
	const {
		databases = {},
	} = pgbouncerIni

	return Object.entries(databases)
}

const mapEtcdEntriesToPgbouncerIni = (rawEntries) => {
	const {
		[PGBOUNCER_INI]: pgbouncerIni = {},
	} = parseEtcdEntries(rawEntries)

	if ('databases' in pgbouncerIni) {
		pgbouncerIni.databases = Object.fromEntries(
			Object.entries(pgbouncerIni.databases)
			.map(([name, cfg]) => [name, formatDatabaseDsn(cfg)]),
		)
	}

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
	formatDatabaseDsn,
	mapEtcdEntriesToDbs,
	mapEtcdEntriesToPgbouncerIni,
	mapEtcdEntriesToUserlistTxt,
}
