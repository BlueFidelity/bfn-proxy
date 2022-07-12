'use strict'
module.exports = function (o, f) {
  var n = {}
  for (var k in o) {
    if (f(k)) n[k] = o[k]
  }
  return n
}
