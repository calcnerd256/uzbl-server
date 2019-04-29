var child_process = require("child_process");
var util = require("./util");

var collectLines = util.collectLines;
var testPrefix = util.testPrefix;
var respondNotFound = util.respondNotFound;


var lines = [];
function handleLine(lineObject){
    lines.push(lineObject);
}

function parseSingleQuotedString(s){
    if("'" != s[0]) return null;
    var l = s.length - 1;
    if("'" != s[l]) return null;
    var result = s.substring(1, l);
    var tokens = result.split("\\'");
    if(tokens.filter(function(t){return -1 != t.indexOf("'");}).length)
	return null;
    return tokens.join("'").split("\\\\").join("\\");
}
function parseSingleQuotedStringWithoutSpaces(spaceless){
    if(-1 != spaceless.indexOf(" ")) return null;
    return parseSingleQuotedString(spaceless);
}
function parseSpaceSeparatedListOfSingleQuotedStrings(s){
    var tokens = s.split(" ").map(parseSingleQuotedStringWithoutSpaces);
    if(tokens.filter(function(token){return null == token;}).length)
	return null;
    return tokens;
};
function suffix(s, prefix){
    return s.substring(prefix.length);
}


function UzblOutputLine(lineType){
    this.setTime();
    this["type"] = lineType;
}
UzblOutputLine.prototype.setTime = function(){
    this.timestamp = new Date();
};

function UzblErrorLine(error, line){
    this.setTime();
    this.error = error;
    this.offender = line;
}
UzblErrorLine.prototype = new UzblOutputLine("error");

function UzblEvent(eventType){
    this["type"] = eventType;
}
UzblEvent.prototype.collectKeys = function(){
    var parent = Object.getPrototypeOf(this);
    var ownKeys = Object.keys(this);
    var parentKeys = [];
    if("collectKeys" in parent)
	parentKeys = parent.collectKeys();
    return parentKeys.concat(ownKeys);
};
UzblEvent.prototype.toJSON = function(){
    var keys = this.collectKeys();
    var result = {};
    var that = this;
    keys.map(function(k){result[k] = that[k];});
    delete result.toJSON;
    return result;
};
function EventUnknown(eventArgs){
    this.args = eventArgs;
}
EventUnknown.prototype = new UzblEvent("unknown");

function parseSingleNumberEvent(Event, string){
    var numberString = suffix(string, Event.prototype["type"] + " ");
    return new Event(+numberString);
}
function InstanceIdEvent(eventType){
    this["type"] = eventType;
}
InstanceIdEvent.prototype = new UzblEvent("do not use: instance ID event");
InstanceIdEvent.prototype.construct = function(instanceId){
    this["instance ID"] = instanceId;
}
function EventInstanceStart(instanceId){
    this.construct(instanceId);
}
EventInstanceStart.prototype = new InstanceIdEvent("INSTANCE_START");
EventInstanceStart.fromString = function(s){
    return parseSingleNumberEvent(this, s);
};
function EventInstanceExit(instanceId){
    this.construct(instanceId);
}
EventInstanceExit.prototype = new InstanceIdEvent("INSTANCE_EXIT");
EventInstanceExit.fromString = EventInstanceStart.fromString;

function EventBuiltins(names){
    this.names = names;
}
EventBuiltins.prototype = new UzblEvent("BUILTINS");
EventBuiltins.fromString = function(s){
    var q = suffix(s, this.prototype["type"] + " ");
    var unquoted = parseSingleQuotedString(q);
    if(null == unquoted) return new EventUnknown(["BUILTINS", q]);
    return new this(unquoted.split(" "));
};

function parseVariableSetInt(n){
    return ["int", +n];
}
function parseVariableSetString(q){
    var s = parseSingleQuotedString(q);
    if(null == s) return ["unknown", "str", q];
    return ["str", s];
}
function parseVariableSetType(t, val){
    if("int" == t) return parseVariableSetInt(val);
    if("str" == t) return parseVariableSetString(val);
    return ["unknown", t, val];
}
function EventVariableSet(name, valueType, value){
    this.name = name;
    this.value = parseVariableSetType(valueType, value);
}
EventVariableSet.prototype = new UzblEvent("VARIABLE_SET");
EventVariableSet.fromString = function(s){
    var tokens = suffix(s, this.prototype["type"] + " ").split(" ");
    var name = tokens.shift();
    var valueType = tokens.shift();
    var value = tokens.join(" ");
    return new this(name, valueType, value);
};


