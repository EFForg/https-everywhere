Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

const IO = {
  readFile: function(file, charset) {
    var res;
    
    const is = Cc["@mozilla.org/network/file-input-stream;1"]
      .createInstance(Ci.nsIFileInputStream );
    is.init(file ,0x01, 256 /*0400*/, null);
    const sis = Cc["@mozilla.org/scriptableinputstream;1"]
      .createInstance(Ci.nsIScriptableInputStream);
    sis.init(is);
    
    res = sis.read(sis.available());
    is.close();
    
    if (charset !== null) { // use "null" if you want unconverted data...
      const unicodeConverter = Cc["@mozilla.org/intl/scriptableunicodeconverter"]
        .createInstance(Ci.nsIScriptableUnicodeConverter);
      try {
        unicodeConverter.charset = charset || "UTF-8";
      } catch(ex) {
        unicodeConverter.charset = "UTF-8";
      }
      res = unicodeConverter.ConvertToUnicode(res);
    }
  
    return res;
  },
  writeFile: function(file, content, charset) {
    const unicodeConverter = Cc["@mozilla.org/intl/scriptableunicodeconverter"]
      .createInstance(Ci.nsIScriptableUnicodeConverter);
    try {
      unicodeConverter.charset = charset || "UTF-8";
    } catch(ex) {
      unicodeConverter.charset = "UTF-8";
    }
    
    content = unicodeConverter.ConvertFromUnicode(content);
    const os = Cc["@mozilla.org/network/file-output-stream;1"]
      .createInstance(Ci.nsIFileOutputStream);
    os.init(file, 0x02 | 0x08 | 0x20, 448 /*0700*/, 0);
    os.write(content, content.length);
    os.close();
  },
  
  safeWriteFile: function(file, content, charset) {
    var tmp = file.clone();
    var name = file.leafName;
    tmp.leafName = name + ".tmp";
    tmp.createUnique(Ci.nsIFile.NORMAL_FILE_TYPE, file.exists() ? file.permissions : 384 /*0600*/);
    this.writeFile(tmp, content, charset);
    tmp.moveTo(file.parent, name);
  }
};


function nsISupportsWrapper(wrapped) {
  this.wrappedJSObject = wrapped;
}
nsISupportsWrapper.prototype = {
  QueryInterface: XPCOMUtils.generateQI([])
};

