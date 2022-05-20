'use strict'
var parseJSURL = require('jsurl').tryParse,
_ = require('lodash'),
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

module.exports = function (opts, res) {
	var body = parseJSURL(opts['~']);
	if (body) {
		delete opts['~'];
		opts = _.merge(body, opts);
	}
	if (!opts.id) return resEndJSON(res, 400, 'Bad Request');
	if (opts.exec) {
		exec(opts.exec, function (err, stdout, stderr) {
			if (err) return resEndJSON(res, 500, err);
			resEndJSON(res, 200, {"success":true,"opts":opts,"stdout":stdout});
		});
	} else if (opts.file) {
		var stdout = '';
		var child = spawn(opts.file, opts.args||[]);
		child.stdout.on('data', function (data) {
			stdout += data.toString();
		});
		child.stderr.on('data', function (data) {
			console.error('stderr: '+ data.toString());
		});
		child.on('close', function (code) {
			resEndJSON(res, 200, {"success":code===0,"opts":opts,"code":code,"stdout":stdout});
		});
	} else {
		resEndJSON(res, 200, {"success":false,"opts":opts});
	}
};