function stringIsIntegerp(s){
    var x = +s;
    return ""+x == ""+s;
}

//https://stackoverflow.com/questions/12467542/how-can-i-check-if-a-string-is-a-float/21664614#21664614
function isFloat(val) {
    var floatRegex = /^-?\d+(?:[.,]\d*?)?$/;
    if (!floatRegex.test(val))
        return false;

    val = parseFloat(val);
    if (isNaN(val))
        return false;
    return true;
}

function stringIsNumberp(s){
    if(stringIsIntegerp(s)) return true;
    if(isFloat(s)) return true;
    return false;
}

function parseNumbersEvent(Event, string){
    var numbersString = suffix(string, Event.prototype["type"] + " ");
    var numbers = numbersString.split(" ").map(
	function(s){
	    if(!stringIsNumberp(s)) return null;
	    return +s;
	}
    );
    if(numbers.filter(function(x){return x == null;}).length)
	return new EventUnknown(["numbers", Event, string]);
    return Event.fromNumbers(numbers);
}
function EventScrollHoriz(value, min, max, page){
    this.value = value;
    this.bounds = [min, max];
    this.page = page;
}
EventScrollHoriz.prototype = new UzblEvent("SCROLL_HORIZ");
EventScrollHoriz.fromNumbers = function(numbers){
    if(4 != numbers.length)
	return new EventUnknown([this.prototype["type"], numbers]);
    return new this(numbers[0], numbers[1], numbers[2], numbers[3]);
};
EventScrollHoriz.fromString = function(s){
    return parseNumbersEvent(this, s);
};
function EventScrollVert(value, min, max, page){
    this.value = value;
    this.bounds = [min, max];
    this.page = page;
}
EventScrollVert.prototype = new UzblEvent("SCROLL_VERT");
EventScrollVert.fromNumbers = EventScrollHoriz.fromNumbers;
EventScrollVert.fromString = EventScrollHoriz.fromString;

function parseUriEvent(Event, string){
    var q = suffix(string, Event.prototype["type"] + " ");
    var uri = parseSingleQuotedString(q);
    if(null == uri)
	return new EventUnknown(
	    [
		Event.prototype["type"],
		q
	    ]
	);
    return new Event(uri);
}
function EventLoadCommit(uri){
    this["type"] = "load";
    this.uri = uri;
}
EventLoadCommit.prototype = new UzblEvent("LOAD_COMMIT");
EventLoadCommit.prototype.loadType = "commit";
EventLoadCommit.fromString = function(s){
    return parseUriEvent(this, s);
}
function EventLoadStart(uri){
    this["type"] = "load";
    this.uri = uri;
}
EventLoadStart.prototype = new UzblEvent("LOAD_START");
EventLoadStart.prototype.loadType = "start";
EventLoadStart.fromString = EventLoadCommit.fromString;
function EventLoadProgress(amount){
    this["type"] = "load";
    this.amount = amount;
}
EventLoadProgress.prototype = new UzblEvent("LOAD_PROGRESS");
EventLoadProgress.prototype.loadType = "progress";
EventLoadProgress.fromString = function(s){
    var tokens = s.split(" ");
    var evtType = tokens.shift();
    if(1 != tokens.length) return new EventUnknown([evtType, tokens]);
    return new this(+(tokens[0]));
}
function EventLoadFinish(uri){
    this["type"] = "load";
    this.uri = uri;
}
EventLoadFinish.prototype = new UzblEvent("LOAD_FINISH");
EventLoadFinish.prototype.loadType = "finish";
EventLoadFinish.fromString = function(s){
    return parseUriEvent(this, s);
};
function EventLoadError(uri, number, message){
    this["type"] = "load";
    this.uri = uri;
    this.number = number;
    this.message = message;
}
EventLoadError.prototype = new UzblEvent("LOAD_ERROR");
EventLoadError.prototype.loadType = "error";
EventLoadError.fromString = function(s){
    var tokens = s.split(" ");
    if(tokens.shift() != this.prototype["type"])
	return new EventUnknown([s]);
    var q = tokens.shift();
    var uri = parseSingleQuotedStringWithoutSpaces(q);
    if(null == uri)
	return new EventUnknown([this.prototype["type"], q].concat(tokens));
    var n = tokens.shift();
    if(!(stringIsNumberp(n)))
	return new EventUnknown(
	    [this.prototype["type"], uri, n].concat(tokens)
	);
    q = tokens.join(" ");
    var message = parseSingleQuotedString(q);
    if(null == message)
	return new EventUnknown([this.prototype["type"], uri, +n, q]);
    return new this(uri, +n, message);
};

