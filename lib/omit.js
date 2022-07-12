'use strict'
module.exports = function (o, a) {
  var n = {}
  for (var k in o) {
    if (a.indexOf(k) === -1) n[k] = o[k]
  }
  return n
}
