function I(x){
    return x;
}
function K(x){
    return function(){
	return x;
    };
}
var NOP = K();

var lastDelayTimestamp = new Date();
function promiseAnimationFrame(){
    return new Promise(
	function(resolve, reject){
	    return window.requestAnimationFrame(resolve);
	}
    ).then(
	function(result){
	    lastDelayTimestamp = new Date();
	    return result;
	}
    );
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
function promiseMaybeDelay(value){
    if(new Date() - lastDelayTimestamp <= 16)
	return Promise.resolve(value);
    return promiseAnimationFrame().then(K(value));
}
function pluck(key){
    return function(object){
	return object[key];
    };
}
function bindFrom(object, method){
    return object[method].bind(object);
}
function promiseMapSeries(xs, f){
    return xs.map(bindFrom(Promise, "resolve")).reduce(
	function(pys, px, i, a){
	    return Promise.all(
		[
		    px,
		    Promise.resolve(f),
		    pys // this one needs to be here for sequencing
		]
	    ).then(
		function(xgys){
		    var x = xgys[0];
		    var g = xgys[1];
		    return Promise.all(
			[
			    pys,
			    Promise.resolve(g(x)),
			]
		    );
		}
	    ).then(
		function(ysy){
		    var ys = ysy[0];
		    var y = ysy[1];
		    return ys.concat([y]);
		}
	    );
	},
	Promise.resolve([])
    );
}

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
function promiseHttpPost(url, data, dataType){
    return new Promise(
	function(res, rej){
	    return $.post(
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
function getPage(n){
    return promiseHttpGet(
	"/browser/page/" + +n,
	null,
	"json"
    );
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

var Uzbl = (
    function(constructor){
	function ensureDom(){
	    if(!("dom" in this))
		this.dom = this.makeDom();
	    return this.dom;
	}
	function buildDomClass(cls, construct, makeDom, members, named){
	    cls.prototype.construct = construct;
	    cls.prototype.makeDom = makeDom;
	    cls.prototype.ensureDom = ensureDom;
	    Object.keys(members).map(
		function(k){
		    cls.prototype[k] = members[k];
		}
	    );
	    named.map(
		function(x){
		    cls.prototype[x.name] = x;
		}
	    );
	    return cls;
	}

	var ToggleUl = buildDomClass(
	    function ToggleUl(){
		this.construct();
	    },
	    NOP,
	    function(){
		var result = document.createElement("span");
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
		result.appendChild(this.anchor);
		this.ul = document.createElement("ul");
		result.appendChild(this.ul);
		$(this.ul).hide();
		return result;
	    },
	    {},
	    [
		function toggleVisibility(){
		    this.ensureDom();
		    $(this.ul).toggle("slow");
		}
	    ]
	);
	var EventList = buildDomClass(
	    function EventList(){
		this.construct();
	    },
	    function(){
		this.events = [];
	    },
	    function(){
		var result = document.createElement("span");
		var summary = document.createElement("span");
		this.summary = summary;
		$(summary).text("events");
		result.appendChild(summary);
		result.appendChild(document.createTextNode(": "));
		var ul = new ToggleUl();
		this.ul = ul;
		ul.toggleVisibility = bindFrom(this, "toggle");
		result.appendChild(ul.ensureDom());
		return result;
	    },
	    {
		visible: false
	    },
	    [
		function makeLiNumber(n){
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
		},
		function makeLi(event){
		    var lp = this.makeLiNumber(event["event ID"]);
		    $(lp[1]).text(event["event type"]);
		    return lp[0];
		},
		function appendEvent(event){
		    this.events.push(event["event ID"]);
		    this.ensureDom();
		    this.ul.ensureDom();
		    var li = this.makeLi(event);
		    this.ul.ul.appendChild(li);
		    var len = this.events.length;
		    $(this.summary).text(
			len + " event" + (1 == len ? "" : "s")
		    );
		    return li;
		},
		function hide(){
		    this.ensureDom();
		    var ul = this.ul;
		    $(ul.ul).hide(
			"slow",
			function(){
			    return $(ul.ul).html("");
			}
		    );
		    $(ul.anchor).text("show");
		},
		function populateUl(){
		    this.ensureDom();
		    return $(this.ul.ul).html(
			this.events.map(
			    bindFrom(this, "makeLiNumber")
			).map(pluck(0))
		    );
		},
		function show(){
		    this.populateUl();
		    $(this.ul.ul).show("slow");
		    $(this.ul.anchor).text("hide");
		},
		function toggle(){
		    this.visible = !(this.visible);
		    return this[this.visible ? "show" : "hide"]();
		}
	    ]
	);

	cls = buildDomClass(
	    constructor,
	    function construct(){
		this.pageEvents = [];
	    },
	    function makeDom(){
		var result = document.createElement("div");
		$("#evalBox").before(result);
		return result;
	    },
	    {},
	    [
		function toJSON(){
		    var result = {};
		    var that = this;
		    Object.keys(this).filter(
			function(k){
			    if("dom" == k) return false;
			    return true;
			}
		    ).map(
			function(k){
			    return [k, that[k]];
			}
		    ).map(
			function(kv){
			    var v = kv[1];
			    if("object" != typeof v) return kv;
			    if(!("toJSON" in v)) return kv;
			    return [kv[0], v.toJSON()];
			}
		    ).map(
			function(kv){
			    var k = kv[0];
			    var val = kv[1];
			    if("object" != typeof val) return kv;
			    if(!("browser" in val)) return kv;
			    var result = {};
			    Object.keys(val).filter(
				function(k){
				    return "browser" != k;
				}
			    ).map(
				function(k){
				    result[k] = val[k];
				}
			    );
			    return [k, result];
			}
		    ).map(
			function(kv){
			    try{
				return JSON.stringify(kv);
			    }
			    catch(e){
				return false;
			    }
			}
		    ).filter(I).map(
			function(s){
			    return JSON.parse(s);
			}
		    ).map(
			function(kv){
			    result[kv[0]] = kv[1];
			}
		    );
		    return result;
		},
		function appendChild(elem){
		    return this.ensureDom().appendChild(elem);
		}
	    ]
	);
	function storeBrowser(browser){
	    this.browser = browser;
	}
	function getBrowser(){
	    return this.browser;
	}
	function makeEventList(){
	    return new (
		this.getBrowser().EventList
	    )();
	}
	function appendToBrowser(child){
	    return this.getBrowser().appendChild(child);
	}
	function deferInit(browser){
	    this.storeBrowser(browser);
	    return this.init.apply(this, [].slice.call(arguments, 1));
	}
	function initEvents(container){
	    var result = this.makeEventList();
	    container.appendChild(document.createTextNode(" ("));
	    container.appendChild(result.ensureDom());
	    container.appendChild(document.createTextNode(")"));
	    return result;
	}
	function handleEvent(event){
	    var logged = this.logEvent(event);
	    var eventType = event["event type"];
	    if(eventType in this.eventMethods)
		return this[this.eventMethods[eventType]](event);
	    return logged;
	}
	function toJSON(){
	    if("toJson" in this)
		return this.toJson();
	    var result = {};
	    var that = this;
	    Object.keys(this).filter(
		function(k){
		    return "browser" != k;
		}
	    ).filter(
		function(k){
		    try{
			JSON.stringify(that[k]);
			return true;
		    }
		    catch(e){
			return false;
		    }
		}
	    ).map(
		function(k){
		    result[k] = that[k];
		}
	    );

	    var b = null;
	    if("getBrowser" in this)
		if("function" == typeof this.getBrowser)
		    b = this.getBrowser();
	    if(null == b) return result;

	    var browser = {};
	    Object.keys(b).filter(
		function(k){
		    return k != that.names.field;
		}
	    ).map(
		function(k){
		    browser[k] = b[k];
		}
	    );
	    if("toJSON" in b)
		browser.toJSON = b.toJSON;
	    result.browser = browser;
	    return result;
	}
	function logEvent(event){
	    this.ensureDom();
	    return this.events.appendEvent(event);
	};
	function buildWidgetClass(
	    name,
	    fieldName,
	    constructor,
	    init,
	    makeDom,
	    logAnEvent,
	    named,
	    eventMethods,
	    members
	){
	    if(!logAnEvent) logAnEvent = logEvent;
	    if(!named) named = [];
	    if(!eventMethods) eventMethods = {};
	    var renamed = {
		init: init
		, names: {
		    "class": name,
		    field: fieldName
		}
		, logEvent: logAnEvent
		, eventMethods: eventMethods
	    };
	    if(members)
		Object.keys(members).map(
		    function(k){
			renamed[k] = members[k];
		    }
		);
	    if(null != fieldName){
		cls.prototype["make" + constructor.name] = function(){
		    return this[fieldName] = new (this[name])(this, arguments);
		};
		cls.prototype["ensure" + constructor.name] = function(){
		    if(fieldName in this) return this[fieldName];
		    return this[
			"make" + constructor.name
		    ].apply(this, arguments);
		};
	    }
	    return cls.prototype[name] = buildDomClass(
		constructor,
		deferInit,
		makeDom,
		renamed,
		[
		    storeBrowser
		    , getBrowser,
		    makeEventList,
		    appendToBrowser
		    , toJSON
		    , initEvents
		    , handleEvent
		].concat(named)
	    );
	}

	var OtherEvents = buildWidgetClass(
	    "OtherEvents",
	    "otherEvents",
	    function OtherEvents(browser){
		this.construct(browser);
	    },
	    NOP,
	    function(){
		this.events = this.makeEventList();
		var result = this.events.ensureDom();
		this.ul = this.events.ul;
		this.appendToBrowser(result);
		return result;
	    },
	    null,
	    [
		function displayEvent(event){
		    return this.handleEvent(event);
		}
	    ]
	);
	var InstanceId = buildWidgetClass(
	    "Instance ID",
	    "instance ID",
	    function InstanceId(browser){
		this.construct(browser);
	    },
	    NOP,
	    function(){
		var result = document.createElement("span");
		var div = document.createElement("div");
		div.appendChild(result);
		this.events = this.initEvents(div);
		this.appendToBrowser(div);
		$(result).text("unknown instance");
		return result;
	    },
	    null,
	    [
		function assignValue(value){
		    this.value = value;
		    $(this.ensureDom()).text("instance " + value);
		},
		function handleInstanceStartEvent(e){
		    return this.assignValue(e.event["instance ID"]);
		}
	    ],
	    {
		INSTANCE_START: "handleInstanceStartEvent"
	    }
	);
	var Builtins = buildWidgetClass(
	    "Builtins",
	    "builtins",
	    function Builtins(browser){
		this.construct(browser);
	    },
	    NOP,
	    function(){
		var result = document.createElement("div");
		$(result).text("builtins: ");
		var ul = new ToggleUl();
		result.appendChild(ul.ensureDom());
		this.ul = ul.ul;
		this.events = this.initEvents(result);
		this.appendToBrowser(result);
		return result;
	    },
	    null,
	    [
		function ensureUl(){
		    this.ensureDom();
		    return this.ul;
		},
		function makeLi(name){
		    var li = document.createElement("li");
		    $(li).text(name);
		    return li;
		},
		function assignValue(builtins){
		    this.value = builtins;
		    $(this.ensureUl()).html(
			builtins.map(bindFrom(this, "makeLi"))
		    );
		    return this.value;
		},
		function handleBuiltinsEvent(e){
		    return this.assignValue(e.event.names);
		}
	    ],
	    {
		BUILTINS: "handleBuiltinsEvent"
	    }
	);
	var Variable = buildWidgetClass(
	    "Variable",
	    null,
	    function Variable(browser){
		this.construct(browser);
	    },
	    NOP,
	    function(){
		var result = document.createElement("li");
		this.name = document.createElement("span");
		this.valueType = document.createElement("span");
		this.pre = document.createElement("pre");
		result.appendChild(this.name);
		result.appendChild(document.createTextNode(" : "));
		result.appendChild(this.valueType);
		$(this.valueType).text("unknown");
		result.appendChild(this.pre);
		var form = document.createElement("div");
		var valueBox = document.createElement("input");
		form.appendChild(valueBox);
		var button = document.createElement("a");
		button.href = "#";
		var that = this;
		$(button).text("send");
		$(button).click(
		    function(){
			that.sendValue(valueBox.value);
			return false;
		    }
		);
		form.appendChild(button);
		result.appendChild(form);
		this.events = this.initEvents(result);
		return result;
	    },
	    null,
	    [
		function assignValue(valueType, value){
		    this.value = [valueType, value];
		    $(this.valueType).text(valueType);
		    $(this.pre).text("");
		    this.pre.appendChild(document.createTextNode(""+value));
		},
		function handleVariableSetEvent(event){
		    var val = event.event.value;
		    return this.assignValue(val[0], val[1]);
		}
		, function sendValue(value){
		    // a little dangerous
		    this.ensureDom();
		    return this.getBrowser().ensureVariables().sendVariable(
			$(this.name).text(),
			value
		    );
		}
	    ],
	    {
		VARIABLE_SET: "handleVariableSetEvent"
	    }
	);
	var Variables = buildWidgetClass(
	    "Variables",
	    "variables",
	    function Variables(browser){
		this.construct(browser);
	    },
	    function(){
		this.variables = {};
	    },
	    function(){
		var result = document.createElement("div");
		$(result).text("variables: ");
		this.ul = new ToggleUl();
		result.appendChild(this.ul.ensureDom());
		this.events = this.initEvents(result);
		this.appendToBrowser(result);
		return result;
	    },
	    null,
	    [
		function makeVariable(name){
		    this.ensureDom();
		    var result = new (
			this.getBrowser().Variable
		    )(this.getBrowser());
		    var li = result.ensureDom();
		    this.variables[name] = result;
		    $(result.name).text(name);
		    this.ul.ul.appendChild(li);
		    return result;
		},
		function ensureVariable(name){
		    if(name in this.variables) return this.variables[name];
		    return this.makeVariable(name);
		},
		function handleVariableSetEvent(event){
		    return this.ensureVariable(
			event.event.name
		    ).handleEvent(event);
		}
		, function snapshot(){
		    var result = {};
		    var v = this.variables;
		    Object.keys(v).map(
			function(k){
			    return [k, v[k]];
			}
		    ).map(
			function(kv){
			    return [kv[0]].concat(kv[1].value);
			}
		    ).map(
			function(triple){
			    result[triple.shift()] = triple;
			}
		    );
		    return result;
		}
		, function sendVariable(name, value){
		    //TODO: quote as needed
		    return this.getBrowser().sendLine(
			[
			    "set",
			    name,
			    "=",
			    value
			].join(" ")
		    );
		}
	    ],
	    {
		VARIABLE_SET: "handleVariableSetEvent"
	    }
	);
	var Geometry = buildWidgetClass(
	    "Geometry",
	    "geometry",
	    function Geometry(browser){
		this.construct(browser);
	    },
	    function(){
		this.knownViewport = [1, 1];
	    },
	    function(){
		var result = document.createElement("div");
		$(result).text("geometry: ");
		this.text = document.createElement("span");
		result.appendChild(this.text);
		this.canv = document.createElement("canvas");
		this.canv.width = 64;
		this.canv.height = 64;
		this.canv.appendChild(
		    document.createTextNode("[broken widget]")
		);
		result.appendChild(this.canv);
		this.events = this.initEvents(result);
		this.appendToBrowser(result);
		return result;
	    },
	    null,
	    [
		function assignValue(size, offset){
		    this.size = size;
		    this.offset = offset;
		    var right = +(size[0]) + (+(offset[0]));
		    var bottom = +(size[1]) + (+(offset[1]));
		    if(right > this.knownViewport[0])
			this.knownViewport[0] = right;
		    if(bottom > this.knownViewport[1])
			this.knownViewport[1] = bottom;
		    var smallDimension = Math.min.apply(
			Math,
			this.knownViewport
		    );
		    var ratio = 64 / smallDimension;
		    this.ensureDom();
		    this.canv.width = Math.ceil(ratio * this.knownViewport[0]);
		    this.canv.height = Math.ceil(ratio * this.knownViewport[1]);
		    $(this.text).text(
			[
			    size.join("x")
			].concat(offset).join("+")
		    );
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
		},
		function handleGeometryChangedEvent(event){
		    this.assignValue(event.event.size, event.event.offset);
		}
		, function snapshot(){
		    var result = {};
		    if("size" in this)
			result.size = this.size.map(I);
		    if("offset" in this)
			result.offset = this.offset.map(I);
		    return result;
		}
	    ],
	    {
		GEOMETRY_CHANGED: "handleGeometryChangedEvent"
	    }
	);
	var CookieName = buildWidgetClass(
	    "Cookie Name",
	    null,
	    function CookieName(browser){
		this.construct(browser);
	    },
	    NOP,
	    function makeDom(){
		var result = document.createElement("li");
		var nameSpan = document.createElement("span");
		this.nameSpan = nameSpan;
		result.appendChild(nameSpan);
		this.ul = document.createElement("ul");
		result.appendChild(this.ul);
		this.events = this.initEvents(result);
		return result;
	    }
	    , null,
	    [
		function setCookie(domain, path, name, value, scheme, expire){
		    function singleQuoteString(s){
			return "'" + s.split("\\").join("\\\\").split("'").join(
			    "\\'"
			) + "'";
		    }
		    return this.getBrowser().sendLine(
			[
			    "add_cookie",
			    singleQuoteString(domain),
			    singleQuoteString(path),
			    singleQuoteString(name),
			    singleQuoteString(value),
			    scheme,
			    expire
			].join(" ")
		    );
		},
		function createValueLink(event){
		    this.ensureDom();
		    var li = document.createElement("li");
		    var anchor = document.createElement("a");
		    var evt = event.event;
		    $(anchor).text(evt.value);
		    anchor.href = "#";
		    var that = this;
		    $(anchor).click(
			function(){
			    that.setCookie(
				evt.domain,
				evt.path,
				evt.name,
				evt.value,
				evt.scheme,
				evt.expiration
			    );
			    return false;
			}
		    );
		    li.appendChild(anchor);
		    this.ul.appendChild(li);
		    return li;
		},
		function handleAddCookieEvent(event){
		    return this.createValueLink(event);
		}
	    ],
	    {
		ADD_COOKIE: "handleAddCookieEvent"
	    }
	);
	var CookiePath = buildWidgetClass(
	    "Cookie Path",
	    null,
	    function CookiePath(browser){
		this.construct(browser);
	    },
	    function construct(){
		this.eventsByName = {};
	    },
	    function makeDom(){
		var result = document.createElement("li");
		var pathSpan = document.createElement("span");
		this.pathSpan = pathSpan;
		result.appendChild(pathSpan);
		this.ul = document.createElement("ul");
		result.appendChild(this.ul);
		this.events = this.initEvents(result);
		return result;
	    },
	    null,
	    [
		function makeName(name){
		    this.ensureDom();
		    var browser = this.getBrowser();
		    var result = new (browser["Cookie Name"])(browser);
		    var li = result.ensureDom();
		    $(result.nameSpan).text(name);
		    this.ul.appendChild(li);
		    this.eventsByName[name] = result;
		    return result;
		},
		function ensureName(name){
		    if(name in this.eventsByName)
			return this.eventsByName[name];
		    return this.makeName(name);
		},
		function handleAddCookieEvent(event){
		    return this.ensureName(
			event.event.name
		    ).handleEvent(event);
		},
		function handleDeleteCookieEvent(event){
		    return this.ensureName(
			event.event.name
		    ).handleEvent(event);
		}
	    ],
	    {
		ADD_COOKIE: "handleAddCookieEvent",
		DELETE_COOKIE: "handleDeleteCookieEvent"
	    }
	);
	var CookieDomain = buildWidgetClass(
	    "Cookie Domain",
	    null,
	    function CookieDomain(browser){
		this.construct(browser);
	    },
	    function construct(){
		this.eventsByPath = {};
	    },
	    function makeDom(){
		var result = document.createElement("li");
		var domain = document.createElement("span");
		this.domainSpan = domain;
		result.appendChild(domain);
		this.ul = document.createElement("ul");
		result.appendChild(this.ul);
		this.events = this.initEvents(result);
		return result;
	    },
	    null,
	    [
		function makePath(path){
		    this.ensureDom();
		    var browser = this.getBrowser();
		    var result = new (browser["Cookie Path"])(browser);
		    var li = result.ensureDom();
		    $(result.pathSpan).text(path);
		    this.ul.appendChild(li);
		    this.eventsByPath[path] = result;
		    return result;
		},
		function ensurePath(path){
		    if(path in this.eventsByPath)
			return this.eventsByPath[path];
		    return this.makePath(path);
		},
		function handleAddCookieEvent(event){
		    return this.ensurePath(
			event.event.path
		    ).handleEvent(event);
		},
		function handleDeleteCookieEvent(event){
		    return this.ensurePath(
			event.event.path
		    ).handleEvent(event);
		}
	    ],
	    {
		ADD_COOKIE: "handleAddCookieEvent",
		DELETE_COOKIE: "handleDeleteCookieEvent"
	    }
	);
	var Cookies = buildWidgetClass(
	    "Cookies",
	    "cookies",
	    function Cookies(browser){
		this.construct(browser);
	    },
	    function construct(){
		this.cookiesByDomain = {};
	    },
	    function makeDom(){
		var result = document.createElement("div");
		$(result).text("cookie jar: ");
		var clearAll = document.createElement("div");
		var anchor = document.createElement("a");
		clearAll.appendChild(anchor);
		var that = this;
		$(anchor).text("clear all");
		anchor.href = "#";
		$(anchor).click(
		    function(){
			that.clearAll();
			return false;
		    }
		);
		result.appendChild(clearAll);
		this.ul = new ToggleUl();
		result.appendChild(this.ul.ensureDom());
		this.events = this.initEvents(result);
		this.appendToBrowser(result);
		return result;
	    },
	    null,
	    [
		function clearAll(){
		    return this.getBrowser().sendLine("clear_cookies all");
		},
		function makeDomain(domain){
		    this.ensureDom();
		    var browser = this.getBrowser();
		    var result = new (browser["Cookie Domain"])(browser);
		    var li = result.ensureDom();
		    $(result.domainSpan).text(domain);
		    this.ul.ul.appendChild(li);
		    this.cookiesByDomain[domain] = result;
		    return result;
		},
		function ensureDomain(domain){
		    if(domain in this.cookiesByDomain)
			return this.cookiesByDomain[domain];
		    return this.makeDomain(domain);
		},
		function handleAddCookieEvent(event){
		    return this.ensureDomain(
			event.event.domain
		    ).handleEvent(event);
		},
		function handleDeleteCookieEvent(event){
		    return this.ensureDomain(
			event.event.domain
		    ).handleEvent(event);
		}
	    ],
	    {
		ADD_COOKIE: "handleAddCookieEvent",
		DELETE_COOKIE: "handleDeleteCookieEvent"
	    }
	);
	var VariablesSnapshot = buildWidgetClass(
	    "Variables Snapshot",
	    null,
	    function VariablesSnapshot(browser){
		this.construct.apply(this, arguments);
	    },
	    function(variables){
		this.variables = variables;
	    },
	    function(){
		var ul = new ToggleUl();
		this.ul = ul;
		var result = ul.ensureDom();
		var variables = this.variables;
		Object.keys(variables).map(
		    function(k){
			var val = variables[k];
			var li = document.createElement("li");
			var pre = document.createElement("pre");
			var line = k + " : " + val[0] + " =\n";
			pre.appendChild(
			    document.createTextNode(
				line + val[1]
			    )
			);
			li.appendChild(pre);
			return li;
		    }
		).map(
		    function(li){
			ul.ul.appendChild(li);
		    }
		);
		return result;
	    }
	);
	var PageInitStory = buildWidgetClass(
	    "Story PageInit",
	    null,
	    function PageInitStory(browser){
		this.construct.apply(this, arguments);
	    },
	    function(variables, geometry){
		this.variables = variables;
		this.geometry = geometry;
	    },
	    function(){
		var result = document.createElement("li");
		var geom = document.createElement("pre");
		geom.appendChild(
		    document.createTextNode(
			JSON.stringify(this.geometry, null, "\t")
		    )
		);
		var title = document.createElement("h1");
		title.appendChild(
		    document.createTextNode(this["type"])
		);
		result.appendChild(title);
		result.appendChild(
		    document.createTextNode("variables: ")
		);
		var browser = this.getBrowser();
		var vars = new (
		    browser["Variables Snapshot"]
		)(browser, this.variables);
		vars.ensureDom();
		result.appendChild(vars.ul.ensureDom());
		result.appendChild(
		    document.createTextNode("geometry: ")
		);
		result.appendChild(geom);
		return result;
	    },
	    null,
	    [
	    ],
	    {
	    },
	    {
		"type": "init"
	    }
	);
	var VariablesStory = buildWidgetClass(
	    "Story Variables",
	    null,
	    function VariablesStory(browser){
		this.construct.apply(this, arguments);
	    },
	    function construct(variables){
		this.snapshot = variables;
	    },
	    function makeDom(){
		var result = document.createElement("li");
		var title = document.createElement("h1");
		$(title).text(this["type"]);
		result.appendChild(title);
		var browser = this.getBrowser();
		var vars = new (
		    browser["Variables Snapshot"]
		)(browser, this.snapshot);
		vars.ensureDom();
		result.appendChild(vars.ul.ensureDom());
		this.events = this.initEvents(result);
		return result;
	    },
	    null,
	    [
	    ],
	    {
	    },
	    {
		"type": "variables"
	    }
	);
	var PageAddress = buildWidgetClass(
	    "Page Address",
	    null,
	    function PageAddress(browser){
		this.construct(browser);
	    },
	    NOP,
	    function makeDom(){
		var result = document.createElement("div");
		$(result).text("Location: ");
		var anchor = document.createElement("a");
		this.anchor = anchor;
		result.appendChild(anchor);
		$(anchor).text(anchor.href = "about:blank");
		$(anchor).click(bindFrom(this, "click"));
		var title = document.createElement("div");
		this.title = title;
		result.appendChild(title);
		this.events = this.initEvents(result);
		return result;
	    },
	    null,
	    [
		function click(){
		    this.ensureDom();
		    this.getBrowser().navigate(this.anchor.href);
		    return false;
		},
		function assignValue(uri){
		    this.ensureDom();
		    this.anchor.title = this.anchor.href = uri;
		    $(this.anchor).text(uri.split("/").join(" "));
		    if("" == $(this.title).text())
			$(this.title).text(uri.split("/").join(" / "));
		}
		, function setTitle(title){
		    $(this.title).text(title);
		}
		, function handleLoadEvent(event){
		    if("start" == event.event.loadType)
			return this.assignValue(event.event.uri);
		    if("commit" == event.event.loadType)
			return this.assignValue(event.event.uri);
		},
		function handleTitleChangedEvent(event){
		    this.setTitle(event.event.title);
		}
	    ],
	    {
		load: "handleLoadEvent",
		TITLE_CHANGED: "handleTitleChangedEvent"
	    }
	);
	var PopUps = buildWidgetClass(
	    "Page Popups",
	    null,
	    function PopUps(browser){
		this.construct(browser);
	    },
	    NOP,
	    function makeDom(){
		var result = document.createElement("div");
		var ul = document.createElement("ul");
		this.ul = ul;
		$(result).text("popups: ");
		result.appendChild(ul);
		this.events = this.initEvents(result);
		return result;
	    },
	    null,
	    [
		function click(li, uri){
		    this.getBrowser().navigate(uri);
		    $(li).remove();
		    return false;
		},
		function appendPopup(uri){
		    var li = document.createElement("li");
		    var anchor = document.createElement("a");
		    $(anchor).text(uri);
		    anchor.href = uri;
		    $(anchor).click(this.click.bind(this, li, uri));
		    li.appendChild(anchor);
		    this.ensureDom();
		    this.ul.appendChild(li);
		    return li;
		},
		function handleNewWindowEvent(event){
		    this.appendPopup(event.event.uri);
		}
	    ],
	    {
		NEW_WINDOW: "handleNewWindowEvent"
	    }
	);
	var Page = buildWidgetClass(
	    "Page",
	    null,
	    function Page(browser){
		this.construct.apply(this, arguments);
	    },
	    function construct(variables, geometry){
		this.variables = variables.snapshot();
		this.geometry = geometry.snapshot();
		this.initialStory();
	    },
	    function makeDom(){
		var result = document.createElement("li");
		var browser = this.getBrowser();
		this.address = new (browser["Page Address"])(browser);
		result.appendChild(this.address.ensureDom());
		this.popups = new (browser["Page Popups"])(browser);
		result.appendChild(this.popups.ensureDom());
		this.narrative = new ToggleUl();
		result.appendChild(this.narrative.ensureDom());
		this.events = this.initEvents(result);
		return result;
	    },
	    function logEvent(event){
		if(event["event type"] in this.eventMethods)
		    return;
		return this.events.appendEvent(event);
	    },
	    [
		function useStory(story){
		    this.currentStory = story;
		    this.ensureDom();
		    this.narrative.ul.appendChild(story.ensureDom());
		    return story;
		},
		function variablesSnapshotDom(variables){
		},
		function initialStory(){
		    var browser = this.getBrowser();
		    return this.useStory(
			new (browser["Story PageInit"])(
			    browser,
			    this.variables,
			    this.geometry
			)
		    );
		},
		function handleEventWithStory(className, event){
		    // https://stackoverflow.com/questions/1606797/use-of-apply-with-new-operator-is-this-possible/8843181#8843181
		    // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Function/bind
		    var browser = this.getBrowser();
		    var constructor = browser[className];
		    if(
			constructor.prototype["type"] !=
			    this.currentStory["type"]
		    )
			this.useStory(
			    new (
				I.bind.apply(
				    constructor,
				    [null, browser].concat(
					[].slice.call(arguments, 2)
				    )
				)
			    )()
			);
		    return this.currentStory.events.appendEvent(event);
		},
		function handleVariableSetEvent(event){
		    this.handleEventWithStory(
			"Story Variables",
			event,
			this.variables
		    );
		    this.variables[event.event.name] = event.event.value;
		},
		function makeGenericStory(storyType, title){
		    var story = this.useStory(
			{
			    dom: document.createElement("li"),
			    ensureDom: function(){
				return this.dom;
			    },
			    "type": storyType
			    , title: document.createElement("h1")
			}
		    );
		    var titleHeading = story.title;
		    $(titleHeading).text(title);
		    story.ensureDom().appendChild(titleHeading);
		    story.events = this.initEvents(story.ensureDom());
		    return story;
		},
		function handleEventWithGenericStory(
		    storyType,
		    event,
		    tolerate
		){
		    if(!tolerate) tolerate = [];
		    tolerate = [storyType].concat(tolerate);
		    var storyTolerance = [this.currentStory["type"]];
		    if("tolerate" in this.currentStory)
			storyTolerance = storyTolerance.concat(
			    this.currentStory.tolerate
			);
		    var matches = tolerate.filter(
			function(t){
			    return -1 != storyTolerance.indexOf(t);
			}
		    );
		    if(!(matches.length)){
			this.makeGenericStory(storyType, storyType);
			this.currentStory.tolerate = tolerate;
		    }
		    var story = this.currentStory;
		    if("tolerate" in story){
			story.tolerate = story.tolerate.filter(
			    function(t){
				return -1 != tolerate.indexOf(t);
			    }
			);
			if(story.tolerate.length)
			    if(
				    -1 == story.tolerate.indexOf(
					$(story.title).text()
				    )
			    )
			    $(story.title).text(story.tolerate[0]);
		    }
		    return story.events.appendEvent(event);
		},
		function handleScrollHorizEvent(event){
		    return this.handleEventWithGenericStory(
			"scroll",
			event,
			[
			    "mouse",
			    "network",
			    "window"
			]
		    );
		},
		function handleScrollVertEvent(event){
		    return this.handleEventWithGenericStory(
			"scroll",
			event,
			[
			    "mouse",
			    "network",
			    "window"
			]
		    );
		},
		function handleGeometryChangedEvent(event){
		    return this.handleEventWithGenericStory("geometry", event);
		},
		function handleCommandExecutedEvent(event){
		    return this.handleEventWithGenericStory("commands", event);
		},
		function handleLoadEvent(event){
		    this.handleEventWithGenericStory("network", event);
		    if("start" == event.event.loadType)
			return this.address.handleEvent(event);
		    if("commit" == event.event.loadType)
			return this.address.handleEvent(event);
		},
		function handleRequestStartingEvent(event){
		    return this.handleEventWithGenericStory("network", event);
		},
		function handleFocusEvent(event){
		    return this.handleEventWithGenericStory("focus", event);
		},
		function handleTitleChangedEvent(event){
		    this.handleEventWithGenericStory(
			"title",
			event,
			["network"]
		    );
		    return this.address.handleEvent(event);
		},
		function handlePtrMoveEvent(event){
		    return this.handleEventWithGenericStory(
			"pointer",
			event,
			["mouse"]
		    );
		},
		function handleLinkHoverEvent(event){
		    return this.handleEventWithGenericStory(
			"link hover",
			event
			, ["mouse", "scroll"]
		    );
		},
		function handleLinkUnhoverEvent(event){
		    return this.handleEventWithGenericStory(
			"link hover",
			event
			, ["mouse", "scroll"]
		    );
		},
		function handleRootActiveEvent(event){
		    return this.handleEventWithGenericStory(
			"click",
			event,
			["mouse"]
		    );
		},
		function handleFormActiveEvent(event){
		    return this.handleEventWithGenericStory(
			"click",
			event,
			["mouse"]
		    );
		},
		function handleAddCookieEvent(event){
		    return this.handleEventWithGenericStory("cookie", event);
		},
		function handleDeleteCookieEvent(event){
		    return this.handleEventWithGenericStory("cookie", event);
		},
		function handleKeyPressEvent(event){
		    return this.handleEventWithGenericStory(
			"keyboard",
			event,
			["scroll"]
		    );
		},
		function handleKeyReleaseEvent(event){
		    return this.handleEventWithGenericStory(
			"keyboard",
			event,
			["scroll"]
		    );
		}
		, function handleModPressEvent(event){
		    return this.handleEventWithGenericStory("keyboard", event);
		},
		function handleModReleaseEvent(event){
		    return this.handleEventWithGenericStory("keyboard", event);
		}
		, function handleNewWindowEvent(event){
		    this.handleEventWithGenericStory("popup", event);
		    this.ensureDom();
		    this.popups.handleEvent(event);
		}
		, function finalizeEventList(events){
		    var lastEvent = null;
		    if(events.length)
			lastEvent = events.pop();
		    if("load" != lastEvent["event type"])
			events.push(lastEvent)
		    else if("start" != lastEvent.event.loadType)
			events.push(lastEvent);
		    var that = this;
		    return this.getBrowser().handleEvents(
			events.slice()
		    ).then(
			function(){
			    return new Promise(
				function(res, rej){
				    var oldDom = that.ensureDom();
				    that.dom = that.makeDom();
				    $(oldDom).text("").after(that.dom);
				    $(oldDom).remove();
				    $(oldDom).queue(
					"fx",
					function(go){
					    res(go());
					}
				    );
				}
			    );
			}
		    ).then(
			function(){
			    return promiseMapSeries(
				events,
				bindFrom(that, "handleEvent")
			    );
			}
		    );
		}
	    ],
	    {
		VARIABLE_SET: "handleVariableSetEvent",
		SCROLL_HORIZ: "handleScrollHorizEvent",
		SCROLL_VERT: "handleScrollHorizEvent",
		GEOMETRY_CHANGED: "handleGeometryChangedEvent",
		COMMAND_EXECUTED: "handleCommandExecutedEvent",
		load: "handleLoadEvent",
		REQUEST_STARTING: "handleRequestStartingEvent",
		focus: "handleFocusEvent",
		TITLE_CHANGED: "handleTitleChangedEvent",
		PTR_MOVE: "handlePtrMoveEvent",
		LINK_HOVER: "handleLinkHoverEvent",
		LINK_UNHOVER: "handleLinkUnhoverEvent",
		ROOT_ACTIVE: "handleRootActiveEvent",
		FORM_ACTIVE: "handleFormActiveEvent",
		ADD_COOKIE: "handleAddCookieEvent",
		DELETE_COOKIE: "handleDeleteCookieEvent",
		KEY_PRESS: "handleKeyPressEvent",
		KEY_RELEASE: "handleKeyReleaseEvent",
		MOD_PRESS: "handleModPressEvent",
		MOD_RELEASE: "handleModReleaseEvent",
		NEW_WINDOW: "handleNewWindowEvent"
	    }
	);
	var Pages = buildWidgetClass(
	    "Pages",
	    "pages",
	    function Pages(browser){
		this.construct(browser);
	    },
	    function construct(){
		this.newPage();
	    },
	    function makeDom(){
		var result = document.createElement("div");
		$(result).text("pages: ");
		this.ul = new ToggleUl();
		result.appendChild(this.ul.ensureDom());
		this.appendToBrowser(result);
		return result;
	    },
	    function logEvent(event){
		this.currentPage.handleEvent(event);
	    },
	    [
		function newPage(){
		    var pageNumber = 0;
		    if("currentPage" in this)
			if("page number" in this.currentPage)
			    pageNumber = this.currentPage["page number"] + 1;
		    this.currentPage = new (this.getBrowser().Page)(
			this.getBrowser(),
			this.getBrowser().ensureVariables(),
			this.getBrowser().ensureGeometry()
		    );
		    this.currentPage["page number"] = pageNumber;
		    this.ensureDom();
		    this.currentPage.ensureDom();
		    this.ul.ul.appendChild(this.currentPage.dom);
		    return this.currentPage;
		},
		function handleScrollHorizEvent(event){
		    var evt = event.event;
		    this.currentPage.scrollHoriz = {
			"bounds": evt.bounds,
			"viewport size": evt.page,
			"scrollbar": evt.value
		    };
		    return this.currentPage.scrollHoriz;
		},
		function handleScrollVertEvent(event){
		    var evt = event.event;
		    this.currentPage.scrollVert = {
			"bounds": evt.bounds,
			"viewport size": evt.page,
			"scrollbar": evt.value
		    };
		    return this.currentPage.scrollVert;
		},
		function handleLoadEvent(event){
		},
		function toJson(){
		    var result = {};
		    var that = this;
		    Object.keys(this).filter(
			function(k){
			    if("browser" == k) return false;
			    if("currentPage" == k) return false;
			    return true;
			}
		    ).map(
			function(k){
			    return [k, that[k]];
			}
		    ).map(
			function(kv){
			    try{
				return JSON.stringify(kv);
			    }
			    catch(e){
				return false;
			    }
			}
		    ).filter(I).map(
			function(s){
			    return JSON.parse(s);
			}
		    ).map(
			function(kv){
			    result[kv[0]] = JSON.parse(kv[1]);
			}
		    );
		    result.currentPage = {}
		    var page = this.currentPage;
		    if("toJSON" in page)
			page = page.toJSON();
		    Object.keys(page).filter(
			function(k){
			    return "browser" != k;
			}
		    ).map(
			function(k){
			    result.currentPage[k] = page[k]
			}
		    );
		    return result;
		}
		, function endPage(events){
		    this.ensureDom();
		    var that = this;
		    return Promise.resolve(events).then(
			bindFrom(this.currentPage, "finalizeEventList")
		    ).then(
			bindFrom(this, "newPage")
		    );
		}
	    ],
	    {
		load: "handleLoadEvent",
		SCROLL_HORIZ: "handleScrollHorizEvent",
		SCROLL_VERT: "handleScrollVertEvent"
	    }
	);

	var _prot = cls.prototype;
	_prot.EventList = EventList;

	_prot.sendLine = function(line){
	    return promiseHttpPost(
		"/send-line",
		{
		    "line": line
		}
	    );
	};
	_prot.navigate = function(uri){
	    return this.sendLine("uri " + uri);
	};
	_prot.displayEvent = function(e){
	    return this.ensureOtherEvents().displayEvent(e);
	};
	_prot.handleInstanceStartEvent = function(e){
	    return this.ensureInstanceId().handleEvent(e);
	};
	_prot.handleBuiltinsEvent = function(e){
	    return this.ensureBuiltins().handleEvent(e);
	};
	_prot.forwardEventToPages = function(event){
	    return this.ensurePages().handleEvent(event);
	};
	_prot.handleVariableSetEvent = function(event){
	    var vars = this.ensureVariables();
	    vars.ensureDom();
	    this.forwardEventToPages(event);
	    return vars.handleEvent(event);
	};
	_prot.handleScrollHorizEvent = function(event){
	    // TODO
	    return this.forwardEventToPages(event);
	};
	_prot.handleScrollVertEvent = function(event){
	    // TODO
	    return this.forwardEventToPages(event);
	};
	_prot.handleGeometryChangedEvent = function(event){
	    this.forwardEventToPages(event);
	    return this.ensureGeometry().handleEvent(event);
	};
	_prot.forwardEventToCookies = function(event){
	    this.forwardEventToPages(event);
	    return this.ensureCookies().handleEvent(event);
	};
	_prot.nextEvent = 0;
	_prot.eventMethodNames = {
	    INSTANCE_START: "handleInstanceStartEvent",
	    BUILTINS: "handleBuiltinsEvent",
	    VARIABLE_SET: "handleVariableSetEvent",
	    SCROLL_HORIZ: "handleScrollHorizEvent",
	    SCROLL_VERT: "handleScrollVertEvent",
	    GEOMETRY_CHANGED: "handleGeometryChangedEvent",
	    ADD_COOKIE: "forwardEventToCookies",
	    DELETE_COOKIE: "forwardEventToCookies",
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
	    FORM_ACTIVE: "forwardEventToPages",
	    NEW_WINDOW: "forwardEventToPages"
	};
	_prot.handleEvent = function(e){
	    if(e["event ID"] != this.nextEvent)
		return Promise.reject(
		    ["handleEvent", "wrong line", e["event ID"], this.nextEvent]
		);
	    this.nextEvent++;
	    var methods = this.eventMethodNames;
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
	    ).then(promiseMaybeDelay);
	};
	_prot.handleEvents = function(events){
	    var that = this;
	    while(events.length && (events[0]["event ID"] < this.nextEvent))
		events.shift();
	    return promiseMapSeries(
		events,
		bindFrom(this, "handleEvent")
	    ).then(
		function(x){
		    return promiseAnimationFrame().then(K(x));
		}
	    );
	};

	_prot.currentPageNumber = 0;
	_prot.updateCurrentPage = function(){
	    var that = this;
	    return getPage(this.currentPageNumber + 1).then(
		bindFrom(this, "finalizeCurrentPage"),
		function(){
		    var pageNumber = that.currentPageNumber;
		    return getPage(pageNumber).then(
			function(pageEvents){
			    var newEvents = pageEvents.slice(that.pageEvents.length);
			    that.pageEvents = pageEvents;
			    return that.handleEvents(newEvents)["catch"](
				function(err){
				    console.error(err);
				    return Promise.reject(err);
				}
			    );
			}
		    );
		}
	    );
	};
	_prot.finalizeCurrentPage = function(){
	    var that = this;
	    return getPage(this.currentPageNumber).then(
		function(pageEvents){
		    that.pageEvents = [];
		    that.currentPageNumber++;
		    return that.ensurePages().endPage(pageEvents);
		}
	    );
	};
	_prot.turnPage = function(){
	    var that = this;
	    return getPage(this.currentPageNumber + 1).then(
		function(){
		    return that.finalizeCurrentPage().then(
			function(result){
			    return Promise.resolve().then(
				bindFrom(that, "updateCurrentPage")
			    );
			}
		    );
		},
		K(false)
	    );
	};
	_prot.turnPageForever = function(idleDelayMilliseconds, whiffs){
	    var that = this;
	    function whiff(){
		return promiseDelay(
		    idleDelayMilliseconds * (
			1 + Math.floor(
			    Math.log1p(
				whiffs++
			    )
			)
		    )
		).then(promiseAnimationFrame).then(
		    function(){
			return that.turnPageForever(
			    idleDelayMilliseconds,
			    whiffs
			);
		    }
		);
	    }
	    function hit(){
		return promiseAnimationFrame().then(
		    function(){
			return that.turnPageForever(idleDelayMilliseconds, 0);
		    }
		);
	    }
	    return this.turnPage().then(
		function(turnt){
		    if(turnt) return hit();
		    return that.updateCurrentPage().then(
			function(result){
			    return (result.length ? hit : whiff)();
			},
			whiff
		    );
		},
		function(error){
		    console.log(error);
		    return whiff();
		}
	    );
	};

	return cls;
    }
)(
    function Uzbl(){
	this.construct();
    }
);


var browser = new Uzbl();

function browserLive(){
    return browser.turnPageForever(500, 1);
}


$(
    function(){
	setupEvalBox();
	browserLive();
    }
);
