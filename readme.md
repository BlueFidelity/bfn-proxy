# bfn-proxy
> HTTP request proxy middleware for node.js

[![NPM Version][npm-image]][npm-url]
[![Build Status][travis-image]][travis-url]
[![Test Coverage][coveralls-image]][coveralls-url]

Designed to be the simplest way possible to proxy http calls.

## Features

  * Small footprint
  * Responses are unmodified (only headers are modified)
  * Built for browser use (url-relative/root-relative resources work)
  * Great for testing your website at proxy location
  * Great for grabbing a screen shot of your website from proxy location

## Install

```
$ npm install --save bfn-proxy
```

## Examples

### vanilla http server

Simple app.  If created on heroku, go to https://applicationname.herokuapp.com/twitter.com/

```js
require('http')
  .createServer(require('bfn-proxy')())
  .listen(process.env.PORT || 8080)
```

### express/connect simple

Simple app using middleware, i.e. http://servername.com/ipecho.net/plain

```js
var express = require('express')
var pxy = require('bfn-proxy')()

var app = express()

app.use(pxy)
```

### express/connect advanced

Only allow access from your local server with URI prefix '/pxy', i.e. http://127.0.0.1/pxy/www.bluefidelity.com/

```js
var express = require('express')
var pxy = require('bfn-proxy')()

var app = express()

app.use('/pxy/', function (req, res, next) {
  if (req.connection.remoteAddress !== '127.0.0.1') {
    return next(new Error('Bad authentication data'))
  }
  pxy(req, res)
})
```
  
## TODO

- Improve everything

## License

[MIT](LICENSE)

[npm-image]: https://img.shields.io/npm/v/bfn-proxy.svg
[npm-url]: https://npmjs.org/package/bfn-proxy
[travis-image]: https://img.shields.io/travis/BlueFidelity/bfn-proxy/master.svg
[travis-url]: https://travis-ci.org/BlueFidelity/bfn-proxy
[coveralls-image]: https://img.shields.io/coveralls/BlueFidelity/bfn/master.svg
[coveralls-url]: https://coveralls.io/r/BlueFidelity/bfn?branch=master

