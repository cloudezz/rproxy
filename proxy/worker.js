var fs = require('fs'),
	http = require('http'),
    https = require('https'),
    memoryMonitor = require('./memorymonitor'),
    RevProxy = require('./revProxy'),
	config = require('../config/config');

// Ignore SIGUSR
process.on('SIGUSR1', function () {});
process.on('SIGUSR2', function () {});

function Worker() {
    if (!(this instanceof Worker)) {
        return new Worker();
    }
    this.runServer();
}

Worker.prototype.runServer = function () {
	var options = {};
	if(config.memoryMonitor.memoryLimit){
		options['memoryLimit'] = config.memoryMonitor.memoryLimit;
	}
	if(config.memoryMonitor.gracefulWait){
		options['gracefulWait'] = config.memoryMonitor.gracefulWait;
	}
	if(config.memoryMonitor.checkInterval){
		options['checkInterval'] = config.memoryMonitor.checkInterval;
	}
	
    var monitor = memoryMonitor(options);
    var revProxy = new RevProxy();
	revProxy.init();
	
    http.globalAgent.maxSockets = config.maxSockets;
    https.globalAgent.maxSockets = config.maxSockets;


    //Http
    if (config.http) {
            var httpServer = http.createServer(revProxy.httpRequestHandler);
            httpServer.on('connection', revProxy.tcpConnectionHandler);
            httpServer.on('upgrade', revProxy.wsRequestHandler);
            httpServer.listen(config.http.port, config.http.hostname);
            monitor.addServer(httpServer);
    }
    
    //Https
    if (config.https) {     
    	var pk = fs.readFileSync(config.https.keyPath);
    	var pc = fs.readFileSync(config.https.certPath);
    	var options = { key: pk, cert: pc };
    	
        var httpsServer =  https.createServer(options, revProxy.httpRequestHandler);
        httpsServer.on('connection', revProxy.tcpConnectionHandler);
        httpsServer.on('upgrade', revProxy.wsRequestHandler);
        httpsServer.listen(config.https.port, config.https.hostname);
        monitor.addServer(httpsServer);
    }
};

module.exports = Worker;