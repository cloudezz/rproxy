/*
 * Target controller
 */

var targetsDao = require("../dao/target");

exports.updateTargetConfig = function(req, res){
	var config = req.body.config;
	var id = req.body.id;
	targetsDao.findById(id, function(error, target){
		if(target){
			target.config = config;
			targetsDao.update(target, function(error, data){
				if(error){
					res.send({error : error});
				} else {
					targetsDao.updateJson();
					res.send({id : data._id});
				}
			});
		}
	});
};

exports.changeEnabled = function(req, res){
	var changeEnabled = req.body.changeEnabled;
	var id = req.body.id;
	targetsDao.findById(id, function(error, target){
		if(target){
			if(changeEnabled == true){
				target.config.enabled = true;
			} else if (changeEnabled == false){
				target.config.enabled = false;
			}
			targetsDao.update(target, function(error, data){
				if(error){
					res.send("");
				} else {
					targetsDao.updateJson();
					res.send({id : data._id});
				}
			});
		}
	});
};


exports.getAllTargets = function(req, res) {
	targetsDao.getAll(function(error, data) {
		if(error){
			res.send("");
		} else {
			res.send(data);
		}
	});
};
