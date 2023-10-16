import _ini from 'ini'
const {encode: encodeAsIni} = _ini

const USERLIST_NAMESPACE = 'userlist'
const HBA_NAMESPACE = 'hba'
const INI_DATABASES_NAMESPACE = 'databases'
const INI_USERS_NAMESPACE = 'users'
const INI_PEERS_NAMESPACE = 'peers'
const EXTRA_NAMESPACES = [
	USERLIST_NAMESPACE,
	HBA_NAMESPACE, // todo: support it?
]
const INI_NAMESPACES = [
	INI_DATABASES_NAMESPACE,
	INI_USERS_NAMESPACE,
	INI_PEERS_NAMESPACE,
]

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

const mapEtcdEntriesToPgbouncerIni = (rawEntries) => {
	const pgbouncer = {}
	const nested = {
		pgbouncer: pgbouncer,
	}
	// turn dot props into nested objects
	for (const [dotKey, val] of Object.entries(rawEntries)) {
		const keys = dotKey.split('.')
		const rootKey = keys[0]


		if (EXTRA_NAMESPACES.includes(rootKey)) {
			// other mapping functions will deal with this entry
			continue
		}

		// put all unprefixed (not in INI_NAMESPACES) entries into `pgbouncer`
		let target = INI_NAMESPACES.includes(rootKey)
			? nested
			: pgbouncer

		setNestedProp(target, keys, val)
	}

	return encodeAsIni(nested, {
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
}

const mapEtcdEntriesToUserlistTxt = (rawEntries) => {
	let data = ''
	for (const [dotKey, val] of Object.entries(rawEntries)) {
		const keys = dotKey.split('.')

		const ns = keys[0]
		if (ns !== USERLIST_NAMESPACE) {
			// other mapping functions will deal with this entry
			continue
		}

		if (keys.length > 2) {
			const err = Error(`invalid key "${dotKey}", only one . is supported`)
			err.key = dotKey
			err.val = val
			throw err
		}

		const key = keys[1]
		// todo: escape `"` within keys & values
		data += `"${key}" "${val}"\n`
	}

	return data
}

export {
	mapEtcdEntriesToPgbouncerIni,
	mapEtcdEntriesToUserlistTxt,
}
