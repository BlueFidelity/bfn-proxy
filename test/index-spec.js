var assert = require('assert')
var pxy = require('../index')

describe('bfn-proxy', function () {
  describe('bfn-proxy()', function () {
    it('should return function', function () {
      assert.equal('function', typeof pxy())
    })
  })
})
