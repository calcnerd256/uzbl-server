function evalFromBox(){
    var evalBox = $("#evalBox")[0];
    var src = evalBox.value;
    return eval(src);
}
function setupEvalBox(){
    return $("#evalButton").click(
	evalFromBox
    );
}

function promiseHttpGet(url, data, dataType){
    return new Promise(
	function(res, rej){
	    return $.get(
		url,
		data,
		res,
		dataType
	    ).fail(rej);
	}
    );
}

function echo(line){
    var out = $("#debugOutput");
    out.text(
	out.text() + "\n" + line
    );
    return line;
}
function clearOut(){
    $("#debugOutput").text("");
}

function echoPromise(p){
    return p.then(echo);
}
function echoGet(url){
    return echoPromise(
	promiseHttpGet(
	    url,
	    null,
	    "text"
	)
    );
}
function echoEvent(n){
    return echoGet(
	"/browser/events/" + +n
    );
}

function getEvent(n){
    return promiseHttpGet(
	"/browser/events/" + +n,
	null,
	"text"
    ).then(
	function(s){
	    if("" == s)
		return Promise.reject();
	    return s;
	}
    ).then(JSON.parse).then(
	function(event){
	    event["event ID"] = n;
	    return event;
	}
    );
}

var nextEventId = 0;
var browserEvents = [];
function I(x){
    return x;
}
function K(x){
    return function(){
	return x;
    };
}
function echoJson(ob){
    echo(
	JSON.stringify(
	    ob,
	    null,
	    "\t"
	)
    );
    return ob;
}
function promiseDelay(milliseconds){
    return new Promise(
	function(res, rej){
	    setTimeout(res, milliseconds);
	}
    );
}
function asyncDelay(milliseconds){
    return function(){
	return promiseDelay(milliseconds);
    };
}
function pluck(key){
    return function(object){
	return object[key];
    };
}
function bindFrom(object, method){
    return object[method].bind(object);
}

function ToggleUl(){
}
ToggleUl.prototype.makeDom = function(){
    this.dom = document.createElement("span");
    this.anchor = document.createElement("a");
    this.anchor.href = "#";
    var that = this;
    $(this.anchor).text("show/hide").click(
	function(){
	    // late binding
	    that.toggleVisibility();
	    return false;
	}
    );
    this.dom.appendChild(this.anchor);
    this.ul = document.createElement("ul");
    this.dom.appendChild(this.ul);
    $(this.ul).hide();
    return this.dom;
};
ToggleUl.prototype.ensureDom = function(){
    if("dom" in this) return this.dom;
    return this.makeDom();
};
ToggleUl.prototype.toggleVisibility = function(){
    this.ensureDom();
    $(this.ul).toggle("slow");
};

