/*
 * Model for user
 */

var mongoose = require('mongoose'), Schema = mongoose.Schema, ObjectId = Schema.ObjectId;

var UserSchema = new Schema({
	username : String,
	password : String,
	role : String
});

var User = mongoose.model('User', UserSchema);

exports.save = function(jsonData, callback) {
	var user = new User(jsonData);
	user.save(function(err, doc) {
		callback(err, doc);
	});
};

exports.update = function(user, callback) {
	user.save(function(err, doc) {
		callback(err, doc);
	});
};

exports.findById = function(id, callback) {
	User.findById(id, function(err, doc) {
		callback(err, doc);
	});
};

exports.findByRole = function(role, callback) {
	User.findOne({
		role : role
	}, function(err, doc) {
		callback(err, doc);
	});
};

exports.findOne = function(json, callback) {
	User.findOne(json, function(err, doc) {
		callback(err, doc);
	});
};

exports.find = function(json, callback) {
	User.find(json, function(err, docs) {
		callback(err, docs);
	});
};

exports.deleteById = function(id, callback) {
	User.findById(id, function(err, doc) {
		if (doc) {
			doc.remove(function(err, doc) {
				callback(err, doc);
			});
		} else {
			callback(err, doc);
		}
	});
};