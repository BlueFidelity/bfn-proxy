'use strict'
module.exports = function (otherUriMatch, request, response) {
  var statusCode = 200
  var statusMsg
  switch (otherUriMatch) {
    case 'status':
      statusMsg = 'OK'
      break
    case 'debug':
      statusMsg = JSON.stringify({
        'headers': request.headers,
        'url': request.url,
        'env': process.env
      }, null, 4)
      break
    case 'myip':
      statusMsg = request.headers['x-forwarded-for'] || request.connection.remoteAddress
      break
    case 'date':
      statusMsg = (new Date()).toString()
      break
    default:
      statusCode = 404
      statusMsg = 'Not Found'
  }
  response.writeHead(statusCode, {'content-length': statusMsg.length, 'content-type': 'text/plain'})
  return response.end(statusMsg)
}
