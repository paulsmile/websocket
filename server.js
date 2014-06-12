var http = require('http');
var fs = require('fs');
var mime = require('mime');
var path = require('path');
var cache = {}
var server = http.createServer(function(req,res){
	var filePath = false;
	if(req.url == '/') {
		filePath = 'public/index.html';
	} else {
		filePath = 'public'+req.url;
	}
	var absPath = './' + filePath;
	serverStatic(res,cache,absPath);
})

function serverStatic(response,cache,absPath) {
	if(cache[absPath]) {
		sendFile(response,absPath,cache[absPath])
	} else {
		fs.exists(absPath,function(exists){
			if(exists) {
				fs.readFile(absPath,function(err,data){
					if(err) {
						send404(response)
					} else {
						cache[absPath] = data;
						sendFile(response,absPath,data);
					}
				});
			} else {
				send404(response);
			}
		})
	}
}

function send404(response) {
	response.writeHead(404,{'Content-Type':'text/plain'});
	response.write('Error 404:resource not Found!');
	response.end();
}

function sendFile(response,filePath,fileContents) {
	response.writeHead(200,{'Content-Type':mime.lookup(path.basename(filePath))});
	response.end(fileContents);
}

var chatServer = require('./lib/chat_server');
chatServer.listen(server);


server.listen(3000,function(){
	console.log("Server listening on port 3000");
});


