/*
 * Route controller
 */

var routesDao = require("../dao/route");
var targetsDao = require("../dao/target");
var async = require('async'); 
var runningServers = [];
var http = require('http');
var config = require('../config/config');
var httpProxy = require("http-proxy");
var proxy = new httpProxy.RoutingProxy();

exports.init = function() {
	startServers();
};

function startServers(){
	routesDao.getAll(function(error, result){
		for(var i=0; i<result.length; i++){
			var options = {newSource : result[i].source};
			startServer(options);
		}
	});
}

exports.save = function(req, res) {
	var route = req.body.route;
	if(route.source && /^\d+$/.test(route.source)){
		testPort(config.app.hostname, route.source, function(result, data){
			if(result == "failure"){
				saveRoute(req, res, route);
			} else if(result == "success"){
				res.send({error : "Port "+route.source+" is already in use or not existed"});
			}
		});
	} else {
		saveRoute(req, res, route);
	}
};

exports.update = function(req, res) {
	var route = req.body.route;
	routesDao.findBySource(route.source, function(error, data){
		if(data == null || data._id == route._id){
			routesDao.findById(route._id, function(error, oldRoute){
				if(oldRoute){
					if(route.source && oldRoute.source != route.source && /^\d+$/.test(route.source)){
						testPort(config.app.hostname, route.source, function(result, data){
							if(result == "failure"){
								updateRoute(req, res, route, oldRoute);
							} else if(result == "success"){
								res.send({error : "Port "+route.source+" is already in use or not existed"});
							}
						});
					} else {
						updateRoute(req, res, route, oldRoute);
					}
				} else {
					res.send({error : "Route with id : "+ route._id +" is not existed"});
				}
			});
		} else {
			res.send({error : "Route with source : "+ route.source +" already exists"});
		}
	});
};

exports.updateTarget = function(req, res){
	var source = req.body.source;
	var oldTarget = req.body.oldTarget;
	var newTarget = req.body.newTarget;
	
	if(oldTarget != null && newTarget != null && oldTarget.indexOf(":") > -1 && newTarget.indexOf(":") > -1){
		var oldTargetHostAndPort = oldTarget.split(":");
		var newTargetHostAndPort = newTarget.split(":");
		if(oldTargetHostAndPort != null && newTargetHostAndPort != null){
			targetsDao.find({host : oldTargetHostAndPort[0], port : oldTargetHostAndPort[1]}, function(error, result){
				if(result && result[0]){
					var target = result[0];
						if(target.source == source){
							target.host = newTargetHostAndPort[0];
							target.port = newTargetHostAndPort[1];
							targetsDao.update(target, function(error, data){
								if(!error){
									routesDao.updateJson();
									targetsDao.updateJson();
									res.send({id : data._id});
								} else {
									res.send({error : error});
								}
							});
						} else {
							res.send({error : "Target and source are not mapped"});
						}
				} else {
					res.send({error : "Target is not existed exists"});
				}
			});
		}
	} else {
		res.send({error : "parameter passed are incorrect"});
	}
};

exports.add = function(req, res){
	var source = req.body.source;
	var target = req.body.target;
	
	if(source && target != null && target.indexOf(":") > -1){
		var targetHostAndPort = target.split(":");
		if(targetHostAndPort != null){
			routesDao.findBySource(source, function(error, oldRoute){
				var config = {enabled : false, ping_service : "", timeout : "", ping_interval : "",
						alert_to : "", warning_if_takes_more_than : "", method : "",
							url : "", expectedStatuscode : "", expectedData : ""};
				if(oldRoute != null){
					var targetToSave = {host : target.host, port : target.port, source : oldRoute.source, config : config, state : {}};
					targetsDao.save(targetToSave, function(error, data){
						if(error){
							done("Error", null);
						} else {
							oldRoute.targets.push(data);
							routesDao.update(oldRoute, function(error, data){
								if(!error){
									routesDao.updateJson();
									targetsDao.updateJson();
									res.send({id : data._id});
								} else {
									res.send({error : error});
								}
							});
						}
					});
				} else {
					var route = {source : source, sessionType : "Non Sticky", targets : [{host : targetHostAndPort[0], port : targetHostAndPort[1]}]};
					if(route.source && /^\d+$/.test(route.source)){
						testPort(config.app.hostname, route.source, function(result, data){
							if(result == "failure"){
								saveRoute(req, res, route);
							} else if(result == "success"){
								res.send({error : "Port "+route.source+" is already in use or not existed"});
							}
						});
					} else {
						saveRoute(req, res, route);
					}
				}
			});
		}
	} else {
		res.send({error : "parameter passed are incorrect"});
	}
};