function EventGeometryChanged(size, offset){
    this.size = size;
    this.offset = offset;
}
EventGeometryChanged.prototype = new UzblEvent("GEOMETRY_CHANGED");
EventGeometryChanged.fromString = function(s){
    var q = suffix(s, this.prototype["type"] + " ");
    var geom = parseSingleQuotedString(q);
    if(null == geom) return new EventUnknown([this.prototype["type"], q]);
    var tokens = geom.split("+");
    var size = tokens.shift().split("x");
    return new this(size, tokens);
}

function EventRequestStarting(uri){
    this.uri = uri;
}
EventRequestStarting.prototype = new UzblEvent("REQUEST_STARTING");
EventRequestStarting.fromString = function(s){
    return parseUriEvent(this, s);
}

function EventCommandExecuted(commandType, command){
    this.commandType = commandType;
    this.command = command;
}
EventCommandExecuted.prototype = new UzblEvent("COMMAND_EXECUTED");
EventCommandExecuted.fromString = function(s){
    return new this(
	"unknown",
	suffix(
	    s,
	    this.prototype["type"] + " "
	)
    );
}

function EventTitleChanged(title){
    this.title = title;
}
EventTitleChanged.prototype = new UzblEvent("TITLE_CHANGED");
EventTitleChanged.fromString = function(s){
    var q = suffix(s, this.prototype["type"] + " ");
    var title = parseSingleQuotedString(q);
    if(null == title) return new EventUnknown([this.prototype["type"], q]);
    return new this(title);
}

function EventPtrMove(coords){
    this.coordinates = coords;
}
EventPtrMove.prototype = new UzblEvent("PTR_MOVE");
EventPtrMove.fromString = function(s){
    var tokens = s.split(" ");
    var evtType = tokens.shift();
    if(3 != tokens.length) return new EventUnknown([evtType, tokens]);
    return new this(tokens.map(function(x){return +x;}));
}

function EventRootActive(button){
    this.button = button;
}
EventRootActive.prototype = new UzblEvent("ROOT_ACTIVE");
EventRootActive.fromString = function(s){
    var button = suffix(s, this.prototype["type"] + " ");
    return new this(button);
};
function EventFormActive(button){
    this.button = button;
}
EventFormActive.prototype = new UzblEvent("FORM_ACTIVE");
EventFormActive.fromString = EventRootActive.fromString;

function EventLinkHover(uri){
    this.uri = uri;
}
EventLinkHover.prototype = new UzblEvent("LINK_HOVER");
EventLinkHover.fromString = function(s){
    return parseUriEvent(this, s);
};
function EventLinkUnhover(uri){
    this.uri = uri;
}
EventLinkUnhover.prototype = new UzblEvent("LINK_UNHOVER");
EventLinkUnhover.fromString = EventLinkHover.fromString;

function EventKeyPress(mod, key){
    this.modifiers = mod;
    this.key = key;
}
EventKeyPress.prototype = new UzblEvent("KEY_PRESS");
EventKeyPress.fromString = function(s){
    var tokens = s.split(" ");
    if(tokens.shift() != this.prototype["type"]) return new EventUnknown([s]);
    if(2 != tokens.length)
	return new EventUnknown([this.prototype["type"]].concat(tokens));
    var q = tokens.shift();
    var key = tokens.shift();
    var mod = parseSingleQuotedStringWithoutSpaces(q);
    if(mod == null) return new EventUnknown([this.prototype["type"], q, key]);
    return new this(mod, key);
};
function EventKeyRelease(mod, key){
    this.modifiers = mod;
    this.key = key;
}
EventKeyRelease.prototype = new UzblEvent("KEY_RELEASE");
EventKeyRelease.fromString = EventKeyPress.fromString;
function EventModPress(mod, key){
    this.modifiers = mod;
    this.key = key;
}
EventModPress.prototype = new UzblEvent("MOD_PRESS");
EventModPress.fromString = EventKeyPress.fromString;
function EventModRelease(mod, key){
    this.modifiers = mod;
    this.key = key;
}
EventModRelease.prototype = new UzblEvent("MOD_RELEASE");
EventModRelease.fromString = EventKeyPress.fromString;

