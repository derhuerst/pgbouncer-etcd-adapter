#!/bin/bash

set -o errexit
set -o nounset
set -o pipefail

# This script is a simplified version of bitnami's entrypoint.sh/run.sh.
# https://github.com/bitnami/containers/blob/30c930591c93bc0e163733520df0872802bb7ebe/bitnami/pgbouncer/1/debian-11/rootfs/opt/bitnami/scripts/pgbouncer/entrypoint.sh
# https://github.com/bitnami/containers/blob/30c930591c93bc0e163733520df0872802bb7ebe/bitnami/pgbouncer/1/debian-11/rootfs/opt/bitnami/scripts/pgbouncer/run.sh

export PATH_TO_PGBOUNCER_INI='/etc/pgbouncer/pgbouncer.ini'
# todo: set opt.preferPathToUserlistTxtFromEtcd: false?
export PATH_TO_USERLIST_TXT='/etc/pgbouncer/userlist.txt'

set -x # todo: remove?

flags=()
if [[ -n "${PGBOUNCER_EXTRA_FLAGS:-}" ]]; then
    read -r -a extra_flags <<<"$PGBOUNCER_EXTRA_FLAGS"
    flags+=("${extra_flags[@]}")
fi
flags+=("$PATH_TO_PGBOUNCER_INI")

export PGBOUNCER_ADMIN_USER="${PGBOUNCER_ADMIN_USER:?missing/empty env var $PGBOUNCER_ADMIN_USER}"
export PGBOUNCER_ADMIN_PASSWORD="${PGBOUNCER_ADMIN_PASSWORD:?missing/empty env var $PGBOUNCER_ADMIN_PASSWORD}"

# give access to $PGBOUNCER_ADMIN_USER/$PGBOUNCER_ADMIN_PASSWORD as a pgbouncer admin user
# todo: what if there are two entries for the same user?
echo "\"$PGBOUNCER_ADMIN_USER\" \"$PGBOUNCER_ADMIN_PASSWORD\"" >>"$PATH_TO_USERLIST_TXT"

# configure $PGBOUNCER_ADMIN_USER as a pgbouncer admin user
# we mimick bitnami/pgbouncer here
# https://github.com/bitnami/containers/blob/989ebd0280fa5942056ebc8ab1a707cb7de90d06/bitnami/pgbouncer/1/debian-11/rootfs/opt/bitnami/scripts/libpgbouncer.sh#L260
sed -i -r "s/^;admin_users = .+/admin_users = $PGBOUNCER_ADMIN_USER/" /etc/pgbouncer/pgbouncer.ini

pgbouncer "${flags[@]}" &

env \
	PGUSER="$PGBOUNCER_ADMIN_USER" \
	PGPASSWORD="$PGBOUNCER_ADMIN_PASSWORD" \
	./cli.js \
		-c "$PATH_TO_PGBOUNCER_INI" \
		-u "$PATH_TO_USERLIST_TXT" \
		--watch \
		&

# kill child processes on exit
# https://stackoverflow.com/questions/360201/how-do-i-kill-background-processes-jobs-when-my-shell-script-exits/2173421#2173421
trap 'exit_code=$?; kill -- $(jobs -p); exit $exit_code' SIGINT SIGTERM EXIT

# wait for child processes
# todo: use `wait -fn`?
wait -n
wait -n
