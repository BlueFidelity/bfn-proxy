'use strict';
var url = require('url'),
http = require('http'),
https = require('https'),
omit = require('lodash.omit'),
res404 = require('./not-found'),
doAPI = require('./api-functions');

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
					if (!other_uri_match) return res404(response);
					else return doAPI(other_uri_match[1], request, response);
				} else {
					var base_uri = request.baseUrl ? '(?:'+ request.baseUrl.replace(/^\/+|\/+$/g,'').replace(/[\-\[\]\{\}\(\)\*\+\?\.\\\^\$\|]/g,"\\$&") +')?' : '';
					var ref_uri_match = request.headers.referer.match('^(?:https?\\://[a-zA-Z0-9_\\.\\-:]+)/?'+base_uri+'(?://(https?):)?/?(/[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}/.*)$');
					if (!ref_uri_match) return res404(response);
					uri_match = ref_uri_match;
					set_referer = uri_match[2];
					uri_match[2] = ref_uri_match[2].replace(/^(\/+[^\/]+).*$/,'$1') + '/' + request.url.replace(/^\/+/gm,'');
				}
			} else if (opts.root_url) {
				uri_match = root_html_uri_match;
				uri_match[2] = '/'+ opts.root_url +'/'+request.url.replace(/^\/+/gm,'');
				uri_match[1] = opts.root_schema || 'https';
			} else {
				return res404(response);
			}
		}
		var scheme = (uri_match[1]) ? uri_match[1] : ( request.headers['x-forwarded-proto'] || 'http' );
		var options = url.parse('/'+uri_match[2], false, true);
		if (!options.host) return res404(response);
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
				res404(response);
			}
		}).on('error', function(e){res404(response);});
		request.pipe(req, {end:true});
	};
};
