import createDebug from 'debug'
import test from 'node:test'
import {
	deepStrictEqual,
	strictEqual,
} from 'node:assert'
import getEnvPaths from 'env-paths'
import {fileURLToPath} from 'node:url'
import {execa} from 'execa'
import {mkdir, readFile} from 'node:fs/promises'
import {Etcd3} from 'etcd3'
import {
	parseEtcdEntries,
	mapEtcdEntriesToDbs,
	mapEtcdEntriesToPgbouncerIni,
	mapEtcdEntriesToUserlistTxt,
} from '../lib/map.js'

const {
	temp: TMP,
} = getEnvPaths('pgbouncer-etcd-adapter-test-' + Math.random().toString(16).slice(2, 5))

const debug = createDebug('pgbouncer-etcd-adapter:test')

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

test('works end-to-end', async (t) => {
	const NS = `pgb-${Math.random().toString(16).slice(2, 7)}.`

	await mkdir(TMP, {recursive: true})

	const pathToAdapter = fileURLToPath(new URL('../cli.js', import.meta.url).href)

	const pgbouncerIniPath = TMP + '/pgbouncer.ini'
	const userlistTxtPath = TMP + '/userlist.txt'
	debug({pgbouncerIniPath, userlistTxtPath})

	const etcd = execa('etcd', [], {
		shell: true,
		cwd: TMP,
		// todo: stdio?
	})

	const etcdClient = new Etcd3()

	try {
		await Promise.all([
			(async () => {
				try {
					await etcd
				} catch (err) {
					if (err.command == 'etcd' && err.signal === 'SIGTERM') {
						return;
					}
					throw err
				}
			})(),
			(async () => {
				try {
					// wait for etcd to start up
					await new Promise(r => setTimeout(r, 500))

					await etcdClient.stm().transact(async (tx) => {
						await Promise.all([
							tx.put(NS + 'logfile').value('/tmp/pgbouncer.log'),
							tx.put('foo').value('bar'),
							tx.put(NS + 'users.alice').value('pool_mode=statement'),
							tx.put(NS + 'users.bob').value('pool_mode=transaction'),
							tx.put(NS + 'databases.db1.host').value('db1'),
							tx.put(NS + 'databases.db1.user').value('hello'),
							tx.put(NS + 'databases.db1.password').value('world'),
							tx.put(NS + 'userlist.alice').value('password'),
							tx.put(NS + 'userlist.bob').value('some"password'),
						])
					})

					await execa(pathToAdapter, [
						'-p', NS,
						'-c', pgbouncerIniPath,
						'-u', userlistTxtPath,
						'--no-pgbouncer-reload',
						'--quiet',
					], {
						stdio: 'inherit',
						env: {
							'ETCD_ADDR': 'http://localhost:12379',
						},
					})

					// todo: this is needed, why? – it shouldn't
					await new Promise(r => setTimeout(r, 500))


					const [
						pgbouncerIni,
						userlistTxt,
					] = await Promise.all([
						readFile(pgbouncerIniPath, {encoding: 'utf8'}),
						readFile(userlistTxtPath, {encoding: 'utf8'}),
					])
					debug({pgbouncerIni, userlistTxt})

					await execa(pathToAdapter, [
						'-p', NS,
						'-c', pgbouncerIniPath,
						'-u', userlistTxtPath,
						'--no-pgbouncer-reload',
						'--quiet',
					], {
						stdio: 'inherit',
					})

					// Note that we except the sections to be sorted, unlike the etcd fields put above.
					strictEqual(pgbouncerIni, `\
[pgbouncer]

logfile=/tmp/pgbouncer.log

[users]

alice=pool_mode=statement
bob=pool_mode=transaction

[databases]

db1=host=db1 user=hello password=world

`)
					strictEqual(userlistTxt, `\
"alice" "password"
"bob" "some"password"
`)

				} finally {
					etcd.kill('SIGTERM', {forceKillAfterTimeout: 2000})
				}
			})(),
		])
	} finally {
		debug('tearing down')
		etcdClient.close()
		if (!etcd.killed) {
			etcd.kill('SIGTERM', {forceKillAfterTimeout: 2000})
		}
	}
})
