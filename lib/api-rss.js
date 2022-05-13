'use strict'
var parseURL = require('url').parse,
bfs_feedread = require('./bfs_feedread');

function resEndJSON(res,status,s) {
	s = new Buffer(JSON.stringify(s), 'utf8');
	res.writeHead(status, {
		'Content-Type': 'application/json; charset=utf-8',
		'Content-Length': ''+s.length
	});
	res.end(s);
}

module.exports = function (req, res) {
	var query = parseURL(req.url,true).query;
	if (!query.url) return resEndJSON(res, 400, 'Bad Request');
	bfs_feedread({
		'url': query.url,
		'timeout': query.timeout||false,
		'strict': query.strict==='1',
		'dedup': query.dedup==='1',
		'simple': query.simple==='1',
		'date_to_ts': query.date_to_ts==='1',
		'no_future': query.no_future==='1',
		'img_from_content': query.img_from_content==='1',
		'img_from_html': query.img_from_html==='1',
		'html_to_text': query.html_to_text==='1',
		'sort': query.sort==='1',
		'only_next': query.only_next||false,
		'only_last': query.only_last||false,
		'last_date': query.last_date||false,
		'last_guid': query.last_guid||false,
		'last_title': query.last_title||false
	}, function(err, feed){
		if (err) return resEndJSON(res, 500, err);
		resEndJSON(res, 200, feed);
	});
};
