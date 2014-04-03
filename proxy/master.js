/**
 * Master
 */

var cluster = require('cluster'),
    util = require('util'),
    numCPUs = require('os').cpus().length,
    fs = require('fs'),
    collection = require('strong-store-cluster').collection('routes'),
    config = require('../config/config'),
    async = require('async'),
    email = require('../watchmen/email'),
    WatchMen = require('../watchmen/watchmen');

function Master() {
    if (!(this instanceof Master)) {
        return new Master();
    }
    var self = this;

    collection.configure({ expireKeys: 0 });
    console.log("Master Watchning routes.json file");
    fs.watchFile("./config/routes.json", function () {
    	self.readRoutesJson();
    });
    
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

    this.spawnWorkers(config.workers);
}

Master.prototype.readRoutesJson = function(){
	console.log("Refreshing cluster collection");
	var self = this;
    fs.readFile("./config/routes.json", function (err, data) {
        if (err) {
      	  console.error("Error reading file");
		} else {
		    var routesArray = [];
			if (self.OldRoutes) {
				for ( var key in self.OldRoutes) {
					routesArray.push(self.OldRoutes[key]);
				}
			}

			async.each(routesArray, function(route, done){
				collection.del(route.source, function(err) {
					if (err) {
						done(err);
						console.error('There was an error');
					} else {
						done(null);
					}
				});
			}, function(err){
				if (data && data != undefined && data != null) {
					var routes = JSON.parse(data);
					self.OldRoutes = routes;
					collection.set("routesJson", routes, function(err) {
						if (err) {
							console.error('There was an error');
						}
						for ( var key in routes) {
							collection.set(key, routes[key], function(err) {
								if (err) {
									console.error('There was an error');
									return;
								}
							});
						}
					});	
				}
			});
		}
     });
};

Master.prototype.spawnWorkers = function (number) {
    var spawnWorker = function () {
        var worker = cluster.fork();
    };

    // Spawn all workers
    var noOfWorkers = 1;
    if(number){
    	noOfWorkers = number;
    } else {
    	noOfWorkers = numCPUs;
    }
    
    for (var n = 0; n < noOfWorkers; n++) {
        util.log('Spawning worker #' + n);
        spawnWorker();
    }
    
    this.readRoutesJson();

    // When one worker is dead, let's respawn one
    cluster.on('exit', function (worker, code, signal) {
        var m = 'Worker died (pid: ' + worker.process.pid + ', suicide: ' +
                (worker.suicide === undefined ? 'false' : worker.suicide.toString());
        if (worker.suicide === false) {
            if (code !== null) {
                m += ', exitcode: ' + code;
            }
            if (signal !== null) {
                m += ', signal: ' + signal;
            }
        }
        m += '). Spawning a new one.';
        util.log(m);
        spawnWorker();
    });

    // Set an exit handler
    var onExit = function () {
        util.log('Exiting, killing the workers');
        for (var id in cluster.workers) {
            var worker = cluster.workers[id];
            util.log('Killing worker #' + worker.process.pid);
            worker.destroy();
        }
        process.exit(0);
    }.bind(this);
    process.on('SIGINT', onExit);
    process.on('SIGTERM', onExit);
};

module.exports = Master;