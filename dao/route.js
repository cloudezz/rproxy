/*
 * Model for route
 */

var mongoose = require('mongoose'), Schema = mongoose.Schema, ObjectId = Schema.ObjectId, jf = require('jsonfile'), routesJson = {};

var RouteSchema = new Schema({
	source : String,
	sessionType : String,
	targets : [ {
		type : ObjectId,
		ref : 'Target'
	} ]
});

var Route = mongoose.model('Route', RouteSchema);

var updateRoutesJson = function() {
	Route.find({}).populate({
		path : 'targets',
		match : {
			status : 'success'
		},
		select : 'host port status'
	}).exec(function(err, result) {
		routesJson = {};
		if (result && result != null) {
			for ( var i = 0; i < result.length; i++) {
				var key = result[i].source;
				routesJson[key] = result[i];
			}

			jf.writeFile("./config/routes.json", routesJson, function(err) {
				if (err) {
					console.log(err);
				} else {
					console.log("The file is saved!");
				}
			});
		}
	});
};

exports.updateJson = function() {
	updateRoutesJson();
};

exports.save = function(jsonData, callback) {
	var route = new Route(jsonData);
	route.save(function(err, doc) {
		callback(err, doc);
	});
};

exports.update = function(route, callback) {
	route.save(function(err, doc) {
		callback(err, doc);
	});
};

exports.findById = function(id, callback) {
	Route.findById(id).populate('targets', 'host port status').exec(
			function(err, doc) {
				callback(err, doc);
			});
};

exports.findBySource = function(source, callback) {
	Route.findOne({
		source : source
	}).populate('targets', 'host port status').exec(function(err, doc) {
		callback(err, doc);
	});
};

exports.find = function(json, callback) {
	Route.find(json, function(err, docs) {
		callback(err, docs);
	});
};

exports.getAll = function(callback) {
	Route.find({}).populate('targets', 'host port status').exec(
			function(err, routes) {
				callback(err, routes);
			});
};

exports.deleteById = function(id, callback) {
	Route.findById(id, function(err, doc) {
		if (doc) {
			doc.remove(function(err, doc) {
				callback(err, doc);
			});
		} else {
			callback(err, doc);
		}
	});
};

exports.updateTargetStatus = function(callback) {
	Route.find({}).populate({
		path : 'targets',
		match : {
			status : 'success'
		},
		select : 'host port status'
	}).exec(function(err, result) {
		routesJson = {};
		if (result && result != null) {
			for ( var i = 0; i < result.length; i++) {
				var key = result[i].source;
				routesJson[key] = result[i];
			}

			jf.writeFile("./config/routes.json", routesJson, function(err) {
				if (err) {
					console.log(err);
				} else {
					console.log("The file is saved!");
				}
				callback(err);
			});
		}
	});
};