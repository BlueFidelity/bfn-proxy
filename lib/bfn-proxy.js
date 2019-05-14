'use strict'
var url = require('url')
var http = require('http')
var https = require('https')
var omit = require('lodash.omit')
var res404 = require('./not-found')
var doAPI = require('./api-functions')

module.exports = function (opts) {
  if (typeof opts !== 'object') opts = {}
  var omitHeaders = ['request', 'host', 'connection', 'x-forwarded-for', 'x-forwarded-proto', 'x-forwarded-port', 'x-request-start', 'x-request-id']
  if (typeof opts['omitHeaders'] === 'undefined') omitHeaders = omitHeaders.concat(['cookie', 'origin', 'referer', 'via', 'upgrade-insecure-requests'])
  else if (Array.isArray(opts['omitHeaders'])) omitHeaders = omitHeaders.concat(opts['omitHeaders'])
  return function (request, response) {
    var uriMatch = request.url.match('^/?(?://(https?):)?/?(/[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}/.*)$')
    var setReferer = null
    if (!uriMatch) {
      var rootHtmlUriMatch = request.url.match('^/?([a-zA-Z0-9_\\.\\-]+\\.(?:html?)(?:\\?.*)?)$')
      if (!rootHtmlUriMatch) {
        if (!request.headers.referer || (request.url.replace(/^\/+/gm, '').length < 4)) {
          if (!opts.enableAPI) return res404(response)
          var otherUriMatch = request.url.match('^/?api/1/([a-z_-]+)/?$')
          if (!otherUriMatch) return res404(response)
          else return doAPI(otherUriMatch[1], request, response)
        } else {
          var baseUri = request.baseUrl ? '(?:' + request.baseUrl.replace(/^\/+|\/+$/g, '').replace(/[-[\]{}()*+?.\\^$|]/g, '\\$&') + ')?' : ''
          var refUriMatch = request.headers.referer.match('^(?:https?\\://[a-zA-Z0-9_\\.\\-:]+)/?' + baseUri + '(?://(https?):)?/?(/[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}/.*)$')
          if (!refUriMatch) return res404(response)
          uriMatch = refUriMatch
          setReferer = uriMatch[2]
          uriMatch[2] = refUriMatch[2].replace(/^(\/+[^/]+).*$/, '$1') + '/' + request.url.replace(/^\/+/gm, '')
        }
      } else if (opts.rootURL) {
        uriMatch = rootHtmlUriMatch
        uriMatch[2] = '/' + opts.rootURL + '/' + request.url.replace(/^\/+/gm, '')
        uriMatch[1] = opts.rootSchema || 'https'
      } else {
        return res404(response)
      }
    }
    var scheme = (uriMatch[1]) ? uriMatch[1] : (request.headers['x-forwarded-proto'] || 'http')
    var options = url.parse('/' + uriMatch[2], false, true)
    if (!options.host) return res404(response)
    var headers = omit(request.headers, omitHeaders)
    if (setReferer) headers['referer'] = 'http' + (scheme === 'http' ? '' : 's') + ':' + setReferer
    options.headers = headers
    options.method = request.method
    options.agent = false
    options.timeout = 8000
    var req = (scheme === 'http' ? http : https).request(options, function (res) {
      if (res.statusCode && res.headers) {
        if (opts.enableCORS && request.headers.origin) {
          res.headers['access-control-allow-origin'] = '*'
          res.headers['access-control-expose-headers'] = 'Content-Length, X-Bfs-Responseurl'
        }
        res.headers['X-Bfs-Responseurl'] = (request.headers['x-forwarded-proto'] || 'http') + '://' + request.headers.host + '//http' + (scheme === 'http' ? '' : 's') + ':' + options.href
        if ((res.statusCode >= 200 && res.statusCode <= 299) || res.statusCode === 304) {
          response.writeHead(res.statusCode, res.headers)
          res.pipe(response, {end: true})
        } else {
          if (~[301, 302, 303, 307, 308].indexOf(res.statusCode) && res.headers.location) {
            if (request.headers.host) {
              if (res.headers.location.indexOf('/') === 0) res.headers.location = (request.headers['x-forwarded-proto'] || 'http') + '://' + request.headers.host + '//http' + (scheme === 'http' ? '' : 's') + '://' + options.host + res.headers.location
              else if (/^https?:\/\//i.test(res.headers.location)) res.headers.location = (request.headers['x-forwarded-proto'] || 'http') + '://' + request.headers.host + '//' + res.headers.location.replace(/^\w+:\/\/[^/]+/, function (match) { return match.toLowerCase() })
              response.writeHead(res.statusCode, res.headers)
              res.pipe(response, {end: true})
            } else {
              var statusMsg = '<!DOCTYPE html><html><head><title>' + res.statusCode + '</title></head><body><pre>' + JSON.stringify(res.headers, null, 4) + '</pre></body></html>'
              res.headers['content-length'] = statusMsg.length
              res.headers['content-type'] = 'text/html'
              response.writeHead(404, res.headers)
              response.end(statusMsg)
            }
          } else {
            response.writeHead(res.statusCode, res.headers)
            res.pipe(response, {end: true})
          }
        }
      } else {
        res404(response)
      }
    }).on('error', function (e) { res404(response) })
    request.pipe(req, {end: true})
  }
}
