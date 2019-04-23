var http = require("http");
var fs = require("fs");

var util = require("./util");
var uzbl = require("./Uzbl.js");


var collectLines = util.collectLines;
var testPrefix = util.testPrefix;
var respondNotFound = util.respondNotFound;

var lines = uzbl.lines;
var Uzbl = uzbl.Uzbl;


function parseStderrLine(source, lineType, line){
    return {
	"type": "stderr",
	source: source,
	event: {
	    "type": lineType,
	    line: line
	}
    };
}
var controller = false;
function handleStderrLine(line){
    return console.log(line);
    return lines.push(line);
}
function startController(port){
    var browser = new Uzbl();
    controller = browser;
    browser.processEvents();
    browser.collectErrorLines(
	function(line, cmd){
	    return handleStderrLine(
		parseStderrLine("controller", cmd, line)
	    );
	}
    );
    browser.setForwardKeys(
	true,
	function(){
	    browser.visit(
		"http://localhost:" + +port + "/",
		function(){
		    browser.iconGopo()
		}
	    );
	}
    );
    return browser;
}
function controllerRunningp(){
    if(!controller) return false;
    if("done" in controller) return false;
    return true;
}
function ensureController(port){
    if(controllerRunningp()) return;
    return startController(port);
}
function launch(handler, port){
    http.createServer(handler).listen(
	port,
	"localhost",
	function(){
	    ensureController(port);
	}
    );
}

function respondLinesText(lines, response){
    response.setHeader("Content-Type", "text/plain");
    response.end("stdout:\r\n\r\n" + JSON.stringify(lines, null, "\t"));
}
function respondLinesJson(lines, response){
    response.setHeader("Content-Type", "application/json");
    response.end(JSON.stringify(lines, null, "\t"));
}
function respondLinesIframes(lines, response){
    response.setHeader("Content-Type", "text/html");
    var crlf = "\r\n";
    response.end(
	[
	    "<html>",
	    "\t<head>",
	    "\t\t<title>lines</title>",
	    "\t</head>",
	    "\t<body>",
	    "\t\t<ol start=\"0\">",
	    lines.map(
		function(l, i){
		    return [
			"<li>",
			"\t<iframe src=\"/line/" + i + "\"></iframe>",
			"</li>"
		    ].map(
			function(line){
			    return "\t\t\t" + line;
			}
		    ).join(crlf)
		}
	    ).join(crlf),
	    "\t\t</ol>",
	    "\t</body>",
	    "</html>",
	    ""
	].join(crlf)
    );
}
function respondLinesHtml(lines, response){
    response.setHeader("Content-Type", "text/html");
    var crlf = "\r\n";
    response.end(
	[
	    "<html>",
	    "\t<head>",
	    "\t\t<title>lines</title>",
	    "\t</head>",
	    "\t<body>",
	    "\t\t<ol start=\"0\">",
	    lines.map(
		function(event, i){
		    var url = "/line/" + i;
		    var iframe = "<iframe src=\"" + url + "\"></iframe>";
		    var markup = "\t" + iframe;
		    if("event" == event["type"])
			markup = [
			    event["instance ID"] + " event " +
				"@ " + event.timestamp,
			    "<br/>",
			    "unknown" == event.event["type"] ? iframe : [
				"<a href=\"" + url + "\">",
				"\t" + event.event["type"],
				"</a>"
			    ].join(crlf)
			].join(crlf).split(crlf).map(
			    function(line){
				return "\t\t\t\t" + line;
			    }
			).join(crlf)
		    return [
			"<li>",
			markup,
			"</li>"
		    ].map(
			function(line){
			    return "\t\t\t" + line;
			}
		    ).join(crlf)
		}
	    ).join(crlf),
	    "\t\t</ol>",
	    "\t</body>",
	    "</html>",
	    ""
	].join(crlf)
    );
}
function respondHome(browser, response){
    response.setHeader("Content-Type", "text/html");
    var homeAnchor = "<a href=\"/\">home</a>";
    var iframeName = "portal";
    var outputUrl = "/output.html";
    var outIframe = "<iframe" +
	" src=\"" + outputUrl + "\"" +
	" name=\"" + iframeName + "\"" +
	">" +
	"</iframe>";
    var outputAnchor = "<a" +
	" href=\"" + outputUrl + "\"" +
	" target=\"" + iframeName + "\"" +
	">" +
	"output lines" +
	"</a>";
    var browserEventsAnchor = "<a" +
	" href=\"/browser/events/\"" +
	" target=\"" + iframeName + "\"" +
	">" +
	"browser events" +
	"</a>";
    var controllerEventsAnchor = "<a" +
	" href=\"/controller/events/\"" +
	" target=\"" + iframeName + "\"" +
	">" +
	"controller events" +
	"</a>";
    var inFormLines = [
	"<form method=\"POST\" action=\"/send-line\">",
	"\t<input name=\"line\"></input>",
	"\t<input type=\"submit\" value=\"send\"></input>",
	"</form>"
    ];
    var controllerFormLines = [
	"<form method=\"POST\" action=\"/start-controller\">",
	"\t<input type=\"submit\" value=\"controller\"></input>",
	"</form>"
    ];
    var br = "<br />";
    var crlf = "\r\n";
    var uriVar = browser.uri
    var uriString = "";
    if(uriVar != null)
	uriString = uriVar;
    var uriEscaped = uriString.split("&").join("&amp").split("\"").join(
	"&quot;"
    ).split(">").join("&gt;").split("<").join("&lt;");
    var uriFormLines = [
	"<form method=\"POST\" action=\"/visit\">",
	"\t<input name=\"uri\" value=\"" + uriEscaped + "\"></input>",
	"\t<input type=\"submit\" value=\"Go\"></input>",
	"</form>"
    ];
    var evalFormLines = [
	"<textarea id=\"evalBox\"></textarea>",
	"<input type=\"button\" id=\"evalButton\" value=\"eval\"></input>"
    ];
    response.end(
	[
	    "<html>",
	    "\t<head>",
	    "\t\t<title>Uzbl control server</title>",
	    "\t\t<script src=\"./jQuery.js\"></script>",
	    "\t\t<script src=\"./index.js\"></script>",
	    "\t</head>",
	    "\t<style>",
	    "\t\tiframe{width: 100%; height: 50%; font-family: monospace;}",
	    "</style>",
	    "\t<body>",
	    "\t\t" + homeAnchor,
	    "\t\t" + br,
	    evalFormLines.map(
		function(line){
		    return "\t\t" + line;
		}
	    ).join(crlf),
	    inFormLines.map(
		function(line){
		    return "\t\t" + line;
		}
	    ).join(crlf),
	    "\t\t" + browserEventsAnchor,
	    "\t\t" + br,
	    "\t\t" + controllerEventsAnchor,
	    controllerFormLines.map(
		function(line){
		    return "\t\t" + line;
		}
	    ).join(crlf),
	    uriFormLines.map(
		function(line){
		    return "\t\t" + line;
		}
	    ).join(crlf),
	    "\t\t" + outputAnchor,
	    "\t\t" + outIframe,
	    "\t</body>",
	    "</html>",
	    ""
	].join(crlf)
    );
}
function handleWriteLine(browser, req, callback){
    var lines = [];
    collectLines(
	req,
	function(line, cmd){
	    lines.push(line);
	    if("end" != cmd) return;
	    var result = lines.join("\n");
	    var tokens = result.split("=");
	    tokens.shift();
	    var value = tokens.join("=").split("+").join(" ");
	    browser.writeln(decodeURIComponent(value), callback);
	}
    );
}
function handleStartController(port, req, callback){
    ensureController(port);
    return callback();
}
function respondLine(lines, url, response){
    var prefix = "/line/";
    var tail = url.substring(prefix.length);
    var line = lines[+tail];
    response.setHeader("Content-Type", "application/json");
    response.end(JSON.stringify(line, null, "\t"));
}
function redirectHome(response){
    response.statusCode = 303;
    response.setHeader("Location", "/");
    response.statusMessage = "See Other";
    return response.end();
}
function handleVisitUri(browser, request, callback){
    var lines = [];
    collectLines(
	request,
	function(line, cmd){
	    lines.push(line);
	    if("end" != cmd) return;
	    var result = lines.join("\n");
	    var tokens = result.split("=");
	    tokens.shift();
	    var uri = tokens.join("=").split("+").join(" ");
	    browser.visit(decodeURIComponent(uri), callback);
	}
    );
}
function serveJsFromFile(path, response){
    response.setHeader("Content-Type", "application/javascript");
    return fs.createReadStream(path).pipe(response);
}
function serveIndexJs(response){
    return serveJsFromFile("./static/index.js", response);
}
var jQueryPath = "./static/" +
    "sha256-" +
    "87083882cc6015984eb0411a99d3981817f5dc5c90ba24f0940420c5548d82de" +
    ".js";
