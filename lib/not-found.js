'use strict';
module.exports = function (res){
	res.writeHead(404, 'Not Found', {'content-length': 9, 'content-type': 'text/plain'});
	res.end('Not Found');
};