const IOUtil = {
  asyncNetworking: true,
  proxiedDNS: 0,

  attachToChannel: function(channel, key, requestInfo) {
    if (channel instanceof Ci.nsIWritablePropertyBag2) 
      channel.setPropertyAsInterface(key, requestInfo);
  },
  extractFromChannel: function(channel, key, preserve) {
    if (channel instanceof Ci.nsIPropertyBag2) {
      let p = channel.get(key);
      if (p) {
        if (!preserve && (channel instanceof Ci.nsIWritablePropertyBag)) channel.deleteProperty(key);
        if (p.wrappedJSObject) return p.wrappedJSObject;
        p instanceof Ci.nsIURL || p instanceof Ci.nsIURL;
        return p;
      }
    }
    return null;
  },

  extractInternalReferrer: function(channel) {
    if (channel instanceof Ci.nsIPropertyBag2) {
      const key = "docshell.internalReferrer";
      if (channel.hasKey(key))
        try {
          return channel.getPropertyAsInterface(key, Ci.nsIURL);
        } catch(e) {}
    }
    return null;
  },
  extractInternalReferrerSpec: function(channel) {
    var ref = this.extractInternalReferrer(channel);
    return ref && ref.spec || null;
  },
  
  getProxyInfo: function(channel) {
    return Ci.nsIProxiedChannel && (channel instanceof Ci.nsIProxiedChannel) 
    ? channel.proxyInfo
    : Components.classes["@mozilla.org/network/protocol-proxy-service;1"]
        .getService(Components.interfaces.nsIProtocolProxyService)
        .resolve(channel.URI, 0);
  },
  
  
  canDoDNS: function(channel) {
    if (!channel || IOS.offline) return false;
    
    var proxyInfo = this.getProxyInfo(channel);
    switch(this.proxiedDNS) {
      case 1:
        return !(proxyInfo && (proxyInfo.flags & Ci.nsIProxyInfo.TRANSPARENT_PROXY_RESOLVES_HOST));
      case 2:
        return true;
      default:
        return !proxyInfo || proxyInfo.type == "direct";   
    }

  },
  
  abort: function(channel, noNetwork) {
    channel.cancel(Components.results.NS_ERROR_ABORT);
  },
  
  findWindow: function(channel) {
    for each(var cb in [channel.notificationCallbacks,
                       channel.loadGroup && channel.loadGroup.notificationCallbacks]) {
      if (cb instanceof Ci.nsIInterfaceRequestor) {
        if (Ci.nsILoadContext) try {
        // For Gecko 1.9.1
          return cb.getInterface(Ci.nsILoadContext).associatedWindow;
        } catch(e) {}
        
        try {
          // For Gecko 1.9.0
          return cb.getInterface(Ci.nsIDOMWindow);
        } catch(e) {}
      }
    }
    return null;
  },
  
  readFile: IO.readFile,
  writeFile: IO.writeFile,
  safeWriteFIle: IO.safeWriteFile,
  
  _protocols: {}, // caching them we gain a 33% speed boost in URI creation :)
  newURI: function(url) {
    try {
      let scheme =  url.substring(0, url.indexOf(':'));
      return (this._protocols[scheme] || 
        (this._protocols[scheme] =
          Cc["@mozilla.org/network/protocol;1?name=" + scheme]
          .getService(Ci.nsIProtocolHandler)))
        .newURI(url, null, null);
    } catch(e) {
      return IOS.newURI(url, null, null);
    }
  },
  
  unwrapURL: function(url) {  
    try {
      if (!(url instanceof Ci.nsIURI))
        url = this.newURI(url);
      
      switch (url.scheme) {
        case "view-source":
          return this.unwrapURL(url.path);
        case "feed":
          let u = url.spec.substring(5);
          if (u.substring(0, 2) == '//') u = "http:" + u;
          return this.unwrapURL(u);
        case "wyciwyg":
          return this.unwrapURL(url.path.replace(/^\/\/\d+\//, ""));
        case "jar":
          if (url instanceof Ci.nsIJARURI)
            return this.unwrapURL(url.JARFile);
      }
    }
    catch (e) {}
    
    return url;
  },
  
  
  get _channelFlags() {
    delete this._channelFlags;
    const constRx = /^[A-Z_]+$/;
    const ff = {};
    [Ci.nsIHttpChannel, Ci.nsICachingChannel].forEach(function(c) {
      for (var p in c) {
        if (constRx.test(p)) ff[p] = c[p];
      }
    });
    return this._channelFlags = ff;
  },
  humanFlags: function(loadFlags) {
    var hf = [];
    var c = this._channelFlags;
    for (var p in c) {
      if (loadFlags & c[p]) hf.push(p + "=" + c[p]);
    }
    return hf.join("\n");
  },
  
  queryNotificationCallbacks: function(chan, iid) {
    var cb;
    try {
      cb = chan.notificationCallbacks.getInterface(iid);
      if (cb) return cb;
    } catch(e) {}
    
    try {
      return chan.loadGroup && chan.loadGroup.notificationCallbacks.getInterface(iid);
    } catch(e) {}
    
    return null;
  },
  
 
  anonymizeURI: function(uri, cookie) {
    if (uri instanceof Ci.nsIURL) {
      uri.query = this.anonymizeQS(uri.query, cookie);
    } else return this.anonymizeURL(uri, cookie);
    return uri;
  },
  anonymizeURL: function(url, cookie) {
    var parts = url.split("?");
    if (parts.length < 2) return url;
    parts[1] = this.anonymizeQS(parts[1], cookie);
    return parts.join("?");
  },
  
  _splitName: function(nv) {
    return nv.split("=")[0];
  },
  _qsRx: /[&=]/,
  _anonRx: /(?:auth|s\w+(?:id|key)$)/,
  anonymizeQS: function(qs, cookie) {
    if (!qs) return qs;
    if (!this._qsRx.test(qs)) return '';
    
    var cookieNames, hasCookies;
    if ((hasCookies = !!cookie)) cookieNames = cookie.split(/\s*;\s*/).map(this._splitName);
    
    let parms = qs.split("&");
    for (var j = parms.length; j-- > 0;) {
      let nv = parms[j].split("=");
      let name = nv[0];
      if (this._anonRx.test(name) || cookie && cookieNames.indexOf(name) > -1)
        parms.splice(j, 1);
    }
    return parms.join("&");
  },

  get TLDService() {
    delete this.TLDService;
    return this.TLDService = Cc["@mozilla.org/network/effective-tld-service;1"].getService(Ci.nsIEffectiveTLDService);
  }
  
};


