import test from 'node:test'
import {
	deepStrictEqual,
	strictEqual,
} from 'node:assert'
import {
	parseEtcdEntries,
	mapEtcdEntriesToDbs,
	mapEtcdEntriesToPgbouncerIni,
	mapEtcdEntriesToUserlistTxt,
} from '../lib/map.js'

const ETCD_STATE_1 = Object.freeze({
	'foo': 'bar',
	'users.alice': 'pool_mode=statement',
	'users.bob': 'pool_mode=transaction',
	'databases.db1.host': 'db1',
	'databases.db1.user': 'hello',
	'databases.db1.password': 'world',
	'userlist.alice': 'password',
	'userlist.bob': 'some"password',
})

test('parseEtcdEntries works', (t) => {
	const data = parseEtcdEntries(ETCD_STATE_1)

	deepStrictEqual(data, {
		'pgbouncer.ini': {
			pgbouncer: {
				foo: 'bar',
			},
			users: {
				alice: 'pool_mode=statement',
				bob: 'pool_mode=transaction',
			},
			databases: {
				db1: {
					host: 'db1',
					user: 'hello',
					password: 'world',
				},
			},
		},
		'userlist.txt': {
			alice: 'password',
			bob: 'some"password',
		},
	})
})

test('mapEtcdEntriesToDbs works', (t) => {
	const dbs = mapEtcdEntriesToDbs(ETCD_STATE_1)

	deepStrictEqual(dbs, [
		['db1', {host: 'db1', user: 'hello', password: 'world'}],
	])
})

test('mapEtcdEntriesToPgbouncerIni works', (t) => {
	const pgbouncerIni = mapEtcdEntriesToPgbouncerIni(ETCD_STATE_1)

	strictEqual(pgbouncerIni, `\
[pgbouncer]

foo=bar

[users]

alice=pool_mode=statement
bob=pool_mode=transaction

[databases]

db1=host=db1 user=hello password=world

`)
})

test('mapEtcdEntriesToUserlistTxt works', (t) => {
	const userlist = mapEtcdEntriesToUserlistTxt(ETCD_STATE_1)

	strictEqual(userlist, `\
"alice" "password"
"bob" "some"password"
`)
})
