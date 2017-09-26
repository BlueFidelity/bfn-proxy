'use strict';
module.exports = function(other_uri_match, request, response){
	var status_code = 200,
		status_msg;
	switch (other_uri_match){
		case 'status':
			status_msg = 'OK';
			break;
		case 'debug':
			status_msg = JSON.stringify({
				'headers': request.headers,
				'url': request.url,
				'env': process.env
			}, null, 4);
			break;
		case 'myip':
			status_msg = request.headers['x-forwarded-for'] || request.connection.remoteAddress;
			break;
		case 'date':
			status_msg = (new Date()).toString();
			break;
		default:
			status_code = 404;
			status_msg = 'Not Found';
	}
	response.writeHead(status_code, {'content-length': status_msg.length, 'content-type': 'text/plain'});
	return response.end(status_msg);
};
