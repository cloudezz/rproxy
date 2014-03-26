/*
 * Model for target
 */

var mongoose = require('mongoose'), Schema = mongoose.Schema, ObjectId = Schema.ObjectId, jf = require('jsonfile'), targetsJson = {};

var TargetSchema = new Schema({
	host : String,
	port : String,
	source : {},
	status : String,
	config : {
		enabled : Boolean,
		ping_service : String,
		timeout : Number,
		ping_interval : Number,
		alert_to : String,
		warning_if_takes_more_than : Number,
		method : String,
		url : String,
		expectedStatuscode : Number,
		expectedData : String
	},
	state : {
		status : String,
		elapsed_time : Number,
		timestamp : Number,
		outages : Number,
		prev_state : String,
		down_time_acc : Number,
		down_timestamp : Number,
		up_since : Number,
		running_since : Number
	}

});

var Target = mongoose.model('Target', TargetSchema);

var updateTargetsJson = function() {
	targetsJson = {};
	Target.find({}, function(err, result) {
		var targets = [];
		if (result && result != null) {
			for ( var i = 0; i < result.length; i++) {
				targets.push({
					host : result[i].host,
					port : result[i].port,
					source : result[i].source,
					id : result[i]._id,
					enabled : result[i].config.enabled
				});
			}
			targetsJson = {
				targets : targets
			};
			jf.writeFile("./config/targets.json", targetsJson, function(err) {
				if (err) {
					console.log(err);
				} else {
					console.log("The file is saved!");
				}
			});
		}
	});
};

exports.updateJson = function(){
	updateTargetsJson();
};

exports.save = function(jsonData, callback) {
	var target = new Target(jsonData);
	target.save(function(err, doc) {
		callback(err, doc);
	});
};

exports.update = function(target, callback) {
	target.save(function(err, doc) {
		callback(err, doc);
	});
};

exports.findById = function(id, callback) {
	Target.findById(id, function(err, doc) {
		callback(err, doc);
	});
};

exports.find = function(json, callback) {
	Target.find(json, function(err, docs) {
		callback(err, docs);
	});
};

exports.getAll = function(callback) {
	Target.find({}, function(err, routes) {
		callback(err, routes);
	});
};

exports.deleteById = function(id, callback) {
	Target.findById(id, function(err, doc) {
		if (doc) {
			doc.remove(function(err, doc) {
				callback(err, doc);
			});
		} else {
			callback(err, doc);
		}
	});
};