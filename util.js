function collectLines(stream, lineBack){
    var chunks = [];
    stream.on(
	"data",
	function(chunk){
	    var c = Buffer.isBuffer(chunk) ? chunk : new Buffer(chunk);
	    chunks.push(c);
	    if(-1 == c.indexOf("\n")) return;
	    var lines = Buffer.concat(chunks).toString().split("\n");
	    chunks = [new Buffer(lines.pop())];
	    lines.map(function(l, i, a){lineBack(l, "line");});
	}
    );
    stream.on(
	"end",
	function(){
	    var tail = Buffer.concat(chunks).toString();
	    chunks = [];
	    return lineBack(tail, "end");
	}
    );
}

function testPrefix(str, prefix){
    return str.substring(0, prefix.length) == prefix;
}

function respondNotFound(response){
    response.statusCode = 404;
    response.statusMessage = "Not Found";
    return response.end("Not Found");
}


exports.collectLines = collectLines;
exports.testPrefix = testPrefix;
exports.respondNotFound = respondNotFound;
