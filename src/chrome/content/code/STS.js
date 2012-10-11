// http://lists.w3.org/Archives/Public/www-archive/2009Sep/att-0051/draft-hodges-strict-transport-sec-05.plain.html

const STS = {
  
  enabled: false,
  
  get db() {
    delete this.db;
    return this.initPersistentDB();
  },
  
  initPersistentDB: function() {
    return this.db = new STSDB(STSPersistence);
  },
  
  processRequest: function(chan) {
    if (this.enabled) {
      var uri = chan.URI;
      if (uri.schemeIs("https")) {
        try {
          this.db.processHeader(uri.asciiHost, chan.getResponseHeader("Strict-Transport-Security"));
        } catch (e) {}
      }
    }
  },
  
  isSTSURI: function(uri) {
    return this.enabled && this.db.matches(uri.asciiHost);
  },
  
  enterPrivateBrowsing: function() {
    try {
      this.db.save();
    } catch(e) {}
    
    this.db = new STSDB(this.db);
  },
  
  exitPrivateBrowsing: function() {
    this.initPersistentDB();
  },
  
  eraseDB: function() {
    this.db.reset();
    STSPersistence.save(this.db);
  },
  
  patchErrorPage: function(docShell, errorURI) {
    // see #errors-in-secure-transport-establishment
    if (!this.enabled) return;
    
    if (!(/^about:certerror?/.test(errorURI.spec) &&
          this.isSTSURI(docShell.currentURI))
       ) return;
    
    Thread.delay(function() {
      docShell.document.getElementById("expertContent").style.display = "none";
    }, 100);
  },
  
  dispose: function() {
    this.db.save();
  }
};

function STSDB(source) {
  this._entries = {};
  if (source && source._entries) { // clone
    var entries = source._entries;
    for (var p in entries) {
      this._entries[p] = entries[p];
    }
  } else {
    if (source && source.load) {
      this._persistence = source;
      this.load();
    }
  } 
}

STSDB.prototype = {
  _persistence: null,
  _dirty: false,
  _saveTimer: null,
  
  processHeader: function(host, header) {
    if (DNS.isIP(host)) return;
    
    var m = header.match(/^\s*max-age\s*=\s*(\d+)\s*(;\s*includeSubDomains)?/i);
    if (!m) return;
    var maxAge = parseInt(m[1]);
    var includeSubDomains = !!m[2];
    var expiration = Math.round(Date.now() / 1000) + maxAge; 
    if (host in this._entries) {
      var e = this._entries[host];
      if (e.expiration == expiration && e.includeSubDomains == includeSubDomains)
        return;
      
      e.expiration = expiration;
      e.includeSubDomains = includeSubDomains;
    } else {
      this.add(new STSEntry(host, expiration, includeSubDomains));
    }
    this.saveDeferred();
  },
  
  add: function(entry) {
    this._entries[entry.host] = entry;
  },
  
  matches: function(host, asSuperDomain) {
    if (host in this._entries) {
      var e = this._entries[host];
      
      if (e.expiration >= Date.now() / 1000) {
        if ((!asSuperDomain || e.includeSubDomains))
          return true;
      } else {
        delete this._entries[host];
      }
    }
    
    var dotPos = host.indexOf(".");
    var lastDotPos = host.lastIndexOf(".");
    
    if (dotPos == lastDotPos)
      return false;
    
    return this.matches(host.substring(dotPos + 1), true);
  },
  
  serialize: function() {
    var lines = [], ee = this._entries;
    var e;
    for (var h in ee) {
      e = ee[h];
      lines.push([e.host, e.expiration, e.includeSubDomains ? "*" : ""].join(";"));
    }
    return lines.join("\n");
  },
  restore: function(s) {
    s.split(/\s+/).forEach(function(line) {
      if (line) {
        var args = line.split(";");
        if (args.length > 1)
          this.add(new STSEntry(args[0], parseInt(args[1]), !!args[2]));
      }
    }, this);
  },
  
  load: function() {
    if (this._persistence) {
      this._persistence.load(this);
      this.purgeExpired();
    }
  },
  
  save: function() {
    if (this._dirty && this._persistence) {
      this.purgeExpired();
      this._persistence.save(this);
      this._dirty = false;
    }
  },
  
  saveDeferred: function() {
    if (this._dirty || !this._persistence) return;
    this._dirty = true;
    if (!this._timer) this._timer = Cc["@mozilla.org/timer;1"].createInstance(Ci.nsITimer);
    this._timer.initWithCallback(this, 10000, Ci.nsITimer.TYPE_ONE_SHOT);
  },
  notify: function(timer) {
    this.save();
  },
  
  purgeExpired: function() {
    var now = Math.round(Date.now() / 1000);
    for (var h in this._entries) {
      if (this._entries[h].expiration < now) delete this._entries[h];
    }
  },
  
  reset: function() {
    this._entries = {};
    this._dirty = false;
  }
};

function STSEntry(host, expiration, includeSubDomains) {
  this.host = host;
  this.expiration = expiration;
  if (includeSubDomains) this.includeSubDomains = includeSubDomains;
}

STSEntry.prototype = {
  includeSubDomains: false
};


const STSPersistence = {
  get _file() {
    delete this._file;
    var f =  Cc["@mozilla.org/file/directory_service;1"].getService(
        Ci.nsIProperties).get("ProfD", Ci.nsIFile);
    f.append("NoScriptSTS.db");
    return this._file = f;
  },
  load: function(db) {
    var f = this._file;
    try {
      if (f.exists()) db.restore(IO.readFile(f));
    } catch (e) {
      dump("STS: Error loading db from " + f.path + "!" + e + "\n");
      return false;
    }
    return true;
  },
  save: function(db) {
    var f = this._file;
    try {
      IO.safeWriteFile(f, db.serialize());
    } catch(e) {
      dump("STS: Error saving db to " + f.path + "!" + e + "\n");
      return false;
    }
    return true;
  }
};
