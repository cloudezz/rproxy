var collection = require('strong-store-cluster').collection('routes');
var httpProxy = require("http-proxy");
var proxy;
var config = require('../config/config');

function RevProxy() {
    if (!(this instanceof RevProxy)) {
        return new RevProxy();
    }
}


RevProxy.prototype.init = function(){
    var options = {};
    if (config.httpKeepAlive !== true) {
        // Disable the http Agent of the http-proxy library so we force
        // the proxy to close the connection after each request to the backend
        options.agent = false;
    }
    proxy = httpProxy.createProxyServer(options);

    this.handlers();
};

RevProxy.prototype.handlers = function(){
	  // Handler called when an error is triggered while proxying a request
    var proxyErrorHandler = function (err, req, res) {
        if (err.code === 'ECONNREFUSED' ||
                err.code === 'ETIMEDOUT' ||
                req.error !== undefined) {
                this.markDeadBackend(req.meta, true);
            if (req.error) {
                delete req.error;
            }
        }
        req.retries = (req.retries === undefined) ? 0 : req.retries + 1;
        if (!res.connection || res.connection.destroyed === true) {
        	return;
        }
        if (req.retries >= config.retryOnError) {
            return;
        }
        req.emit('retry');
    }.bind(this);

    // Handler called at the begining of the proxying
    var startHandler = function (req, res) {
        var remoteAddr = getRemoteAddress(req);

        // TCP timeout to 30 sec
        req.connection.setTimeout(config.tcpTimeout * 1000);
        // Make sure the listener won't be set again on retry
        if (req.connection.listeners('timeout').length < 2) {
            req.connection.once('timeout', function () {
                req.error = 'TCP timeout';
            });
        }

        // Set forwarded headers
        if (remoteAddr === null) {
            return;
        }
        if (remoteAddr.slice(0, 2) !== '::') {
            remoteAddr = '::ffff:' + remoteAddr;
        }
        // Play nicely when behind other proxies
        if (req.headers['x-forwarded-for'] === undefined) {
            req.headers['x-forwarded-for'] = remoteAddr;
        }
        if (req.headers['x-real-ip'] === undefined) {
            req.headers['x-real-ip'] = remoteAddr;
        }
        if (req.headers['x-forwarded-protocol'] === undefined) {
            req.headers['x-forwarded-protocol'] = req.connection.pair ? 'https' : 'http';
        }
        if (req.headers['x-forwarded-proto'] === undefined) {
            req.headers['x-forwarded-proto'] = req.connection.pair ? 'https' : 'http';
        }
        if (req.headers['x-forwarded-port'] === undefined) {
            req.headers['x-forwarded-port'] = req.connection.pair ? config.https.port : config.http.port;
        }
    };

    var getRemoteAddress = function (req) {
        if (req.connection === undefined) {
            return null;
        }
        if (req.connection.remoteAddress) {
            return req.connection.remoteAddress;
        }
        if (req.connection.socket && req.connection.socket.remoteAddress) {
            return req.connection.socket.remoteAddress;
        }
        return null;
    };
    
    proxy.on('error', proxyErrorHandler);
    proxy.on('start', startHandler);
};

RevProxy.prototype.tcpConnectionHandler = function(connection){

    var remoteAddress = connection.remoteAddress,
        remotePort = connection.remotePort,
        start = Date.now();

    var getSocketInfo = function () {
        return JSON.stringify({
            remoteAddress: remoteAddress,
            remotePort: remotePort,
            bytesWritten: connection.bytesWritten,
            bytesRead: connection.bytesRead,
            elapsed: (Date.now() - start) / 1000
        });
    };

    connection.setKeepAlive(false);
    connection.setTimeout(config.tcpTimeout * 1000);
    connection.on('error', function (error) {
        console.log('TCP error from ' + getSocketInfo() + '; Error: ' + JSON.stringify(error));
    });
    connection.on('timeout', function () {
    	console.log('TCP timeout from ' + getSocketInfo());
        connection.destroy();
    });

};

