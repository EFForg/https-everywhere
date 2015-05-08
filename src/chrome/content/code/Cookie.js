Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

function Cookie(s, host) {
  this.parse(s, host);
}
Cookie.computeId = function(c) {
  return c.name + ";" + c.host + "/" + c.path;
};
Cookie.find = function(f) {
  var cc = Cookie.prototype.cookieManager.enumerator;
  var c;
  while (cc.hasMoreElements()) {
    if (f(c = cc.getNext())) return c;
  }
  return null;
};

Cookie.attributes = { host: 'domain', path: 'path', expires: 'expires', isHttpOnly: 'HttpOnly', isSecure: 'Secure' };
Cookie.prototype = {
  
  name: '',
  value: '',
  source: '',
  domain: '',
  host: '',
  rawHost: '',
  path: '',
  secure: false,
  httponly: false,
  session: true,
  expires: 0,
  
  id: '',
  
  
  toString: function() {
    var c = [this['name'] + "=" + this.value];
    var v;
    const aa = Cookie.attributes;
    for (var k in aa) {
      var p = aa[k];
      v = this[k];
      switch(typeof(v)) {
        case "string":
          if (v) c.push(p + "=" + v);
          break;
        case "boolean":
          if (v) c.push(p);
          break;
        case "number":
          if (!this.isSession) c.push(p + "=" + new Date(v * 1000).toUTCString());
          break;
      }
    }
    return c.join("; ");
  },
  parse: function(s, host) {
    var p;
    if (this.source) {
      // cleanup for recycle
      for (p in this) {
        if (typeof (p) != "function") delete this[p];
      }
    }
    this.source = s;
    this.host = host;
    
    var parts = s.split(/;\s*/);
    var nv = parts.shift().split("=");
    
    this.name = nv.shift() || '';
    this.value = nv.join('=') || '';
    
    var n, v;
    for each (p in parts) {
      nv = p.split("=");
      switch (n = nv[0].toLowerCase()) {
        case 'expires':
          v = Math.round(Date.parse((nv[1] || '').replace(/\-/g, ' ')) / 1000);
        break;
        case 'domain':
        case 'path':
          v = nv[1] || '';
          break;
        case 'secure':
        case 'httponly':
          v = true;
          break;
        default:
          n = 'unknown';
      }
      this[n] = v;
    }
    if (!this.expires) {
      this.session = true;
      this.expires = Math.round(new Date() / 1000) + 31536000;  
    }
    if (this.domain) {
      if (!this.isDomain) this.domain = "." + this.domain;
      this.host = this.domain;
    }
    this.rawHost = this.host.replace(/^\./, '');
    
    this.id = Cookie.computeId(this);
  },
  
  
  get cookieManager() {
    delete Cookie.prototype.cookieManager;
    var cman =  Cc["@mozilla.org/cookiemanager;1"]
      .getService(Ci.nsICookieManager2).QueryInterface(Ci.nsICookieManager);
    return Cookie.prototype.cookieManager = cman; 
  },
  belongsTo: function(host, path) {
    if (path && this.path && path.indexOf(this.path) != 0) return false;
    if (host == this.rawHost) return true;
    var d = this.domain;
    return d && (host == d || this.isDomain && host.slice(-d.length) == d);
  },
  save: function() {
    this.save = ("cookieExists" in this.cookieManager)
      ? function() { this.cookieManager.add(this.host, this.path, this.name, this.value, this.secure, this.httponly, this.session, this.expires); }
      : function() { this.cookieManager.add(this.host, this.path, this.name, this.value, this.secure,                this.session, this.expires);}
    ;
    return this.save();
  },
  exists: function() {
    var cc = this.cookieManager.enumerator;
    while(cc.hasMoreElements()) {
      if (this.sameAs(cc.getNext())) return true;
    }
    return false;
  },
  
  sameAs: function(c) {
    (c instanceof Ci.nsICookie) && (c instanceof Ci.nsICookie2);
    return Cookie.computeId(c) == this.id;
  },
  
  // nsICookie2 interface extras
  get isSecure() { return this.secure; },
  get expiry() { return this.expires; },
  get isSession() { return this.session; },
  get isHttpOnly() { return this.httponly; },
  get isDomain() { return this.domain && this.domain[0] == '.'; },
  policy: 0,
  status: 0,
  QueryInterface: XPCOMUtils.generateQI([Ci.nsICookie, Ci.nsICookie2])
  
};