exports.deleteTarget = function(req, res){
	var source = req.body.source;
	var target = req.body.target;
	
	if(target != null && target.indexOf(":") > -1 ){
		var targetHostAndPort = target.split(":");
		if(targetHostAndPort != null){
			routesDao.findBySource(source, function(error, result){
				if(result != null){
					targetsDao.find({host : targetHostAndPort[0], port : targetHostAndPort[1]}, function(error, data){
						if(data && data != null && data[0]){
							var targetToDelete = data[0];
							var targets = result.targets;
							var newTargets = [];
							for(var i =0; i<targets.length; i++){
								if(!(targets[i]._id == targetToDelete._id)){
									newTargets.push(targets[i]);
								}
							}
							result.targets = newTargets;
							targetsDao.deleteById(targetToDelete._id, function(error, data){
								if(!error){
									routesDao.update(result, function(error, data){
										if(!error){
											routesDao.updateJson();
											targetsDao.updateJson();
											res.send({id : data._id});
										} else {
											res.send({error : error});
										}
									});
								} else {
									res.send({error : error});
								}
							});
						} else {
							res.send({error : "Target is not existed"});
						}
					});
				} else {
					res.send({error : "Route with source : "+ source +" not exists"});
				}
			});
		}
	} else {
		res.send({error : "parameter passed are incorrect"});
	}
};


exports.deleteRoute = function(req, res){
	routesDao.findById(req.body.id, function(error, result){
		if(result){
			routesDao.deleteById(req.body.id, function(error, deletedData) {
				if(error || deletedData == 0){
					res.send("Error");
				} else {
					var options = {oldSource : result.source};
					startServer(options);
					var targets = result.targets;
					async.eachSeries(targets, function(target, done){
						targetsDao.deleteById(target._id, function(error, data){
							if(error){
								done("Error", null);
							} else {
								done(null, deletedData);
							}
						});
					}, function(err, data){
						if(err){
							res.send(err);
						} else {
							routesDao.updateJson();
							targetsDao.updateJson();
							res.send({id : deletedData._id});
						}
					});
				}
			});
		}
	});
};

exports.deleteRouteBySource = function(req, res){
	var source = req.body.source;
	if(source != null){
		routesDao.findBySource(source, function(error, result){
			if(result){
				routesDao.deleteById(result._id, function(error, deletedData) {
					if(error || deletedData == 0){
						res.send("Error");
					} else {
						var options = {oldSource : result.source};
						startServer(options);
						var targets = result.targets;
						async.eachSeries(targets, function(target, done){
							targetsDao.deleteById(target._id, function(error, data){
								if(error){
									done("Error", null);
								} else {
									done(null, deletedData);
								}
							});
						}, function(err, data){
							if(err){
								res.send(err);
							} else {
								routesDao.updateJson();
								targetsDao.updateJson();
								res.send({id : deletedData._id});
							}
						});
					}
				});
			} else {
				res.send({error : "Source with name " + source + " not existed"});
			}
		});
	} else {
		res.send({error : "parameter passed is incorrect"});
	}
};

exports.getAllRoutes = function(req, res) {
	routesDao.getAll(function(error, data) {
		if(error){
			res.send("");
		} else {
			res.send(data);
		}
	});
};