RevProxy.prototype.wsRequestHandler = function (req, socket, head) {
	var route = getRoute(req);
	if (!route) {
		console.log("No routes found");
	} else {
		var target = null;
		if (route.targets.length > 1) {
				collection.get(route.source, function(err, routeData) {
					if (err) {
						console.error('There was an error in collection.get.');
					} else {
						route = routeData;
					}
					target = route.targets[0];

					route.targets.splice(0, 1);
					route.targets.push(target);
					routesJson[key] = route;

					collection.set(route.source, route, function(err) {
						if (err) {
							console.error('There was an error in collection.set');
						}
						proxyWSRequest(req, socket, head, target);
					});
				});

		} else {
			target = route.targets[0];
			proxyWSRequest(req, socket, head, target);
		}
	}
	
	var proxyWSRequest = function(req, socket, head, target){
        proxy.ws(req, socket, head, {
            target: {
                host: target.host,
                port: target.port
            }
        });
	};
};

RevProxy.prototype.httpRequestHandler = function (req, res) {
    res.timer = {
        start: Date.now()
    };
/*
    // Patch the response object
    (function () {
        // Patch the res.writeHead to detect backend HTTP errors and handle
        // debug headers
        var resWriteHead = res.writeHead;
        res.writeHead = function (statusCode) {
            if (res.sentHeaders === true) {
                // In case of errors when streaming the backend response,
                // we can resend the headers when raising an error.
                return;
            }
            res.sentHeaders = true;
            res.timer.end = Date.now();
            if (req.meta === undefined) {
                return resWriteHead.apply(res, arguments);
            }
            var markDeadBackend = function () {
                var backendId = req.meta.backendId;
                if (req.meta.backendLen > 1) {
                    this.markDeadBackend(req.meta);
                }
                log(req.headers.host + ': backend #' + backendId + ' is dead (HTTP error code ' +
                        statusCode + ') while handling request for ' + req.url);
            }.bind(this);
            // If the HTTP status code is 5xx, let's mark the backend as dead
            // We consider the 500 as critical errors only if the setting "deadBackendOn500" is enbaled
            // and only if the active health checks are running.
            var startErrorCode = (config.deadBackendOn500 === true) ? 500 : 501;
            if ((statusCode >= startErrorCode && statusCode < 600) && res.errorMessage !== true) {
                if (statusCode === 503) {
                    var headers = arguments[arguments.length - 1];
                    if (typeof headers === 'object') {
                        // Let's lookup the headers to find a "Retry-After"
                        // In this case, this is a legit maintenance mode
                        if (headers['retry-after'] === undefined) {
                            markDeadBackend();
                        }
                    }
                } else {
                    // For all other cases, mark the backend as dead
                    markDeadBackend();
                }
            }

            return resWriteHead.apply(res, arguments);
        }.bind(this);
        // Patch res.end to log the response stats
        var resEnd = res.end;
        res.end = function () {
            resEnd.apply(res, arguments);
        };
    }.bind(this)());
    */


    // Proxy the HTTP request
    var proxyRequest = function () {
    	collection.get("routesJson", function(err, data){
    		var routesJson = {};
    		if(!err){
    			routesJson = data;
    		}
    		var route = getRoute(req, routesJson);
    		if (!route) {
    			console.log("No routes found");
				res.statusCode = 404;
				res.end();
    		} else {
    			collection.get(route.source, function(err, routeData) {
    				if (err) {
    					console.error('There was an error in collection.get.');
    				} else {
    					route = routeData;
    				}
    				var target = null;
    				var deadBackends = [];
    				var activeBackends = [];
    				for(var i=0; i<route.targets.length; i++){
    					if(route.targets[i].dead){
    						deadBackends.push(route.targets[i]);
    					} else {
    						activeBackends.push(route.targets[i]);
    					}
    				}
    				route.targets = activeBackends;

    				if (route.targets.length > 1) {
    					var cookie = req.headers.cookie;
    					var serverId = null;
    					if(cookie){
    						var cookieJson = parseCookies(req);
    						serverId = cookieJson['SERVERID'];
    					}
    					
        				if(route.sessionType == "Sticky" && serverId){
    						var values = serverId.split(":");
    						var persistedHost = values[0];
    						var persistedPort = values[1];
    						
    						for(var i=0; i<route.targets.length; i++){
    							if(route.targets[i].host == persistedHost && route.targets[i].port == persistedPort){
    								target = route.targets[i];
    							}
    						}
        				}
        				
        				if(target){
        					forwardRequest(req, res, target);
        				} else {
    						target = route.targets[0];
    						route.targets.splice(0, 1);
    						route.targets.push(target);

    						if (route.sessionType == "Sticky") {
    							res.setHeader('Set-Cookie', "SERVERID=" + target.host
    									+ ":" + target.port);
    							res.setHeader('Cache-Control', 'nocache');
    						}
    						var updateTargets = route.targets.concat(deadBackends);
    						
    						route.targets = updateTargets;
    						collection.set(route.source, route, function(err) {
    							if (err) {
    								console.error('There was an error');
    							}
    							forwardRequest(req, res, target);
    						});
        				}
    				} else if(route.targets.length == 1) {
    					var target = route.targets[0];
    					forwardRequest(req, res, target);
    				} else {
    					res.statusCode = 404;
    					res.end();
    				}
    			});
    		}
    	});
    }.bind(this);
    
	req.on('retry', function () {
	    console.log('Retrying on ' + req.headers.host);
	    proxyRequest();
	});
        
    proxyRequest();
    
    var forwardRequest = function(req, res, target){
    	console.log("host : " + target.host + ", port : " +  target.port);
        req.meta = {
        		host : target.host,
        		port : target.port,
        		source : target.source
            };
            // Proxy the request to the backend
            res.timer.startBackend = Date.now();
            proxy.emit('start', req, res);
            proxy.web(req, res, {
                target: {
                    host: target.host,
                    port: target.port
                },
                xfwd: false
            });
    };
    
};

