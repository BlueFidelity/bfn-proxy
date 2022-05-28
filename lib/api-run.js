'use strict'
var fs = require('fs'),
crypto = require('crypto'),
parseJSURL = require('jsurl').tryParse,
_ = require('lodash'),
spawn = require('child_process').spawn,
exec = require('child_process').exec,
request = require('request'),
//noop = function(){},
noop = function(e){e&&console.error(e);},
req_cache = {},
res_cache = {};

function parseJSON(s,d) {
	try {
		return JSON.parse(s);
	} catch (e) {
		return d;
	}
}

function resEndJSON(res,status,s,id) {
	s = new Buffer(JSON.stringify(s), 'utf8');
	res.writeHead(status, {
		'Content-Type': 'application/json; charset=utf-8',
		'Content-Length': ''+s.length
	});
	res.end(s);
	if (id&&req_cache[id]) {
		if (req_cache[id]!==true) clearTimeout(req_cache[id]);
		delete req_cache[id];
	}
}

function resStreamFile(res,fp,content_type) {
	fs.exists(fp, function(e){
		if (!e) return resEndJSON(res, 404, 'Not Found');
		fs.stat(fp, function(err, stat){
			function cb(err) {
				err&&noop(err);
				if (fp) setTimeout(fs.unlink, 60000, fp, noop);
				fp = 0;
			}
			err&&noop(err);
			if (err) return resEndJSON(res, 500, 'Bad Request');
			res.writeHead(200, {
				'Content-Type': content_type || 'application/octet-stream',
				'Content-Length': ''+stat.size
			});
			fs.createReadStream(fp).on('error',cb).pipe(res).on('close',cb).on('finish',cb);
		});
	});
}

function postRes(url,body,cb,retries) {
	retries = retries || 0;
	request({
		uri: url,
		method: 'POST',
		headers: {
			'Accept': '*/*',
			'Connection': 'close',
			'User-Agent': 'BFS-Run/1.1'
		},
		strictSSL: false,
		json: true,
		gzip: false,
		timeout: 8000,
		body: body
	}, function (err, res) {
		var errCode = err && err.code;
		var statusCode = res && res.statusCode || 0;
		if (statusCode===200) return cb();
		if (retries<6 && ((errCode && ['ETIMEDOUT','ESOCKETTIMEDOUT','EPROTO','ECONNRESET','EHOSTUNREACH','ENETUNREACH','ENOTFOUND','ECONNREFUSED'].indexOf(errCode)!==-1) || statusCode<=0 || statusCode===408 || statusCode===409 || statusCode===429 || statusCode>=500)) {
			setTimeout(postRes, retries * 500, url, body, cb, retries+1);
		} else {
			cb(errCode||statusCode);
		}
	});
}

module.exports = function (opts, res) {
	var body = parseJSURL(opts['~']);
	if (body) {
		delete opts['~'];
		opts = _.merge(body, opts);
	}
	var id = opts.id = opts.id || crypto.randomBytes(16).toString('hex');
	var callback_url = opts.callback_url;
	var debug = opts.debug;
//	if (!id) return resEndJSON(res, 400, 'Bad Request');
	if (res_cache[id]) return resEndJSON(res, 200, res_cache[id]);
	else if (req_cache[id]) return resEndJSON(res, 200, {"success":true,"status":"running"});
	else if (opts.status) return resEndJSON(res, 200, {"success":true,"status":"unknown"});
	if (!callback_url) {
		req_cache[id] = setTimeout(function(){
			req_cache[id] = true;
			resEndJSON(res, 200, {"success":true,"status":"running"});
		}, Math.min(Number(opts.wait) || 30000 , 540000));
	}
	if (opts.exec) {
		exec(opts.exec, function (err, stdout, stderr) {
			if (err) return resEndJSON(res, 500, err, id);
			resEndJSON(res, 200, {"success":true,"opts":opts,"stdout":stdout,"stderr":stderr}, id);
		});
	} else if (opts.file) {
		var stdout = '';
		var stderr = '';
		var child = spawn(opts.file, opts.args||[]);
		child.on('error', function(err){
			if (debug) console.error('err:', err);
			stderr += ''+ err;
		});
		child.stdout.on('data', function (data) {
			if (debug) console.error('stdout:', data.toString());
			stdout += data.toString();
		});
		child.stderr.on('data', function (data) {
			if (debug) console.error('stderr:', data.toString());
			stderr += data.toString();
		});
		child.on('close', function (code) {
			if (req_cache[id]) {
				stdout = stdout.trim();
				stderr = stderr.trim();
				stdout = res_cache[id] = code===0 ? _.merge({"success":true}, opts.res||{}, parseJSON(stdout||'{}',{'output':stdout})) : {"success":false,"message":stdout||stderr||'Unknown error',"code":code};
				if (callback_url) {
					postRes(callback_url, stdout, function(err){
						if (err) console.error('postReserr: '+ err);
					});
				} else {
					if (req_cache[id]!==true) {
						resEndJSON(res, 200, stdout, id);
					}
				}
			}
		});
		if (callback_url) {
			req_cache[id] = setTimeout(function(){
				if (req_cache[id]!==true) {
					delete res_cache[id];
					delete req_cache[id];
					resEndJSON(res, 200, {"success":true,"status":"unknown"});
				}
			}, Math.min(Number(opts.timeout) || 15 * 60 * 1000, 30 * 60 * 1000));
			resEndJSON(res, 200, {"success":true,"status":"started"});
		}
	} else if (opts.download) {
		resStreamFile(res, opts.download, opts.content_type);
	} else {
		resEndJSON(res, 200, {"success":false,"opts":opts}, id);
	}
};
