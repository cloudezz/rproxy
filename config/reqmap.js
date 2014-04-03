/**
 * Request Mappings
 */

var login = require('../controllers/login'), route = require('../controllers/route'), target=require('../controllers/target'),
	home=require('../controllers/home'), passport = require('passport');

module.exports = function(app, auth) {
	route.init();
	app.get('/login', login.login);
	app.get('/', function(req, res){
		res.redirect('/proxy');
	});
	app.get('/proxy', login.index);

	app.post('/authenticate', auth, passport.authenticate('local', {
		failureRedirect : '/'
	}), function(req, res){
		//res.send(req.user);
		res.send("success");
	});
	
	app.get('/home', auth, home.getHomePage);
	app.post('/routes/save', auth, route.save);
	app.post('/routes/update', auth, route.update);
	app.post('/routes/delete', auth, route.deleteRoute);
	app.get('/routes/allRoutes', auth, route.getAllRoutes);
	app.get('/target/targets', auth, home.getTargetsPage);
	app.get('/target/allTargets', auth, target.getAllTargets);
	app.post('/target/updateConfig', auth, target.updateTargetConfig);
	app.post('/target/changeEnabled', auth, target.changeEnabled);
	
	
	app.get('/logout', function(req, res){
		req.logout();
		res.send("success");
	});
	
	app.get('/isAuthenticated', function(req, res){
		res.send(req.isAuthenticated() ? req.user : '0');
	});
	
	app.get('/api/routes/isReachable', function(req, res){
		res.send("success");
	});
	app.post('/api/routes/save', passport.authenticate('basic', { session: false }), route.save);
	app.post('/api/routes/update', passport.authenticate('basic', { session: false }), route.update);
	app.post('/api/routes/delete', passport.authenticate('basic', { session: false }), route.deleteRoute);
	app.get('/api/routes/allRoutes', passport.authenticate('basic', { session: false }), route.getAllRoutes);
	app.post('/api/target/updateConfig', passport.authenticate('basic', { session: false }), target.updateTargetConfig);
	
	app.post('/api/routes/updateTarget', passport.authenticate('basic', { session: false }), route.updateTarget);
	app.post('/api/routes/add', passport.authenticate('basic', { session: false }), route.add);
	app.post('/api/routes/deleteRouteBySource', passport.authenticate('basic', { session: false }), route.deleteRouteBySource);
	app.post('/api/routes/deleteTarget', passport.authenticate('basic', { session: false }), route.deleteTarget);
};