function serveJquery(response){
    return serveJsFromFile(jQueryPath, response);
}
function server(port){
    var browser = new Uzbl();
    browser.processEvents();
    browser.collectErrorLines(
	function(line, cmd){
	    handleStderrLine(
		parseStderrLine("browser", cmd, line)
	    );
	}
    );
    browser.disableScripts(
	function(){
	    return browser.tinfoilHat(
		function(){
		    return browser.setForwardKeys(
			true,
			function(){
			    return browser.iconGopo(
				function(){
				    return browser.visit(
					"http://localhost:8080"
				    );
				}
			    );
			}
		    );
		}
	    );
	}
    );
    return function(req, res){
	if("/index.js" == req.url)
	    return serveIndexJs(res);
	if("/jQuery.js" == req.url)
	    return serveJquery(res);
	if("/output.txt" == req.url)
	    return respondLinesText(lines, res);
	if("/output.json" == req.url)
	    return respondLinesJson(lines, res);
	if("/output-iframes.html" == req.url)
	    return respondLinesIframes(lines, res);
	if("/output.html" == req.url)
	    return respondLinesHtml(lines, res);
	if("/send-line" == req.url)
	    if("POST" == req.method.toUpperCase())
		return handleWriteLine(
		    browser,
		    req,
		    function(){
			return redirectHome(res);
		    }
		);
	if("/start-controller" == req.url)
	    if("POST" == req.method.toUpperCase())
		return handleStartController(
		    port,
		    req,
		    function(){
			return redirectHome(res);
		    }
		);
	if(testPrefix(req.url, "/line/"))
	    return respondLine(lines, req.url, res);
	var ebPrefix = "/browser/events/";
	if(ebPrefix == req.url)
	    return browser.respondEvents(res);
	if(testPrefix(req.url, ebPrefix))
	    return browser.respondEvent(
		req.url.substring(ebPrefix.length),
		res
	    );
	var ecPrefix = "/controller/events/";
	if(controller){
	    if(ecPrefix == req.url)
		return controller.respondEvents(res);
	    if(testPrefix(req.url, ecPrefix))
		return controller.respondEvent(
		    req.url.substring(ecPrefix.length),
		    res
		);
	}
	if("/" == req.url)
	    return respondHome(browser, res);
	if("/visit" == req.url)
	    if("POST" == req.method.toUpperCase())
		return handleVisitUri(
		    browser,
		    req,
		    function(){
			return redirectHome(res);
		    }
		);
	return respondNotFound(res);
    }
}

var port = 8105;
launch(
    server(port),
    port
);
