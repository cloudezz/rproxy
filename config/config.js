/**
 * Configuration for application
 */

module.exports = {
	maxSockets : 500,
	//workers : 4,
	tcpTimeout : 90,
	httpKeepAlive : true,
	//UI
	app : {
		name : 'proxy-etc',
		hostname : 'localhost',
		port : 3333
	},
	databaseURL : 'mongodb://localhost:27017/rproxy',
	
	//proxy
	http : {
		hostname : 'localhost',
		port : 80
	},
	https : {
		hostname : 'localhost',
		port : 443,
		keyPath : './config/keys/errzero.private.pem',
		certPath : './config/keys/errzero.public.pem'
	 },
	memoryMonitor : {
		memoryLimit : 100, //MBs
		gracefulWait : 30, //seconds
		checkInterval : 60 //seconds
	},
	credentials : {
		username : "admin",
		password : "admin"
	},
	mail : {
		apiKey : 'key-3lfx4-72cylett1ksl8t26ijch1hk8o4',
		from : 'rberts321@gmail.com',
		subject : 'Proxy-etc'
	}
};