function getRoute(req, routesJson){
	var url = decodeURI(req.url).toLowerCase(), route = null;
	var prefix = url.split("/")[1];
	//var hostAndPort = req.headers.host;
	var hostname = req.headers.host.split(':')[0];
	var port = req.headers.host.split(':')[1];

	if (routesJson != null) {
		route = routesJson[hostname];
		key = hostname;
		if (route == null) {
			route = routesJson[hostname + "/" + prefix];
		}
		if (route == null) {
			route = routesJson[prefix];
		}
		if (route == null) {
			route = routesJson["/" + prefix];
		}
		if (route == null) {
			route = routesJson[port];
		}
	}
	return route;
};

function parseCookies(request) {
    var list = {},
        rc = request.headers.cookie;

    rc && rc.split(';').forEach(function( cookie ) {
        var parts = cookie.split('=');
        list[parts.shift().trim()] = unescape(parts.join('='));
    });

    return list;
}

RevProxy.prototype.markDeadBackend = function(meta, dead){
	var self = this;
	  collection.get(meta.source, function(err, value){
		  if(value){
    		  var targets = value.targets;
    		  for(var i=0; i<targets.length; i++){
    			 if(targets[i].host == meta.host && targets[i].port == meta.port){
    				 targets[i].dead = dead;
    			 }
    		  }
    		  value.targets = targets;
    		  collection.set(value.source, value, function(error){
    			  if(dead == true){
    				  var metaData = meta;
    				  var time = config.deadBackendTTL ? config.deadBackendTTL : 1000;
    				  setTimeout(function(){
    					  self.markDeadBackend(metaData, false);
    				  }, time);
    			  }
    		  });
		  }
	  });
};
	

module.exports = RevProxy;