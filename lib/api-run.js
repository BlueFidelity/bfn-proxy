'use strict'
var parseURL = require('url').parse,
spawn = require('child_process').spawn,
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
		exec(query.exec, function (err, stdout, stderr) {
			if (err) return resEndJSON(res, 500, err);
			resEndJSON(res, 200, {"success":true,"id":query.id,"done":true,"data":stdout||''});
		});
	} else if (query.file) {
		var stdout = '';
		var child = spawn(query.file, JSON.parse(query.args||'[]'));
		child.stdout.on('data', function (data) {
			stdout += data.toString();
		});
		child.stderr.on('data', function (data) {
			console.error('stderr: '+ data.toString());
		});
		child.on('close', function (code) {
			if (code === 0) {
				resEndJSON(res, 200, {"success":true,"id":query.id,"done":true,"data":stdout||''});
			} else {
				var errObj = new Error('ERROR: process exited with code ' + code);
				errObj.code = code;
				resEndJSON(res, 500, errObj);
			}			
		});
	} else {
		resEndJSON(res, 200, {"success":true,"id":query.id});
	}
};