function EventAddCookie(domain, path, name, value, scheme, expiration){
    this.domain = domain;
    this.path = path;
    this.name = name;
    this.value = value;
    this.scheme = scheme;
    this.expiration = expiration;
}
EventAddCookie.prototype = new UzblEvent("ADD_COOKIE");
EventAddCookie.fromString = function(s){
    var strings = parseSpaceSeparatedListOfSingleQuotedStrings(
	suffix(s, this.prototype["type"] + " ")
    );
    if(null == strings) return new EventUnknown([s]);
    if(6 != strings.length)
	return new EventUnknown([this.prototype["type"]].concat(strings));
    var domain = strings.shift();
    var path = strings.shift();
    var name = strings.shift();
    var value = strings.shift();
    var scheme = strings.shift();
    var expiration = strings.shift();
    return new this(domain, path, name, value, scheme, expiration);
};

function EventDeleteCookie(domain, path, name, value, scheme, expiration){
    this.domain = domain;
    this.path = path;
    this.name = name;
    this.value = value;
    this.scheme = scheme;
    this.expiration = expiration;
}
EventDeleteCookie.prototype = new UzblEvent("DELETE_COOKIE");
EventDeleteCookie.fromString = EventAddCookie.fromString;

function EventNewWindow(uri){
    this.uri = uri;
}
EventNewWindow.prototype = new UzblEvent("NEW_WINDOW");
EventNewWindow.fromString = function(s){
    return parseUriEvent(this, s);
};

function FocusEvent(status){
    this.status = status;
}
FocusEvent.prototype = new UzblEvent("focus");

function parseEvent(rest){
    var glossary_alist = [
	EventInstanceStart,
	EventInstanceExit,
	EventBuiltins,
	EventVariableSet,
	EventScrollHoriz,
	EventScrollVert,
	EventLoadCommit,
	EventLoadStart,
	EventLoadProgress,
	EventLoadFinish,
	EventLoadError,
	EventGeometryChanged,
	EventRequestStarting,
	EventCommandExecuted,
	EventTitleChanged,
	EventPtrMove,
	EventRootActive,
	EventFormActive,
	EventLinkHover,
	EventLinkUnhover,
	EventKeyPress,
	EventKeyRelease,
	EventModPress,
	EventModRelease,
	EventAddCookie
	, EventDeleteCookie
	, EventNewWindow
    ];
    var matches = glossary_alist.filter(
	function(cls){
	    return testPrefix(rest, cls.prototype["type"] + " ");
	}
    );
    if(matches.length) return matches[0].fromString(rest);

    var focusGained = new FocusEvent("gained");
    var focusLost = new FocusEvent("lost");
    var exact_matches = {
	FOCUS_GAINED: focusGained,
	FOCUS_LOST: focusLost
    };
    if(rest in exact_matches) return exact_matches[rest];

    return new EventUnknown(rest);
}

function UzblEventLine(instanceId, event, sourceText){
    this.setTime();
    this["instance ID"] = instanceId;
    this["event type"] = event["type"];
    this.event = event;
    this.source = sourceText;
}
UzblEventLine.prototype = new UzblOutputLine("event");
UzblEventLine.parseFromLine = function(eventLineTail, entireLine){
    var bracketsLength = eventLineTail.indexOf(" ");
    if(-1 == bracketsLength)
	return new UzblErrorLine("ERROR " + eventLineTail, entireLine);
    var withBrackets = eventLineTail.substring(0, bracketsLength);
    eventLineTail = suffix(eventLineTail, withBrackets + " ");
    var instanceIdString = withBrackets.substring(1, withBrackets.length - 1);
    var event = parseEvent(eventLineTail);
    return new this(+instanceIdString, event, entireLine);
};

