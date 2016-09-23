module.exports = (upload) => {

var express = require('express');
var assert = require('assert');
var fs = require('fs');
var mm = require('musicmetadata');

var db_get = require('../src/db_get');
var db_post = require('../src/db_post');
var audio = require('../src/audio');

var router = express.Router();

function api_error(code,text) {
	if (!text)
		text="";
	else text+="\n\n";
	res.status(code).send(text + "API error occurred.");
}

function get(req,res,next) {
	path = req.url.split("/").filter((e) => {return e.length>0});
	if (path.length<=1) {
		return res.status(200).send("Welcome to the FlyWeb-mp3 API!")
	} else {
		// /api/
		if (path[0]=="p") {
			// /api/p/{plid}/
			if (path.length<2) return api_error(400,"must supply plid");
			plid = path[1];
			res.send(200,db_get.playlist(plid,true));
		}
	}
}

/* GET router */
router.get(/.*/, function(req, res, next) {
	get(req,res,next)
});

// POST a song to the given playlist
// sends back id of song
function post_song_upload(req,res,next,plid) {
	assert(!!req.file);

	var parser = mm(fs.createReadStream(req.file.destination + req.file.filename), { duration: true }, function (err, metadata) {
		if (err) throw err;
		if (metadata.title != "") {
			var title = metadata.title;
		} else {
			var title = req.file.originalname;
		}
		console.log(title);
		db_post.song({
			type: "upload",
			name: title,
			duration: metadata.duration, //TODO
			upload_file: req.file.destination + req.file.filename
		},
		function(sid, err) {
			if (err)
				return api_error(500);
			db_post.playlist_append(sid,plid,function (err) {
				audio.update(0);
				if (err)
					return api_error(500);
				else
					return res.status(200).send();
			})
		})
	});
}

function post(req,res,next) {
	path = req.url.split("/").filter((e) => {return e.length>0});
	if (path.length<=1) {
		return api_error(400,"Cannot post to API root");
	} else {
		// /api/
		plid = path[0];
		if (path.length==1) {
			// /api/{plid}
			// TODO: change to /api/p/{plid}
			console.log(db_post);
			return db_post.playlist(req.data);
		}
		if (path[1]=="songs") {
			// /api/{plid}/songs
			// TODO: change to /api/p/{plid}/songs
			if (path.length==2) {
				return api_error(400,"Please post to a subpath, such as songs/upload");
			} else {
				if (path[2]=="upload") {
					// /api/{plid}/songs/upload
					if (path.length>3)
						return api_error(400);
					return post_song_upload(req,res,next,plid);
				}
			}
		}
	}
	next();
}

/* POST router, song upload */
router.post(/.*\/songs\/upload\/?$/, upload.single("song"), function(req,res,next) {
	post(req,res,next);
});

/* POST router, non-file-upload */
router.post(/.*/, function(req, res, next) {
	post(req,res,next);
});

return router;
}
