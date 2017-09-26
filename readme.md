# bfn-proxy

> Boot Fidelity NodeJS-Proxy


## Super simple to use

Designed to be the simplest way possible to proxy http calls.

## Install

```
$ npm install --save bfn-proxy
```

## Examples

### vanilla http server

Simple app.  If created on heroku, go to https://applicationname.herokuapp.com/twitter.com/

```js
require('http').createServer(require('bfn-proxy')()).listen(process.env.PORT||8080)
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
	if (req.connection.remoteAddress !== '127.0.0.1') return next(new Error('Bad authentication data'))
	pxy(req, res) 
})
```
  
## TODO

- Improve everything