var Uzbl = (
    function(){
	function Uzbl(){
	}
	Uzbl.prototype.toJSON = function(){
	    var keys = Object.keys(this);
	    var result = {};
	    var that = this;
	    keys.map(
		function(k){
		    var val = that[k];
		    result[k] = val;
		    if("object" == typeof val)
			if("browser" in val)
			    if(val.browser == that){
				var keys = Object.keys(val);
				var v = {};
				keys.map(function(k){v[k] = val[k]});
				delete v.browser;
			    }
		    try{
			result[k] = JSON.parse(
			    JSON.stringify(
				v
			    )
			);
		    }
		    catch(e){
			delete result[k];
		    }
		}
	    );
	    return result;
	};
	Uzbl.prototype.makeDom = function(){
	    this.dom = document.createElement("div");
	    $("#evalBox").before(this.dom);
	    return this.dom;
	};
	Uzbl.prototype.ensureDom = function(){
	    if(!("dom" in this)) return this.makeDom();
	    return this.dom;
	};
	Uzbl.prototype.appendChild = function(elem){
	    return this.ensureDom().appendChild(elem);
	};

	Uzbl.prototype.EventList = function(){
	    this.events = [];
	};
	Uzbl.prototype.EventList.prototype.makeDom = function(){
	    this.dom = document.createElement("span");
	    this.summary = document.createElement("span");
	    $(this.summary).text("events");
	    this.dom.appendChild(this.summary);
	    this.dom.appendChild(document.createTextNode(": "));
	    this.ul = new ToggleUl();
	    this.ul.toggleVisibility = bindFrom(this, "toggle");
	    this.dom.appendChild(this.ul.ensureDom());
	    return this.dom;
	};
	Uzbl.prototype.EventList.prototype.ensureDom = function(){
	    if("dom" in this) return this.dom;
	    return this.makeDom();
	};
	Uzbl.prototype.EventList.prototype.makeLiNumber = function(n){
	    var li = document.createElement("li");
	    var anchor = document.createElement("a");
	    var pre = document.createElement("pre");
	    anchor.href = "/browser/events/" + (+n);
	    $(anchor).text(n);
	    li.appendChild(anchor);
	    $(anchor).click(
		function(){
		    getEvent(n).then(
			function(e){
			    return $(pre).text(
				JSON.stringify(
				    e,
				    null,
				    "\t"
				)
			    );
			}
		    );
		    return false;
		}
	    );
	    li.appendChild(pre);
	    return [li, pre];
	};
	Uzbl.prototype.EventList.prototype.makeLi = function(event){
	    var lp = this.makeLiNumber(event["event ID"]);
	    $(lp[1]).text(event["event type"]);
	    return lp[0];
	};
	Uzbl.prototype.EventList.prototype.appendEvent = function(event){
	    this.events.push(event["event ID"]);
	    this.ensureDom();
	    this.ul.ensureDom();
	    var li = this.makeLi(event);
	    this.ul.ul.appendChild(li);
	    var len = this.events.length;
	    $(this.summary).text(len + " event" + (1 == len ? "" : "s"));
	    return li;
	};
	Uzbl.prototype.EventList.prototype.hide = function(){
	    this.ensureDom();
	    var ul = this.ul;
	    $(ul.ul).hide("slow", function(){return $(ul.ul).html("");});
	    $(ul.anchor).text("show");
	};
	Uzbl.prototype.EventList.prototype.populateUl = function(){
	    this.ensureDom();
	    return $(this.ul.ul).html(
		this.events.map(
		    bindFrom(this, "makeLiNumber")
		).map(pluck(0))
	    );
	};
	Uzbl.prototype.EventList.prototype.show = function(){
	    this.populateUl();
	    $(this.ul.ul).show("slow");
	    $(this.ul.anchor).text("hide");
	};
	Uzbl.prototype.EventList.prototype.toggle = function(){
	    this.visible = !(this.visible);
	    return this[this.visible ? "show" : "hide"]();
	};
	Uzbl.prototype.EventList.prototype.visible = false;

	Uzbl.prototype.OtherEvents = function(browser){
	    this.browser = browser;
	};
	Uzbl.prototype.OtherEvents.prototype.toJSON = function(){
	    var keys = Object.keys(this);
	    var result = {};
	    var that = this;
	    keys.map(function(k){result[k] = that[k];})
	    var browserKeys = []
	    if("browser" in this)
		browserKeys = Object.keys(this.browser);
	    var browser = {};
	    browserKeys.map(function(k){browser[k] = that.browser[k];});
	    delete browser.otherEvents;
	    if("browser" in result)
		result.browser = browser;
	    return result;
	};
	Uzbl.prototype.OtherEvents.prototype.makeDom = function(){
	    this.events = new (this.browser.EventList)();
	    this.dom = this.events.ensureDom();
	    this.ul = this.events.ul;
	    this.browser.appendChild(this.dom);
	    return this.dom;
	};
	Uzbl.prototype.OtherEvents.prototype.ensureDom = function(){
	    if("dom" in this) return this.dom;
	    return this.makeDom();
	};
	Uzbl.prototype.OtherEvents.prototype.displayEvent = function(e){
	    this.ensureDom();
	    return this.events.appendEvent(e);
	};
	Uzbl.prototype.makeOtherEvents = function(){
	    this.otherEvents = new (this.OtherEvents)(this);
	    return this.otherEvents;
	};
	Uzbl.prototype.ensureOtherEvents = function(){
	    if("otherEvents" in this) return this.otherEvents;
	    return this.makeOtherEvents();
	};
	Uzbl.prototype.displayEvent = function(e){
	    return this.ensureOtherEvents().displayEvent(e);
	};

	Uzbl.prototype["Instance ID"] = function(browser){
	    this.browser = browser;
	    this.events = [];
	};
	Uzbl.prototype["Instance ID"].prototype.toJSON = function(){
	    var keys = Object.keys(this);
	    var result = {};
	    var that = this;
	    keys.map(function(k){result[k] = that[k];})
	    var browserKeys = []
	    if("browser" in this)
		browserKeys = Object.keys(this.browser);
	    var browser = {};
	    browserKeys.map(function(k){browser[k] = that.browser[k];});
	    delete browser["instance ID"];
	    if("browser" in result)
		result.browser = browser;
	    return result;
	};
	Uzbl.prototype["Instance ID"].prototype.makeDom = function(){
	    this.dom = document.createElement("span");
	    var div = document.createElement("div");
	    div.appendChild(this.dom);
	    this.events = new (this.browser.EventList)();
	    div.appendChild(document.createTextNode(" ("));
	    div.appendChild(this.events.ensureDom());
	    div.appendChild(document.createTextNode(")"));
	    this.browser.appendChild(div);
	    $(this.dom).text("unknown instance");
	    return this.dom;
	};
	Uzbl.prototype["Instance ID"].prototype.ensureDom = function(){
	    if("dom" in this) return this.dom;
	    return this.makeDom();
	};
	Uzbl.prototype["Instance ID"].prototype.assignValue = function(value){
	    this.value = value;
	    $(this.ensureDom()).text("instance " + value);
	};
	Uzbl.prototype["Instance ID"].prototype.handleInstanceStartEvent = function(e){
	    this.ensureDom();
	    this.events.appendEvent(e);
	    return this.assignValue(e.event["instance ID"]);
	};
	Uzbl.prototype["Instance ID"].prototype.handleEvent = function(e){
	    this.events.push(e);
	    if("INSTANCE_START" == e["event type"])
		return this.handleInstanceStartEvent(e);
	};
	Uzbl.prototype.makeInstanceId = function(){
	    var result = new (this["Instance ID"])(this);
	    this["instance ID"] = result;
	    return result;
	};
	Uzbl.prototype.ensureInstanceId = function(){
	    if("instance ID" in this) return this["instance ID"];
	    return this.makeInstanceId();
	};

	Uzbl.prototype.Builtins = function(browser){
	    this.browser = browser;
	};
	Uzbl.prototype.Builtins.prototype.makeDom = function(){
	    this.dom = document.createElement("div");
	    $(this.dom).text("builtins: ");
	    var ul = new ToggleUl();
	    this.dom.appendChild(ul.ensureDom());
	    this.ul = ul.ul;
	    this.events = new (this.browser.EventList)();
	    this.dom.appendChild(document.createTextNode(" ("));
	    this.dom.appendChild(this.events.ensureDom());
	    this.dom.appendChild(document.createTextNode(")"));
	    this.browser.appendChild(this.dom);
	    return this.dom;
	};
	Uzbl.prototype.Builtins.prototype.ensureDom = function(){
	    if("dom" in this) return this.dom;
	    return this.makeDom();
	};
	Uzbl.prototype.Builtins.prototype.ensureUl = function(){
	    this.ensureDom();
	    return this.ul;
	};
	Uzbl.prototype.Builtins.prototype.makeLi = function(name){
	    var li = document.createElement("li");
	    $(li).text(name);
	    return li;
	};
	Uzbl.prototype.Builtins.prototype.assignValue = function(builtins){
	    this.value = builtins;
	    $(this.ensureUl()).html(
		builtins.map(bindFrom(this, "makeLi"))
	    );
	    return this.value;
	};
	Uzbl.prototype.Builtins.prototype.handleBuiltinsEvent = function(e){
	    return this.assignValue(e.event.names);
	};
	Uzbl.prototype.Builtins.prototype.handleEvent = function(e){
	    this.ensureDom();
	    this.events.appendEvent(e);
	    if("BUILTINS" == e["event type"])
		return this.handleBuiltinsEvent(e);
	};
	Uzbl.prototype.makeBuiltins = function(){
	    return this.builtins = new (this.Builtins)(this);
	};
	Uzbl.prototype.ensureBuiltins = function(){
	    if("builtins" in this) return this.builtins;
	    return this.makeBuiltins();
	};

	Uzbl.prototype.Variables = function(browser){
	    this.browser = browser;
	    this.variables = {};
	};
	Uzbl.prototype.Variables.prototype.makeDom = function(){
	    this.dom = document.createElement("div");
	    $(this.dom).text("variables: ");
	    this.ul = new ToggleUl();
	    this.dom.appendChild(this.ul.ensureDom());
	    this.events = new (this.browser.EventList)();
	    this.dom.appendChild(document.createTextNode(" ("));
	    this.dom.appendChild(this.events.ensureDom());
	    this.dom.appendChild(document.createTextNode(")"));
	    this.browser.appendChild(this.dom);
	    return this.dom;
	};
	Uzbl.prototype.Variables.prototype.ensureDom = function(){
	    if("dom" in this) return this.dom;
	    return this.makeDom();
	};
	Uzbl.prototype.Variables.prototype.makeVariable = function(name){
	    this.ensureDom();
	    var li = document.createElement("li");
	    var result = {
		li: li,
		name: document.createElement("span"),
		valueType: document.createElement("span"),
		pre: document.createElement("pre"),
		events: new (this.browser.EventList)()
	    };
	    this.variables[name] = result;
	    $(result.name).text(name);
	    li.appendChild(result.name);
	    li.appendChild(document.createTextNode(" : "));
	    li.appendChild(result.valueType);
	    $(result.valueType).text("unknown");
	    li.appendChild(result.pre);
	    li.appendChild(document.createTextNode(" ("));
	    li.appendChild(result.events.ensureDom());
	    li.appendChild(document.createTextNode(")"));
	    this.ul.ul.appendChild(li);
	    return result;
	};
	Uzbl.prototype.Variables.prototype.ensureVariable = function(name){
	    if(name in this.variables) return this.variables[name];
	    return this.makeVariable(name);
	};
	Uzbl.prototype.Variables.prototype.setVariable = function(name, varType, value){
	    var v = this.ensureVariable(name);
	    v.value = [varType, value];
	    $(v.name).text(name);
	    $(v.valueType).text(varType);
	    $(v.pre).text("");
	    v.pre.appendChild(document.createTextNode(""+value));
	};
	Uzbl.prototype.Variables.prototype.handleVariableSetEvent = function(event){
	    var evt = event.event;
	    var name = evt.name;
	    var val = evt.value;
	    var valueType = val[0];
	    var value = val[1];
	    this.ensureVariable(name).events.appendEvent(event);
	    return this.setVariable(name, valueType, value);
	};
	Uzbl.prototype.Variables.prototype.handleEvent = function(event){
	    this.ensureDom();
	    this.events.appendEvent(event);
	    if("VARIABLE_SET" == event["event type"])
		return this.handleVariableSetEvent(event);
	};
	Uzbl.prototype.makeVariables = function(){
	    return this.variables = new (this.Variables)(this);
	};
	Uzbl.prototype.ensureVariables = function(){
	    if("variables" in this) return this.variables;
	    return this.makeVariables();
	};

	Uzbl.prototype.Geometry = function(browser){
	    this.browser = browser;
	    this.knownViewport = [1, 1];
	};
	Uzbl.prototype.Geometry.prototype.makeDom = function(){
	    this.dom = document.createElement("div");
	    $(this.dom).text("geometry: ");
	    this.text = document.createElement("span");
	    this.dom.appendChild(this.text);
	    this.canv = document.createElement("canvas");
	    this.canv.width = 64;
	    this.canv.height = 64;
	    this.canv.appendChild(document.createTextNode("[broken widget]"));
	    this.dom.appendChild(this.canv);
	    this.events = new (this.browser.EventList)();
	    this.dom.appendChild(document.createTextNode(" ("));
	    this.dom.appendChild(this.events.ensureDom());
	    this.dom.appendChild(document.createTextNode(")"));
	    this.browser.appendChild(this.dom);
	    return this.dom;
	};
	Uzbl.prototype.Geometry.prototype.ensureDom = function(){
	    if("dom" in this) return this.dom;
	    return this.makeDom();
	};
	Uzbl.prototype.Geometry.prototype.assignValue = function(size, offset){
	    this.size = size;
	    this.offset = offset;
	    var right = +(size[0]) + (+(offset[0]));
	    var bottom = +(size[1]) + (+(offset[1]));
	    if(right > this.knownViewport[0])
		this.knownViewport[0] = right;
	    if(bottom > this.knownViewport[1])
		this.knownViewport[1] = bottom;
	    var smallDimension = Math.min.apply(Math, this.knownViewport);
	    var ratio = 64 / smallDimension;
	    this.ensureDom();
	    this.canv.width = Math.ceil(ratio * this.knownViewport[0]);
	    this.canv.height = Math.ceil(ratio * this.knownViewport[1]);
	    $(this.text).text([size.join("x")].concat(offset).join("+"));
	    var ctx = this.canv.getContext("2d");
	    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
	    ctx.strokeRect.apply(
		ctx,
		offset.concat(size).map(
		    function(dim){
			return dim * ratio;
		    }
		)
	    );
	};
	Uzbl.prototype.Geometry.prototype.handleGeometryChangedEvent = function(event){
	    this.ensureDom();
	    this.events.appendEvent(event);
	    this.assignValue(event.event.size, event.event.offset);
	};
	Uzbl.prototype.Geometry.prototype.handleEvent = function(event){
	    if("GEOMETRY_CHANGED" == event["event type"])
		return this.handleGeometryChangedEvent(event);
	};
	Uzbl.prototype.makeGeometry = function(){
	    return this.geometry = new (this.Geometry)(this);
	}
	Uzbl.prototype.ensureGeometry = function(){
	    if("geometry" in this) return this.geometry;
	    return this.makeGeometry();
	};

	Uzbl.prototype.Cookies = function(browser){
	    this.browser = browser;
	    this.cookies = {};
	};
	Uzbl.prototype.Cookies.prototype.makeDom = function(){
	    this.dom = document.createElement("div");
	    $(this.dom).text("cookie jar: ");
	    this.ul = new ToggleUl();
	    this.dom.appendChild(this.ul.ensureDom());
	    this.events = new (this.browser.EventList)();
	    this.dom.appendChild(document.createTextNode(" ("));
	    this.dom.appendChild(this.events.ensureDom());
	    this.dom.appendChild(document.createTextNode(")"));
	    this.browser.appendChild(this.dom);
	    return this.dom;
	};
	Uzbl.prototype.Cookies.prototype.ensureDom = function(){
	    if("dom" in this) return this.dom;
	    return this.makeDom();
	};
	Uzbl.prototype.Cookies.prototype.handleAddCookieEvent = function(event){
	    // TODO
	}
	Uzbl.prototype.Cookies.prototype.handleEvent = function(event){
	    this.ensureDom();
	    this.events.appendEvent(event);
	    if("ADD_COOKIE" == event["event type"])
		return this.handleAddCookieEvent()
	};
	Uzbl.prototype.makeCookies = function(){
	    return this.cookies = new (this.Cookies)(this);
	};
	Uzbl.prototype.ensureCookies = function(){
	    if("cookies" in this) return this.cookies;
	    return this.makeCookies();
	};

	Uzbl.prototype.Pages = function(browser){
	    this.browser = browser;
	    this.newPage();
	};
	Uzbl.prototype.Pages.prototype.makeDom = function(){
	    this.dom = document.createElement("div");
	    $(this.dom).text("pages: ");
	    this.ul = new ToggleUl();
	    this.dom.appendChild(this.ul.ensureDom());
	    this.browser.appendChild(this.dom);
	    return this.dom;
	};
	Uzbl.prototype.Pages.prototype.ensureDom = function(){
	    if("dom" in this) return this.dom;
	    return this.makeDom();
	};
	Uzbl.prototype.Pages.prototype.newPage = function(){
	    var vars = this.browser.ensureVariables().variables;
	    var keys = Object.keys(vars);
	    var variables = {};
	    keys.map(
		function(k){
		    variables[k] = vars[k].value;
		}
	    );
	    var geom = this.browser.ensureGeometry();
	    this.ensureDom();
	    var geometry = {};
	    if("size" in geom) geometry.size = geom.size.map(I);
	    if("offset" in geom) geometry.offset = geom.offset.map(I);
	    this.currentPage = {
		dom: document.createElement("li"),
		events: new (this.browser.EventList)(),
		variables: variables,
		geometry: geometry
	    };
	    this.currentPage.dom.appendChild(this.currentPage.events.ensureDom());
	    this.ul.ul.appendChild(this.currentPage.dom);
	    return this.currentPage;
	};
	Uzbl.prototype.Pages.prototype.handleScrollHorizEvent = function(event){
	    var evt = event.event;
	    this.currentPage.scrollHoriz = {
		"bounds": evt.bounds,
		"viewport size": evt.page,
		"scrollbar": evt.value
	    };
	    return this.currentPage.scrollHoriz;
	};
	Uzbl.prototype.Pages.prototype.handleScrollVertEvent = function(event){
	    var evt = event.event;
	    this.currentPage.scrollVert = {
		"bounds": evt.bounds,
		"viewport size": evt.page,
		"scrollbar": evt.value
	    };
	    return this.currentPage.scrollVert;
	};
	Uzbl.prototype.Pages.prototype.handleEvent = function(event){
	    if("load" == event["event type"])
		if("start" == event.event.loadType)
		    this.newPage();
	    this.currentPage.events.appendEvent(event);
	    if("SCROLL_HORIZ" == event["event type"])
		return this.handleScrollHorizEvent(event);
	    if("SCROLL_VERT" == event["event type"])
		return this.handleScrollVertEvent(event);
	};
	Uzbl.prototype.makePages = function(){
	    return this.pages = new (this.Pages)(this);
	};
	Uzbl.prototype.ensurePages = function(){
	    if("pages" in this) return this.pages;
	    return this.makePages();
	};

	Uzbl.prototype.handleInstanceStartEvent = function(e){
	    return this.ensureInstanceId().handleEvent(e);
	};
	Uzbl.prototype.handleBuiltinsEvent = function(e){
	    return this.ensureBuiltins().handleEvent(e);
	};
	Uzbl.prototype.forwardEventToPages = function(event){
	    return this.ensurePages().handleEvent(event);
	};
	Uzbl.prototype.handleVariableSetEvent = function(event){
	    var vars = this.ensureVariables();
	    vars.ensureDom();
	    this.forwardEventToPages(event);
	    return vars.handleEvent(event);
	};
	Uzbl.prototype.handleScrollHorizEvent = function(event){
	    // TODO
	    return this.forwardEventToPages(event);
	};
	Uzbl.prototype.handleScrollVertEvent = function(event){
	    // TODO
	    return this.forwardEventToPages(event);
	};
	Uzbl.prototype.handleGeometryChangedEvent = function(event){
	    this.forwardEventToPages(event);
	    return this.ensureGeometry().handleEvent(event);
	};
	Uzbl.prototype.forwardEventToCookies = function(event){
	    this.forwardEventToPages(event);
	    return this.ensureCookies().handleEvent(event);
	};
	Uzbl.prototype.handleEvent = function(e){
	    var methods = {
		INSTANCE_START: "handleInstanceStartEvent",
		BUILTINS: "handleBuiltinsEvent",
		VARIABLE_SET: "handleVariableSetEvent",
		SCROLL_HORIZ: "handleScrollHorizEvent",
		SCROLL_VERT: "handleScrollVertEvent",
		GEOMETRY_CHANGED: "handleGeometryChangedEvent",
		ADD_COOKIE: "forwardEventToCookies",
		COMMAND_EXECUTED: "forwardEventToPages",
		load: "forwardEventToPages",
		REQUEST_STARTING: "forwardEventToPages",
		focus: "forwardEventToPages",
		TITLE_CHANGED: "forwardEventToPages",
		PTR_MOVE: "forwardEventToPages",
		ROOT_ACTIVE: "forwardEventToPages",
		KEY_PRESS: "forwardEventToPages",
		KEY_RELEASE: "forwardEventToPages",
		MOD_PRESS: "forwardEventToPages",
		MOD_RELEASE: "forwardEventToPages",
		LINK_HOVER: "forwardEventToPages",
		LINK_UNHOVER: "forwardEventToPages",
		FORM_ACTIVE: "forwardEventToPages"
	    }
	    var et = e["event type"];
	    var method = "displayEvent";
	    if(et in methods)
		method = methods[et];
	    var that = this;
	    return Promise.resolve().then(
		function(){
		    return that[method](e);
		}
	    ).then(
		I,
		bindFrom(console, "error")
	    ).then(
		function(x){
		    return promiseDelay(1).then(K(x));
		}
	    );
	};


	Uzbl.prototype.handleNextEvent = function(){
	    if("currentEvent" in this) return Promise.reject(this.keepGoing = true);
	    this.currentEvent = nextEventId;
	    var that = this;
	    return getEvent(nextEventId).then(
		bindFrom(this, "handleEvent")
	    ).then(
		function(x){
		    nextEventId++;
		    delete that.currentEvent;
		    var keepGoing = that.keepGoing;
		    that.keepGoing = false;
		    return keepGoing;
		}
	    ).then(
		function(again){
		    if(again) return that.handleNextEvent();
		}
	    ).catch(
		function(e){
		    delete that.currentEvent;
		    that.keepGoing = false;
		    return Promise.reject(e);
		}
	    );
	};
	Uzbl.prototype.checkEventsForever = function(idleDelayMilliseconds, whiffs){
	    return this.handleNextEvent().then(
		function(){
		    whiffs = 1;
		},
		function(){
		    return promiseDelay(
			idleDelayMilliseconds * (
			    1 + Math.floor(
				Math.log1p(
				    whiffs++
				)
			    )
			)
		    )
		}
	    ).then(K()).then(
		this.checkEventsForever.bind(this, idleDelayMilliseconds, whiffs)
	    );
	};

	return Uzbl;
    }
)();


var browser = new Uzbl();

function browserLive(){
    return browser.checkEventsForever(100, 1);
}


$(
    function(){
	setupEvalBox();
	browserLive();
    }
);
