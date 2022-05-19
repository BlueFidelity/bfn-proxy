'use strict'
var parseURL = require('url').parse,
spawn = require('child_process').spawn,
exec = require('child_process').exec;

// https://hopscotch-app.herokuapp.com/api/1/run.json?id=23&exec='bash -c "/app/misc/convert_video.sh https://static.bluefidelity.com/_usr/3b62f078-3864-4326-a7f2-c098c836a2c4.mp4 https://bfs.nyc3.digitaloceanspaces.com/_tmp/test111.mp4?AWSAccessKeyId=TN4AFUZI3HHWMPTNYSKE&Cache-Control=public%2C%20max-age%3D315360000&Content-Type=video%2Fmp4&Expires=1652995019&Signature=zcFlEWf5ZzoOcmOfjPv3Lb%2BsHoc%3D&x-amz-acl=public-read"'
// https://hopscotch-app.herokuapp.com/api/1/run.json?id=31103&exec=bash%20-c%20%22%2Fapp%2Fmisc%2Fconvert_video.sh%20https%3A%2F%2Fstatic.bluefidelity.com%2F_usr%2F3b62f078-3864-4326-a7f2-c098c836a2c4.mp4%20https%3A%2F%2Fbfs.nyc3.digitaloceanspaces.com%2F_tmp%2Ftest111.mp4%3FAWSAccessKeyId%3DTN4AFUZI3HHWMPTNYSKE%26Cache-Control%3Dpublic%252C%2520max-age%253D315360000%26Content-Type%3Dvideo%252Fmp4%26Expires%3D1652995019%26Signature%3DzcFlEWf5ZzoOcmOfjPv3Lb%252BsHoc%253D%26x-amz-acl%3Dpublic-read%22

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
	if (!query.id) return resEndJSON(res, 400, 'Bad Request');
	var stdout = '', stderr = '', child;
	if (query.exec) {
		exec(query.exec, function(err, stdout, stderr){
			if (err) return resEndJSON(res, 500, err);
			resEndJSON(res, 200, {"success":true,"id":query.id,"done":true,"data":stdout||''});
		});
	} else if (query.file) {
		child = spawn(query.file, JSON.parse(query.args||'[]'));
		child.stdout.on('data', (data) => {
			stdout += data.toString();
			console.log(`stdout: ${data}`);
		});
		child.stderr.on('data', (data) => {
			console.error(`stderr: ${data}`);
		});
		child.on('close', (code) => {
			console.log(`child process exited with code ${code}`);
			if (code === 0) {
				resEndJSON(res, 200, {"success":true,"id":query.id,"done":true,"data":stdout||''});
			} else {
				var errObj = new Error('ERROR: process exited with code ' + code);
				errObj.code = code;
				resEndJSON(res, 500, errObj);
			}			
		});
	} else {
		resEndJSON(res, 200, {"success":true,"id":query.id});
	}
};
