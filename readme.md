# pgbouncer-etcd-adapter

**Dynamically configure [pgbouncer](https://www.pgbouncer.org) using [etcd](https://etcd.io/).**

[![npm version](https://img.shields.io/npm/v/pgbouncer-etcd-adapter.svg)](https://www.npmjs.com/package/pgbouncer-etcd-adapter)
![ISC-licensed](https://img.shields.io/github/license/derhuerst/pgbouncer-etcd-adapter.svg)
![minimum Node.js version](https://img.shields.io/node/v/pgbouncer-etcd-adapter.svg)
[![support me via GitHub Sponsors](https://img.shields.io/badge/support%20me-donate-fa7664.svg)](https://github.com/sponsors/derhuerst)
[![chat with me on Twitter](https://img.shields.io/badge/chat%20with%20me-on%20Twitter-1da1f2.svg)](https://twitter.com/derhuerst)

`pgbouncer-etcd-adapter` reads all entries from etcd with a certain prefix (`pgbouncer.` by default) and generates pgbouncer's configuration files (`pgbouncer.ini` & `userlist.txt`) from them.

For example, the following etcd entries

- `pgbouncer.admin_users: postgres`
- `pgbouncer.auth_type: md5`
- `pgbouncer.unix_socket_dir: /tmp`
- `pgbouncer.databases.foo.dbname: bar`
- `pgbouncer.databases.foo.host: localhost`
- `pgbouncer.databases.foo.port: 12345`
- `pgbouncer.userlist.postgres: password`

to these pgbouncer config files:

```ini
[pgbouncer]

unix_socket_dir = /tmp
admin_users = postgres
auth_type = md5

[databases]

foo = host=localhost port=12345 dbname=bar
```

```
"postgres" "password"
```


## Installation

```shell
npm install -g pgbouncer-etcd-adapter
```


## Getting Started

Define pgbouncer admin user & password:

```shell
export PGBOUNCER_ADMIN_USER=…
export PGBOUNCER_ADMIN_PASSWORD=…
```

Put some entries into etcd:

```shell
etcdtl put pgbouncer.admin_users "$PGBOUNCER_ADMIN_USER"
etcdtl put "pgbouncer.userlist.$PGBOUNCER_ADMIN_USER" "$PGBOUNCER_ADMIN_PASSWORD"
# …
```

Assuming you have pgbouncer running already, run the adapter:

```shell
env \
	PGUSER="$PGBOUNCER_ADMIN_USER" \
	PGPASSWORD="$PGBOUNCER_ADMIN_PASSWORD" \
	configure-pgbouncer-using-etcd
```

### via Docker

First, make sure you have etcd set up. In this guide, we'll asume you'll use plain Docker.

```shell
export ETCD_ROOT_PASSWORD=…
docker run -d --name etcd --rm -p 2379:2379 -e ETCD_ROOT_PASSWORD bitnami/etcd:3.5
```

Then run pgbouncer. Because it contains *both* pgbouncer and the pgbouncer ↔︎ etcd adapter, the Docker image is *not* called `derhuerst/pgbouncer-etcd-adapter` but `derhuerst/pgbouncer-via-etcd`. Configure access to etcd using `$ETCD_ADDR`.

```shell
docker run \
	--name pgbouncer-via-etcd --rm -it \
	--link etcd -e ETCD_ADDR="etcd://root:$ETCD_ROOT_PASSWORD@etcd:2379" \
	-e PGBOUNCER_ADMIN_USER -e PGBOUNCER_ADMIN_PASSWORD \
	derhuerst/pgbouncer-with-etcd:1
```

*Note:* If you don't set `pgbouncer.userlist.$PGBOUNCER_ADMIN_USER` to `$PGBOUNCER_ADMIN_PASSWORD`, the container will immediately regenerate `userlist` without an entry for `$PGBOUNCER_ADMIN_USER`, so that the container's health check will fail.


## Usage

```
Usage:
    configure-pgbouncer-using-etcd
Options:
    -w  --watch                     Watch the etcd namespace, and regenerate the pgbouncer
                                      config as soon as any value has changed.
                                      Default: false
    -p  --etcd-prefix               Key prefix in etcd to query/watch.
                                      Default: pgbouncer.
    -c  --path-to-pgbouncer-ini     Where pgbouncer's pgbouncer.ini shall be written to.
                                      Default: $PWD/pgbouncer.ini
    -u  --path-to-userlist-txt      Where pgbouncer's userlist.txt shall be written to.
                                      Default: $PWD/pgbouncer.ini
    -q  --quiet                     Do not print a message to stdout whenever pgbouncer's
                                      config has been modified.
                                      Default: false
        --no-atomic-writes          Instead of writing atomically by
                                       1) writing into a temporary file and
                                       2) moving this temp file to the target path,
                                      *do not* write atomically.
                                      Default: false
    -d  --debounce                  With bursts of changes coming from etcds, the time to
                                      delay regeneration of the config for, at most, in
                                      milliseconds. Pass 0 to regenerate on every change
                                      immediately.
                                      Default: 200
        --listen-for-sigusr1        Reconfigure pgbouncer when the process receives a
                                      SIGUSR1 signal.
                                      Default: false
        --no-pgbouncer-reload       Once the config has been regenerated, *do not* tell
                                      pgbouncer to
                                      1. reload the config (using `RELOAD`)
                                      2. reestablish all connections to DBs & clients
                                         using `SUSPEND; RESUME`
                                      Default: false
Notes:
    Unless --no-pgbouncer-reload is passed, this tool will connect to pgbouncer's
    special `pgbouncer` "admin console" DB that allows controlling it via SQL. [1]
    It will respect up the libpg environment variables [2].
    [1] https://www.pgbouncer.org/usage.html#admin-console
    [2] https://www.postgresql.org/docs/16/libpq-envars.html
Examples:
    configure-pgbouncer-using-etcd -c /etc/pgbouncer/pgbouncer.ini --watch
    configure-pgbouncer-using-etcd --etcd-prefix pgb --no-atomic-writes
```


## Contributing

If you have a question or need support using `pgbouncer-etcd-adapter`, please double-check your code and setup first. If you think you have found a bug or want to propose a feature, use [the issues page](https://github.com/derhuerst/pgbouncer-etcd-adapter/issues).
