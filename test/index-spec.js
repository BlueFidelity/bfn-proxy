var assert = require('assert');
var pxy = require('../index');

describe('pxy', function() {
    describe('pxy()', function() {
        it('should return function', function () {
            assert.equal('function', typeof pxy());
        });
    });
});
