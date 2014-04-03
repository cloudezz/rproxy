/**
 * Module dependencies.
 */

var master = require('./proxy/master')
  , worker = require('./proxy/worker')
  , config = require('./config/config')
  , cluster = require('cluster')
  , mongoose = require('mongoose');

if (cluster.isMaster) {
	var db = mongoose.connection;
	db.on('error', console.error);
	db.once('open', function() {
		// Run the master
		var routeDao = require('./dao/route');
		routeDao.writeToJson(function(){
			master();
		});
		
		var express = require('express')
			, http = require('http')
		    , app = express()
		    , auth = require('./config/auth')();

		require('./config/express')(app, __dirname);
		require('./config/passport')();
		require('./config/reqmap')(app, auth);
		
		var httpServer = http.createServer(app);
		httpServer.listen(config.app.port, config.app.hostname, function(req,
				res, next) {
			console.log('Http server on port : ' + config.app.port);	
		});
	});
	mongoose.connect(config.databaseURL);
} else {
	// Run the worker
	worker();
}

/*
process.on('uncaughtException', function (err) {
	  console.error((new Date).toUTCString() + ' uncaughtException:', err.message);
	  console.error(err.stack);
	  process.exit(1);
});
*/

