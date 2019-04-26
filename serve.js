var http = require("http");
var fs = require("fs");

var util = require("./util");
var uzbl = require("./Uzbl.js");


var collectLines = util.collectLines;
var testPrefix = util.testPrefix;
var respondNotFound = util.respondNotFound;

var lines = uzbl.lines;
var Uzbl = uzbl.Uzbl;


function StandardErrorLine(source, lineType, line){
    this.source = source;
    this.event = {
	"type": lineType,
	line: line
    };
}
function StandardErrorEmptyLine(source){
    this.source = source;
}
StandardErrorEmptyLine.prototype.event = {
    "type": "empty"
};
function StandardErrorUzblCoreLine(source, line){
    this.source = source;
    line = line.substring(this.prefix.length);
    var tokens = line.split(")");
    var uzblId = +(tokens.shift());
    line = tokens.join(")").substring(": ".length);
    this.event = {
	"type": "uzbl-core",
	"uzbl-core": uzblId,
	line: line
    };
}
StandardErrorUzblCoreLine.prototype.prefix = "(uzbl-core:";
function ConsoleMessage(source, line){
    this.source = source;
    line = line.substring(this.prefix.length);
    var tokens = line.split(":");
    var lineNumber = +(tokens.shift());
    line = tokens.join(":").substring(" ".length);
    this.event = {
	"type": "console message",
	line: lineNumber,
	message: line
    }
};
ConsoleMessage.prototype.prefix = "** Message: console message:  @";
StandardErrorLine.prototype["type"] = "stderr";
function parseStderrLine(source, lineType, line){
    if("line" == lineType){
	if(testPrefix(line, ConsoleMessage.prototype.prefix))
	    return new ConsoleMessage(source, line);
	if("" == line)
	    return new StandardErrorEmptyLine(source);
	if(testPrefix(line, StandardErrorUzblCoreLine.prototype.prefix))
	    return new StandardErrorUzblCoreLine(source, line);
    }
    return new StandardErrorLine(source, lineType, line);
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
function HtmlTag(name, attributes, children, singletonp){
    this.name = name;
    if(attributes)
	this.attributes = attributes;
    if(children)
	this.children = children;
    else this.children = [];
    this.singletonp = !!singletonp;
}
HtmlTag.prototype.toString = function(){
    var singleton = this.singletonp;
    if(this.children)
	if(this.children.length)
	    singleton = false;
    var attrs = this.attributes;
    var openTag = "<";
    openTag += this.name;
    var attrsString = "";
    if(attrs)
	if(attrs.length)
	    attrs.map(
		function(kv){
		    var k = kv[0];
		    var v = kv[1];
		    attrsString += " ";
		    attrsString += k;
		    attrsString += "=\"";
		    var escaped = v.split("&").join(
			"&amp;"
		    ).split("\"").join(
			"&quot;"
		    ).split(">").join("&gt;").split("<").join("&lt;");
		    attrsString += escaped;
		    attrsString += "\"";
		}
	    );
    openTag += attrsString;
    if(singleton) openTag += " /";
    openTag += ">";
    if(singleton) return openTag;
    var closeTag = "</" + this.name + ">";
    var crlf = "\r\n";
    var oneLine = false;
    if(!this.children) oneLine = true;
    else if(!this.children.length) oneLine = true;
    else if(1 == this.children.length)
	if(!(this.children[0] instanceof HtmlTag))
	    if((openTag + this.children[0] + closeTag).length < 80)
		oneLine = true;
    if(oneLine)
	return openTag + this.children.join("") + closeTag;
    var contents = this.children.join(crlf).split(crlf).map(
	function(line){
	    return "\t" + line;
	}
    ).join(crlf);
    return openTag + crlf + contents + crlf + closeTag;
};
function respondHome(browser, response){
    response.setHeader("Content-Type", "text/html");
    var homeAnchor = new HtmlTag("a", [["href", "/"]], ["home"]);
    var iframeName = "portal";
    var outputUrl = "/output.html";
    var outIframe = new HtmlTag(
	"iframe",
	[["src", outputUrl], ["name", iframeName]],
	[]
    );
    var outputAnchor = new HtmlTag(
	"a",
	[["href", outputUrl], ["target", iframeName]],
	["output lines"]
    );
    var browserEventsAnchor = new HtmlTag(
	"a",
	[["href", "/browser/events/"], ["target", iframeName]],
	["browser events"]
    );
    var controllerEventsAnchor = new HtmlTag(
	"a",
	[["href", "/controller/events/"], ["target", iframeName]],
	["controller events"]
    );
    var inForm = new HtmlTag(
	"form",
	[["method", "POST"], ["action", "/send-line"]],
	[
	    new HtmlTag("input", [["name", "line"]], []),
	    new HtmlTag("input", [["type", "submit"], ["value", "send"]], [])
	]
    );
    var crlf = "\r\n";
    var controllerForm = new HtmlTag(
	"form",
	[["method", "POST"], ["action", "/start-controller"]],
	[
	    new HtmlTag(
		"input",
		[["type", "submit"], ["value", "controller"]],
		[]
	    )
	]
    );
    var br = new HtmlTag("br", [], [], true);
    var uriVar = browser.uri
    var uriString = "";
    if(uriVar != null)
	uriString = uriVar;
    var uriForm = new HtmlTag(
	"form",
	[["method", "POST"], ["action", "/visit"]],
	[
	    new HtmlTag("input", [["name", "uri"], ["value", uriString]], []),
	    new HtmlTag("input", [["type", "submit"], ["value", "Go"]], [])
	]
    );
    response.end(
	"" + new HtmlTag(
	    "html",
	    [],
	    [
		new HtmlTag(
		    "head",
		    [],
		    [
			new HtmlTag("title", [], ["Uzbl control server"]),
			new HtmlTag("script", [["src", "./jQuery.js"]], []),
			new HtmlTag("script", [["src", "./index.js"]], []),
			new HtmlTag(
			    "style",
			    [],
			    [
				"iframe{",
				"\twidth: 100%;",
				"\theight: 50%;",
				"\tfont-family: monospace;",
				"}"
			    ]
			)
		    ]
		),
		new HtmlTag(
		    "body",
		    [],
		    [
			homeAnchor,
			br,
			new HtmlTag("textarea", [["id", "evalBox"]], []),
			new HtmlTag(
			    "input",
			    [
				["type", "button"],
				["id", "evalButton"],
				["value", "eval"]
			    ],
			    []
			),
			new HtmlTag(
			    "pre",
			    [
				["id", "debugOutput"]
			    ],
			    []
			),
			inForm,
			browserEventsAnchor,
			br,
			controllerEventsAnchor,
			controllerForm,
			uriForm,
			outputAnchor,
			outIframe
		    ]
		)
	    ]
	) + crlf
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
