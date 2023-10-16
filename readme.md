# pgbouncer-etcd-adapter

**Dynamically configure [pgbouncer](https://www.pgbouncer.org) using [etcd](https://etcd.io/).**

[![npm version](https://img.shields.io/npm/v/pgbouncer-etcd-adapter.svg)](https://www.npmjs.com/package/pgbouncer-etcd-adapter)
![ISC-licensed](https://img.shields.io/github/license/derhuerst/pgbouncer-etcd-adapter.svg)
![minimum Node.js version](https://img.shields.io/node/v/pgbouncer-etcd-adapter.svg)
[![support me via GitHub Sponsors](https://img.shields.io/badge/support%20me-donate-fa7664.svg)](https://github.com/sponsors/derhuerst)
[![chat with me on Twitter](https://img.shields.io/badge/chat%20with%20me-on%20Twitter-1da1f2.svg)](https://twitter.com/derhuerst)


## Installation

```shell
npm install -g pgbouncer-etcd-adapter
```


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
Examples:
    configure-pgbouncer-using-etcd -c /etc/pgbouncer/pgbouncer.ini --watch
    configure-pgbouncer-using-etcd --etcd-prefix pgb --no-atomic-writes
```


## Contributing

If you have a question or need support using `pgbouncer-etcd-adapter`, please double-check your code and setup first. If you think you have found a bug or want to propose a feature, use [the issues page](https://github.com/derhuerst/pgbouncer-etcd-adapter/issues).
