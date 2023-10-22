import createDebug from 'debug'
import _pg from 'pg'
const {Client} = _pg

const debug = createDebug('pgbouncer-etcd-adapter:reload-pg')

const connectToPgbouncerViaSql = async (cfg) => {
	const {
		onPgbouncerReloaded,
	} = cfg

	const pg = new Client({
		// host: 'localhost',
		port: parseInt(process.env.PGPORT || '6432'), // 6432 is pgbouncer's default port
		// special "meta" database for administering pgbouncer
		database: 'pgbouncer',
	})
	await pg.connect()

	const queryDatabases = async () => {
		const {rows: _dbs} = await pg.query('SHOW DATABASES')
		const dbs = _dbs
		.filter(({paused, disabled}) => paused !== 1 && disabled !== 1)
		.filter(({name}) => name !== 'pgbouncer') // filter out pgbouncer's meta DB
		.map(db => [
			db.name,
			{
				host: db.host || null,
				port: db.port || null,
				user: db.force_user || null,
				dbname: db.database || null,
			},
		])
		return dbs
	}

	const reloadPgbouncerViaSql = async (newDbs) => {
		debug('reloading pgbouncer')
		await pg.query('RELOAD')

		// todo: verify that the reloading worked by comparing the DBs before/after

		// kill existing client connections & forbid new ones; then allow them again
		// This drops connections to obsolete DBs.
		// todo: kill obsolete/reconfigured DBs only, resume new/reconfigured DBs
		await pg.query('SUSPEND')
		await pg.query('RESUME')

		const runningDbs = await queryDatabases()
		onPgbouncerReloaded({runningDbs, newDbs})
	}

	return {
		queryDatabases,
		reloadPgbouncerViaSql,
	}
}

export {
	connectToPgbouncerViaSql as connectToPgbouncer,
}