function saveRoute(req, res, route){
	var jsonData = {
			source : route.source,
			targets : [],
			sessionType : route.sessionType
		};

	routesDao.findBySource(route.source, function(error, data){
		if(data == null){
			var targets = route.targets;
			var config = {enabled : false, ping_service : "", timeout : "", ping_interval : "",
					alert_to : "", warning_if_takes_more_than : "", method : "",
						url : "", expectedStatuscode : "", expectedData : ""};
			async.eachSeries(targets, function(target, done){
				var targetToSave = {host : target.host, port : target.port, source : route.source, config : config, state : {}};
				targetsDao.save(targetToSave, function(error, data){
					if(error){
						done(error, null);
					} else {
						jsonData.targets.push(data);
						done(null, data);
					}
				});
			}, function(err, data){
				if(err){
					res.send(err);
				} else {
					routesDao.save(jsonData, function(error, data) {
						if(error){
							res.send(error);
						} else {
							var options = {newSource : jsonData.source};
							startServer(options);
							routesDao.updateJson();
							targetsDao.updateJson();
							res.send({id : data._id});
						}
					});
				}
			});
		} else {
			res.send({error : "Route with source : "+ route.source +" already exists"});
		}
	});
}

function updateRoute(req, res, route, oldRoute){
	var oldSource = oldRoute.source;
	var targetsToRemove = [];
	var routesTargets = [];
	
	var config = {enabled : false, ping_service : "", timeout : "", ping_interval : "",
			alert_to : "", warning_if_takes_more_than : "", method : "",
				url : "", expectedStatuscode : "", expectedData : ""};
	var targetsMap = {};
	
	var newTargets = route.targets;
	for(var k=0; k<newTargets.length; k++){
		if(newTargets[k]._id) {
			targetsMap[newTargets[k]._id] = newTargets[k];
		}
	}
	var oldTargets = oldRoute.targets;
	for(var j=0; j<oldTargets.length; j++){
		var id = oldTargets[j]._id;
		if(!targetsMap[id]){
			targetsToRemove.push(oldTargets[j]);
		} 
	}

	async.eachSeries(newTargets, function(newTarget, done){
		targetsDao.findById(newTarget._id, function(error, target){
			if(target){
				target.host = newTarget.host;
				target.port = newTarget.port;
				targetsDao.update(target, function(error, data){
					if(error){
						done(error);
					} else {
						routesTargets.push(data);
						done(null);
					}
				});
			} else {
				var targetToSave = {host : newTarget.host, port : newTarget.port, source:route.source, config : config, state : {}};
				targetsDao.save(targetToSave, function(error, data){
					if(error){
						done("Error");
					} else {
						routesTargets.push(data);
						done(null);
					}
				});
			}
		});
	}, function(err){
		if(err){
			res.send(err);
		} else {
			oldRoute.source = route.source;
			oldRoute.sessionType = route.sessionType;
			oldRoute.targets = routesTargets;
			
			routesDao.update(oldRoute, function(error, result) {
				if(error){
					res.send(error);
				} else {
					async.eachSeries(targetsToRemove, function(targetToRemove, done){
						targetsDao.deleteById(targetToRemove._id, function(error, data){
							if(error){
								done(error);
							} else {
								done(null);
							}
						});
					}, function(err){
						if(err){
							res.send(err);
						} else {
							routesDao.updateJson();
							targetsDao.updateJson();
							var options = {oldSource : oldSource, newSource : route.source};
							startServer(options);
							res.send({id : result._id});
						}
					});
				}
			});
		}
	});	
}

function startServer(options){
	if(options.oldSource){
		var oldServer = runningServers[options.oldSource];
		if(oldServer){
			oldServer.close();
		}
	}
	
	if(options.newSource){
		if(/^\d+$/.test(options.newSource)){
			var server = http.createServer(portForward);
			server.listen(options.newSource, config.app.hostname);
			runningServers[options.newSource] = server;
		}
	}
}

function portForward(req, res){
	var host = {host : config.http.hostname, port : config.http.port};
	proxy.proxyRequest(req, res, host);
}


function testPort(host, port, callback) {
	  http.get({
		  host: host, 
		  port: port 
	  }, function(res) {
		  callback("success", res); 
	  }).on("error", function(e) {
		  callback("failure", e);
	  });
}