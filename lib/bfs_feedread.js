/*
bfs_feedread = require('bfs_feedread')
*/
'use strict';
var zlib = require('zlib'),
iconv = require('iconv-lite'),
_ = require('lodash'),
request = require('request'),
MAX_SIZE_COMP = 102400,
MAX_SIZE_DECOMP = 500000,
MAX_ITEMS = 1000,
feedParser = require('feedparser'),
htmlToText = require('html-to-text'),
DBG_MODE = false;
//DBG_MODE = true;

function getStrField(s, c) {
	s = s.split(c);
	return s.length>1 ? s[1].trim() : false;
}

function getCharset(contentType) {
	if (contentType) {
		contentType = getStrField(contentType, ';');
		if (contentType) return getStrField(contentType, '=');
	}
	return false;
}

function feedRead(opts, cb) {
	if (!(this instanceof feedRead)) return new feedRead(opts, cb);
	Object.keys(feedRead.prototype).forEach(function(k){this[k] = this[k].bind(this);},this);
	if (opts.timeout) {
		opts.timeout =  parseInt(opts.timeout);
		if (!opts.timeout || isNaN(opts.timeout) || opts.timeout < 1000 || opts.timeout > 30000) opts.timeout = false;
	}
	if (!opts.timeout) opts.timeout = 7600;
	if (opts.dedup) opts.strict = true;
	if (opts.no_future || opts.sort || opts.last_date || opts.dedup) opts.date_to_ts = true;
	if (opts.only_next) {
		opts.only_next = parseInt(opts.only_next);
		if (!opts.only_next || isNaN(opts.only_next)) opts.only_next = false;
	}
	if (opts.only_last) {
		opts.only_last = parseInt(opts.only_last);
		if (!opts.only_last || isNaN(opts.only_last)) opts.only_last = false;
	}
	if (opts.last_date) {
		opts.last_date = (new Date(parseInt(opts.last_date))).getTime();
		if (isNaN(opts.last_date)) opts.last_date = false;
	}
	this.opts = opts;
	this.cb = cb;
	this.init();
}

feedRead.prototype.end = function(err, res){
	var cb = this.cb;
	this.cb = null;
	if (DBG_MODE) {
		if (err) console.error('CB CALLED Err:'+ err);
		else console.log('CB CALLED');
	}
	if (cb) cb(err, res);
};

feedRead.prototype.init = function(){
	var that = this;
	request({
		url: this.opts.url,
		headers: {
			'Accept': '*/*',
			'Connection': 'close',
			'User-Agent': 'BFS-FeedRead/1.1'
		},
		gzip: true,
		timeout: this.opts.timeout,
		maxRedirects: 5
	})
	.on('error', this.end)
	.on('response', function(res){
		if (res.statusCode != 200) return that.end('Error statusCode='+ res.statusCode);
		var headers = res.headers,
			contentLength = parseInt(headers['content-length']||0);
		if (contentLength && contentLength > MAX_SIZE_DECOMP) return that.end('Error contentLength='+ contentLength);
		if (DBG_MODE) console.log('res content-length:'+ contentLength);
		that.charset = getCharset(headers['content-type']);
		that.decompressRes(res, headers['content-encoding']);
	});
};

feedRead.prototype.decompressRes = function(res, encoding){
	var that = this,
		RES_MAX_SIZE = MAX_SIZE_DECOMP,
		total_a = 0,
		total_b = 0,
		decompress;
	
	res.on('error', this.end)
	.on('data', function(chunk){
		total_a += chunk.length;
		if (DBG_MODE) console.log('res Received chunk:'+ chunk.length +' total:'+ total_a);
		if (!that.cb || total_a > RES_MAX_SIZE) {
			if (DBG_MODE) console.error('res Exceeds max size');
			this.destroy(new Error('res Request exceeds max size'));
			this.unpipe();
		}
	});
	
	if (encoding) {
		if (encoding.match(/\bdeflate\b/)) decompress = zlib.createInflate();
		else if (encoding.match(/\bgzip\b/)) decompress = zlib.createGunzip();
	}
	
	if (decompress) {
		RES_MAX_SIZE = MAX_SIZE_COMP;
		res = res.pipe(decompress)
		.on('error', this.end)
		.on('data', function(chunk){
			total_b += chunk.length;
			if (DBG_MODE) console.log('decompressRes Received chunk:'+ chunk.length +' total:'+ total_b);
			if (!that.cb || total_b > MAX_SIZE_DECOMP) {
				if (DBG_MODE) console.error('decompressRes Exceeds max size');
				this.emit('error', new Error('decompressRes Request exceeds max size'));
				this.unpipe();
			}
		});
	}
	
	this.convRes(res);
};

feedRead.prototype.convRes = function(res){
	if (this.charset && !/utf-*8/i.test(this.charset)) {
		try {
			res = res.pipe(iconv.decodeStream('utf-8').on('error', this.end));
			if (DBG_MODE) res.on('data', function(chunk){console.log('convRes Received chunk:'+ chunk.length);});
		} catch(err) {
			res = false;
			this.end(err);
		}
	}
	if (res) this.parseFeedString(res);
};

