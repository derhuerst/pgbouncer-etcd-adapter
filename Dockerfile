FROM docker.io/bitnami/minideb:bookworm

LABEL org.opencontainers.image.title="pgbouncer-via-etcd"
LABEL org.opencontainers.image.description="The pgbouncer connection pooler for PostgreSQL, but configured via etcd."
LABEL org.opencontainers.image.authors="Jannis R <mail@jannisr.de>"
LABEL org.opencontainers.image.documentation="https://github.com/derhuerst/pgbouncer-etcd-adapter"
LABEL org.opencontainers.image.source="https://github.com/derhuerst/pgbouncer-etcd-adapter"
LABEL org.opencontainers.image.revision="1.0.0"
# https://github.com/pgbouncer/pgbouncer/commit/30ba8290735630184030389e00026d4ab75d2f59
LABEL org.opencontainers.image.licenses="ISC"

RUN install_packages locales
# https://github.com/bitnami/containers/blob/62f1fdb1417aff64bd6757e4f5ef5ca59a0c901b/bitnami/pgbouncer/1/debian-11/Dockerfile#L47-L51
RUN \
	localedef -c -f UTF-8 -i en_US en_US.UTF-8 \
	&& update-locale LANG=C.UTF-8 LC_MESSAGES=POSIX \
	&& DEBIAN_FRONTEND=noninteractive dpkg-reconfigure locales \
	&& echo -e 'en_GB.UTF-8 UTF-8\nen_US.UTF-8 UTF-8' >> /etc/locale.gen \
	&& locale-gen

RUN install_packages \
	nodejs \
	npm \
	pgbouncer \
	postgresql-client

ENV LANG="en_US.UTF-8"
ENV LANGUAGE="en_US:en"

WORKDIR /pgbouncer

COPY package.json /pgbouncer/
RUN npm install --production && npm cache clean --force

# pgbouncer sets up a `postgres` user & group, so we re-use it and allow it to modify /etc/pgbouncer
RUN \
	chown -R :postgres /etc/pgbouncer \
	&& chmod g+w /etc/pgbouncer
USER postgres

ENV PGBOUNCER_ADMIN_USER=postgres
ENV PGBOUNCER_ADMIN_PASSWORD=password

COPY . /pgbouncer

EXPOSE 6432

HEALTHCHECK \
	--interval=3s --timeout=3s --start-period=2s --retries=10 \
	CMD /bin/sh -c 'PGPASSWORD="$PGBOUNCER_ADMIN_PASSWORD" psql -q -t -p 6432 pgbouncer -U "$PGBOUNCER_ADMIN_USER" -c "SHOW DATABASES" >/dev/null'

ENTRYPOINT ["/pgbouncer/docker-entrypoint.sh"]
CMD []
