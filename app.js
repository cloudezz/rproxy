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
		
		master();
		var routeDao = require('./dao/route');
		routeDao.updateJson();
		var express = require('express')
			, http = require('http')
			, path = require('path')
			, passport = require('passport')
		    , app = express()
		    , WatchMen = require('./watchmen/watchmen')
		    , email = require('./watchmen/email');

		var expressConfig = require('./config/express');
		expressConfig(app, express, path, __dirname, passport, config);

		var passportConf = require('./config/passport');
		passportConf(passport, config);

		var auth = require('./config/auth')(passport, express);

		var reqmap = require('./config/reqmap');
		reqmap(app, passport, auth);
	    
		var httpServer = http.createServer(app);
		
		httpServer.listen(config.app.port, config.app.hostname, function(req,
				res, next) {
			console.log('Http server on port : ' + config.app.port);
			var watchmen = new WatchMen();
			watchmen.start();
			
			watchmen.on('service_error', function(target, state) {
				  if (state.prev_state.status === 'success' && target.config.enabled && target.config.alert_to) {
					var message =  "<div>" + target.host + ":" + target.port + " is down!." + "</div><br> <div>Reason: " + state.error + "</div>";
					if(target.config.url){
						message = message + "<br><div>URL : "+target.config.url+"</div>";
					}
					var params = {host : target.host, port : target.port, to : target.config.alert_to, message : message}; 
				    email.sendEmail(params);
				  }
			});
			
			watchmen.on('service_back', function(target, state) {
				  if (target.config.enabled && target.config.alert_to){
					var message =  "<div>" + target.host + ":" + target.port + " is back!." + "</div>";
					if(target.config.url){
						message = message + "<br><div>URL : "+target.config.url+"</div>";
					}
					var params = {host : target.host, port : target.port, to : target.config.alert_to, message : message};
				    email.sendEmail(params);
				  }
			});
			
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