feedRead.prototype.parseFeedString = function(res){
	var that = this,
		items = [],
		item = {},
		titles = {},
		n = 1;
	res.pipe(new feedParser({'addmeta':false,'feedurl':this.opts.url})
	.on('error', this.end)
	.on('end', function(){
		if (that.opts.sort && items.length>1) {
			if (that._first_item_date > that._last_item_date) items = _.reverse(items);
			items = _.sortBy(items, ['pubdate']);
		}
		if (items.length) {
			if (that.opts.only_next) {
				var old_items = items;
				items = [];
				for (var i=0;i<old_items.length;i++) {
					if (items.length < that.opts.only_next && (!that.opts.dedup || old_items[i].pubdate===titles[old_items[i].title])) items.push(old_items[i]);
				}
			} else if (that.opts.only_last) {
				var old_items = items;
				items = [];
				for (var i=0;i<old_items.length;i++) {
					if (i >= old_items.length - that.opts.only_last && (!that.opts.dedup || old_items[i].pubdate===titles[old_items[i].title])) items.push(old_items[i]);
				}
			}
		}
		if (that.opts.only_next||that.opts.only_last) return that.end(null, items.length?items:false);
		that.end(null, {'meta':item,'items':items});
	})
	.on('meta', function(meta){
		if (DBG_MODE) console.log('parseFeedString meta');
		item = _.pick(meta,['title','description','link','date','pubdate','author','xmlurl','image','categories']);
	})
	.on('data', function(post){
		if (DBG_MODE) console.log('parseFeedString data #'+ n);
		if (!that.cb || ++n > MAX_ITEMS) {
			if (DBG_MODE) console.error('parseFeedString Exceeds max size');
			this.destroy(new Error('parseFeedString Request exceeds max size'));
			this.unpipe();
		} else {
			if (that.opts.strict && (!post.title || !post.pubdate || !post.guid)) return;
			if (that.opts.date_to_ts) {
				if (!post.pubdate) return;
				post.pubdate = (new Date(post.pubdate)).getTime();
				if (isNaN(post.pubdate)) return;
				if (!that._first_item_date) that._first_item_date = post.pubdate;
				else that._last_item_date = post.pubdate;
				if (that.opts.dedup) {
					if (!titles[post.title] || titles[post.title] > post.pubdate) titles[post.title] = post.pubdate;
					else return;
				}
				if (that.opts.last_date && post.pubdate < that.opts.last_date) return;
				if (that.opts.no_future && post.pubdate > Date.now()) return;
				if ((that.opts.last_guid || that.opts.last_title) && that.opts.last_date && post.pubdate === that.opts.last_date) {
					if (that._same_date_last || (that.opts.last_guid && post.guid === that.opts.last_guid) || (that.opts.last_title && post.title === that.opts.last_title)) {
						that._same_date_last = true;
						return;
					}
				}
			}
			if (that.opts.last_guid && post.guid === that.opts.last_guid) return;
			if (that.opts.last_title && post.title === that.opts.last_title) return;
			if (post.link && !/^https?:\/\/[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\/[^\s]*$/.test(post.link)) delete post.link;
			if (post.image && (!post.image.url || !/^https?:\/\/[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\/[^\s]*$/.test(post.image.url))) delete post.image;
			if (that.opts.img_from_content && Array.isArray(post.enclosures) && post.enclosures[0]) {
				var enclosure = post.enclosures[0];
				if (enclosure.url && /^https?:\/\/[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\/[^\s]*$/.test(enclosure.url) && (enclosure.type && enclosure.type.indexOf('image') === 0 || /\.(?:jpg|jpeg|gif|png)([#\?].*)?$/.test(enclosure.url))) {
					post.image = {'url': enclosure.url};
					if (post['media:description'] && post['media:description']['#'] && typeof post['media:description']['#'] === 'string') post.description = post['media:description']['#'];
				}
			}
			if (that.opts.img_from_html && !post.image && post.description) {
				var imgMatch = post.description.match(/<img [^>]*src="(https?:\/\/[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\/[^"]+\.(?:jpg|jpeg|gif|png))/i);
				if (imgMatch && imgMatch.length > 1) post.image = {'url': imgMatch[1]};
			}
			if (that.opts.simple && post.image) post.image = post.image.url;
			if (that.opts.html_to_text && post.description) post.description = htmlToText.fromString(post.description.replace(/\r/g,'').replace(/ |&nbsp;/ig,' ').replace(/\<div\b/ig,'<p').replace(/\<\/div\>/ig,'</p>'), {wordwrap:false, noLinkBrackets:false, ignoreImage:true, preserveNewlines:true, uppercaseHeadings:false, hideLinkHrefIfSameAsText:true, format:{horizontalLine:function(){return '\n';}}}).replace(/\r/g,'').replace(/\s*\[[^\]]+\.(?:jpg|jpeg|gif|png)\b[^\]]*\]\s*/gi,' ').replace(/\[([^\]]*)\]/g,' $1 ').replace(/^(\W*\w+:\/\/[^\s]*\s)+/g,'').replace(/\bjavascript:\/\//gi,'').replace(/\w+:\/\/$/g,'').replace(/[^\S\n]+$/mg,'').replace(/^\s+|\s+$/g,'').replace(/[^\S\n][^\S\n]+/g,' ').replace(/\n\n+/g,'\n\n');
			items.push(_.pick(post,that.opts.simple?['title','description','link','pubdate','guid','image']:['title','description','link','origlink','date','pubdate','author','guid','image','categories','source','enclosures']));
		}
	}));
};


module.exports = feedRead;
