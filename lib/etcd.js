import {Etcd3} from 'etcd3'

// todo: support $ETCD_SERVERS? (https://github.com/a0x8o/kubernetes/blob/06e98f7a27a6d2f408ed1ce068bc95f00d1c467d/cluster/gce/util.sh#L1348)
// https://github.com/microsoft/etcd3/blob/e74db2a81c68006feb770c1c21dbed5af46fdf40/src/test/util.ts#L17-L18
const ETCD_ADDR = process.env.ETCD_ADDR || 'localhost:2379'

// todo: pick up $ETCD_CA_CERT & $ETCD_PEER_CERT ?
// https://github.com/sttts/kubernetes/blob/cf23810f2098d46079152812036334c089c8de46/cluster/common.sh#L793
// https://github.com/sttts/kubernetes/blob/cf23810f2098d46079152812036334c089c8de46/cluster/common.sh#L795

const connectToEtcd = async () => {
	const ioOpts = {
		// despite the docs saying that `hosts` is optional, we must add it here
		hosts: [ETCD_ADDR]
		// todo: auth
		// todo: credentials
	}
	const client = new Etcd3(ioOpts)

	// todo: verify connection?

	return client
}

export {
	connectToEtcd,
}