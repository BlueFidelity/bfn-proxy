'use strict';
var url = require('url'),
http = require('http'),
https = require('https'),
omit = require('lodash.omit');

function sendError(response, status_code, status_msg){
		response.writeHead(status_code, status_msg, {'content-length': status_msg.length, 'content-type': 'text/html'});
		return response.end(status_msg);
}

function doAPI(other_uri_match, request, response){
	var status_msg;
	switch (other_uri_match){
		case 'status':
			status_msg = 'OK';
		break;
		case 'debug':
			status_msg = JSON.stringify({
				'headers': request.headers,
				'url': request.url,
				'env': process.env
			}, null, 4);
		break;
		case 'myip':
			status_msg = request.headers['x-forwarded-for'] || request.connection.remoteAddress;
		break;
		case 'date':
			status_msg = (new Date()).toString();
		break;
		default:
			return sendError(response, 404, 'not found');
	}
	response.writeHead(200, {'content-length': status_msg.length, 'content-type': 'text/plain'});
	return response.end(status_msg);
}

module.exports = function(opts){
	if (typeof opts !== 'object') opts = {};
	var omit_headers = ['request', 'host', 'connection', 'x-forwarded-for', 'x-forwarded-proto', 'x-forwarded-port', 'x-request-start', 'x-request-id'];
	if (typeof opts['omit_headers'] === 'undefined') omit_headers = omit_headers.concat(['cookie', 'origin', 'referer', 'via']);
	else if (Array.isArray(opts['omit_headers'])) omit_headers = omit_headers.concat(opts['omit_headers']);
	return function(request, response){
		var uri_match = request.url.match('^/?(?://(https?):)?/?(/[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}/.*)$'), set_referer = null;
		if (!uri_match) {
			var root_html_uri_match = request.url.match('^/?([a-zA-Z0-9_\\.\\-]+\\.(?:html?)(?:\\?.*)?)$');
			if (!root_html_uri_match) {
				if (!request.headers.referer || (request.url.replace(/^\/+/gm,'').length < 4)) {
					var other_uri_match = request.url.match('^/?api/1/([a-z_\-]+)/?$');
					if (!other_uri_match) {
						return sendError(response, 404, 'not found');
					} else {
						return doAPI(other_uri_match[1], request, response);
					}
				} else {
					var base_uri = request.baseUrl ? '(?:'+ request.baseUrl.replace(/^\/+|\/+$/g,'').replace(/[\-\[\]\{\}\(\)\*\+\?\.\\\^\$\|]/g,"\\$&") +')?' : '';
					var ref_uri_match = request.headers.referer.match('^(?:https?\\://[a-zA-Z0-9_\\.\\-:]+)/?'+base_uri+'(?://(https?):)?/?(/[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}/.*)$');
					if (!ref_uri_match) return sendError(response, 404, 'Not found');
					uri_match = ref_uri_match;
					set_referer = uri_match[2];
					uri_match[2] = ref_uri_match[2].replace(/^(\/+[^\/]+).*$/,'$1') + '/' + request.url.replace(/^\/+/gm,'');
				}
			} else if (opts.root_url) {
				uri_match = root_html_uri_match;
				uri_match[2] = '/'+ opts.root_url +'/'+request.url.replace(/^\/+/gm,'');
				uri_match[1] = opts.root_schema || 'https';
			} else {
				return sendError(response, 404, 'Not found');
			}
		}
		var scheme = (uri_match[1]) ? uri_match[1] : ( request.headers['x-forwarded-proto'] || 'http' );
		var options = url.parse('/'+uri_match[2], false, true);
		if (!options.host) return sendError(response, 404, 'Not Found');
		var headers = omit(request.headers, omit_headers);
		if (set_referer) headers['referer'] = 'http'+ (scheme == 'http' ? '' : 's') +':'+ set_referer;
		options.headers = headers;
		options.method = request.method;
		options.agent = false;
		options.timeout = 8000;
		var req = (scheme == 'http' ? http : https).request(options, function(res) {
			if (res.statusCode && res.headers) {
				if ( res.statusCode >= 200 && res.statusCode <= 299 ) {
					response.writeHead(res.statusCode, res.headers);
					res.pipe(response, {end:true});
				} else {
					 if(~[301,302].indexOf(res.statusCode) && res.headers.location) {
						 var status_msg = '<!DOCTYPE html><html><head><title>'+res.statusCode+'</title></head><body><pre>'+JSON.stringify(res.headers, null, 4)+'</pre></body></html>';
						 res.headers['content-length'] = status_msg.length;
						 res.headers['content-type'] = 'text/html';
						 response.writeHead(404, res.headers);
						 response.end(status_msg);
					 }
					 else {
						response.writeHead(res.statusCode, res.headers);
						res.pipe(response, {end:true});
					 }
				}
			} else {
				return sendError(response, 404, 'Resource not found');
			}
		}).on('error', function (e) {console.log(e);sendError(response, 404, 'Resource Not Found');});
		request.pipe(req, {end:true});
	};
};