function UzblOutputTextLine(line){
    this.setTime();
    this.line = line;
}
UzblOutputTextLine.prototype = new UzblOutputLine("line");
UzblOutputTextLine.parse = function(line){
    if(testPrefix(line, "EVENT "))
	return UzblEventLine.parseFromLine(suffix(line, "EVENT "), line);
    return new this(line);
};


function Uzbl(){
    this.process = this.createProcess();
    this.events = [];
    this.variables = {};
    this.process.on("exit", this.onProcessExit.bind(this));
    this.pages = [[]];
}
Uzbl.prototype.createProcess = function(){
    return child_process.spawn("uzbl-core", ["-c", "-", "-p"]);
};
Uzbl.prototype.writeln = function(line, callback){
    return this.process.stdin.write(line + "\n", callback);
};
Uzbl.prototype.setVariable = function(key, value, callback){
    return this.writeln("set " + key + " = " + value, callback);
};
Uzbl.prototype.setEnableScripts = function(on, callback){
    return this.setVariable("enable_scripts", on ? "1" : "0", callback);
};
Uzbl.prototype.setEnablePlugins = function(on, callback){
    return this.setVariable("enable_plugins", on ? "1" : "0", callback);
};
Uzbl.prototype.setEnableJavaApplet = function(on, callback){
    return this.setVariable("enable_java_applet", on ? "1" : "0", callback);
};
Uzbl.prototype.setForwardKeys = function(on, callback){
    return this.setVariable("forward_keys", on ? "1" : "0", callback);
};
Uzbl.prototype.disableScripts = function(callback){
    return this.setEnableScripts(false, callback);
};
Uzbl.prototype.enableScripts = function(callback){
    return this.setEnableScripts(true, callback);
};
Uzbl.prototype.visit = function(uri, callback){
    return this.writeln("uri " + uri, callback);
};
Uzbl.prototype.collectLines = function(lineBack){
    return collectLines(this.process.stdout, lineBack);
};
Uzbl.prototype.collectErrorLines = function(lineBack){
    return collectLines(this.process.stderr, lineBack);
};
Uzbl.prototype.collectParsedLines = function(parsedBack){
    var that = this;
    return this.collectLines(
	function(line, cmd){
	    if("end" == cmd)
		parsedBack(
		    {
			timestamp: new Date(),
			"type": "end",
			//process: that.process,
			events: that.events,
			variables: that.variables,
			"instance ID": that["instance ID"],
			uri: that.uri,
			done: that.done
		    }
		);
	    return parsedBack(UzblOutputTextLine.parse(line));
	}
    );
};
Uzbl.prototype.handleInstanceStart = function(instanceId){
    if("instance ID" in this) return;
    this["instance ID"] = instanceId;
};
Uzbl.prototype.markDone = function(done){
    if("done" in this){
	if(!done) return;
	if("exit" == done) return;
    }
    this.done = done;
};
Uzbl.prototype.onProcessExit = function(code, signal){
    if("done" in this) return;
    return this.markDone([new Date(), "exit", code, signal]);
};
Uzbl.prototype.handleInstanceExitEvent = function(event){
    var iidKey = "instance ID";
    if(!(iidKey in this)) return;
    var o = event.event;
    if(this[iidKey] != o[iidKey]) return;
    this.markDone(event);
};
Uzbl.prototype.handleVariableSetEvent = function(event){
    var o = event.event;
    var name = o.name;
    var valuePair = o.value;
    var valueType = valuePair[0];
    if("unknown" == valueType) return;
    this.variables[name] = valuePair;
};
Uzbl.prototype.handleLoadCommitEvent = function(event){
    this.uri = event.event.uri;
};
Uzbl.prototype.newPage = function(event){
    this.pages.push([event]);
};
Uzbl.prototype.handleLoadEvent = function(event){
    if("commit" == event.event.loadType)
	return this.handleLoadCommitEvent(event);
    if("start" == event.event.loadType)
	return this.newPage(event);
};
Uzbl.prototype.handleEvent = function(eventType, eventLine){
    eventLine["event ID"] = this.events.length;
    this.events.push(eventLine);
    this.pages[this.pages.length - 1].push(eventLine);
    if("INSTANCE_EXIT" == eventType)
	return this.handleInstanceExitEvent(eventLine);
    if("VARIABLE_SET" == eventType)
	return this.handleVariableSetEvent(eventLine);
    if("load" == eventType)
	return this.handleLoadEvent(eventLine);
};
Uzbl.prototype.handleInstanceStartEvent = function(o, instanceId){
    if(!(o instanceof EventInstanceStart)) return;
    if(instanceId != o["instance ID"]) return;
    return this.handleInstanceStart(instanceId);
};
Uzbl.prototype.handleLine = function(lineObject){
    var lineType = lineObject["type"];
    if("event" == lineType){
	var ob = lineObject.event;
	var iidKey = "instance ID";
	var instanceId = lineObject[iidKey];
	var eventType = ob["type"];
	if("INSTANCE_START" == eventType)
	    this.handleInstanceStartEvent(
		lineObject.event,
		lineObject[iidKey]
	    );
	if(iidKey in this)
	    if(this[iidKey] == instanceId)
		return this.handleEvent(eventType, lineObject);
    }
    return handleLine(lineObject);
};
Uzbl.prototype.processEvents = function(){
    return this.collectParsedLines(this.handleLine.bind(this));
};
Uzbl.prototype.respondEvent = function(url, response){
    var i = +url;
    if(i > this.events.length)
	return respondNotFound(response);
    response.setHeader("Content-Type", "application/json");
    response.end(JSON.stringify(this.events[i], null, "\t"));
};
Uzbl.prototype.respondEvents = function(response){
    response.setHeader("Content-Type", "text/html");
    var crlf = "\r\n";
    var instanceId = null;
    if("instance ID" in this)
	instanceId = this["instance ID"];
    var title = "events from instance " + (instanceId ? instanceId : "unknown");
    response.end(
	[
	    "<html>",
	    "\t<head>",
	    "\t\t<title>" + title + "</title>",
	    "\t</head>",
	    "\t<body>",
	    "\t\t<h1>" + (instanceId ? (instanceId + " ") : "") + "events</h1>",
	    "\t\t<ol start=\"0\">",
	    this.events.map(
		function(event, i){
		    var o = event.event;
		    var stamp = event.timestamp;
		    var me = event["instance ID"];
		    var evType = o["type"];
		    var url = "./" + i;
		    var iframe = "<iframe src=\"" + url + "\"></iframe>";
		    var br = "<br />";
		    var anchor = "<a href=\"" + url + "\">" + evType + "</a>";
		    return [
			"<li>",
			"\t" + evType + "@" + stamp,
			"\t" + br,
			"\t" + ("unknown" == evType ? iframe : anchor),
			"</li>"
		    ].map(
			function(line){
			    return "\t\t\t" + line;
			}
		    ).join(crlf);
		}
	    ).join(crlf),
	    "\t\t</ol>",
	    "\t</body>",
	    "</html>",
	    ""
	].join(crlf)
    );
};
Uzbl.prototype.tinfoilHat = function(callback){
    var that = this;
    return this.disableScripts(
	function(){
	    return that.setEnablePlugins(
		false,
		function(){
		    return that.setEnableJavaApplet(
			false,
			function(){
			    return that.writeln(
				"clear_cookies all",
				callback
			    );
			}
		    );
		}
	    );
	}
    );
};
Uzbl.prototype.setIcon = function(iconPath, callback){
    return this.setVariable("icon", iconPath, callback);
};
Uzbl.prototype.iconGopo = function(callback){
    return this.setIcon("./chibigopovectors.svg", callback);
};
Uzbl.prototype.respondPageJson = function(response, pageNumber){
    if(this.pages.length <= pageNumber)
	return respondNotFound(response);
    if(pageNumber < 0)
	return respondNotFound(response);
    if(null == pageNumber)
	return respondNotFound(response);
    var page = this.pages[pageNumber];
    response.setHeader("Content-Type", "application/json");
    response.end(JSON.stringify(page, null, "\t"));
};


exports.lines = lines;
exports.Uzbl = Uzbl;
