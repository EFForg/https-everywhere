//INCLUDE("DNS");

const IO = {
  readFile: function(file, charset) {
    var res;
    
    const is = CC["@mozilla.org/network/file-input-stream;1"]
      .createInstance(CI.nsIFileInputStream );
    is.init(file ,0x01, 256 /*0400*/, null);
    const sis = CC["@mozilla.org/scriptableinputstream;1"]
      .createInstance(CI.nsIScriptableInputStream);
    sis.init(is);
    
    res = sis.read(sis.available());
    is.close();
    
    if (charset !== null) { // use "null" if you want uncoverted data...
      const unicodeConverter = CC["@mozilla.org/intl/scriptableunicodeconverter"]
        .createInstance(CI.nsIScriptableUnicodeConverter);
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
    const unicodeConverter = CC["@mozilla.org/intl/scriptableunicodeconverter"]
      .createInstance(CI.nsIScriptableUnicodeConverter);
    try {
      unicodeConverter.charset = charset || "UTF-8";
    } catch(ex) {
      unicodeConverter.charset = "UTF-8";
    }
    
    content = unicodeConverter.ConvertFromUnicode(content);
    const os = CC["@mozilla.org/network/file-output-stream;1"]
      .createInstance(CI.nsIFileOutputStream);
    os.init(file, 0x02 | 0x08 | 0x20, 448 /*0700*/, 0);
    os.write(content, content.length);
    os.close();
  },
  
  safeWriteFile: function(file, content, charset) {
    var tmp = file.clone();
    var name = file.leafName;
    tmp.leafName = name + ".tmp";
    tmp.createUnique(CI.nsIFile.NORMAL_FILE_TYPE, file.exists() ? file.permissions : 384 /*0600*/);
    this.writeFile(tmp, content, charset);
    tmp.moveTo(file.parent, name);
  }
};


function nsISupportWrapper(wrapped) {
  this.wrappedJSObject = wrapped;
}
nsISupportWrapper.prototype = {
  QueryInterface: xpcom_generateQI([])
}

const IOUtil = {
  asyncNetworking: true,
  proxiedDNS: 0,

  attachToChannel: function(channel, key, requestInfo) {
    if (channel instanceof CI.nsIWritablePropertyBag2) 
      channel.setPropertyAsInterface(key, new nsISupportWrapper(requestInfo));
  },
  extractFromChannel: function(channel, key, preserve) {
    if (channel instanceof CI.nsIPropertyBag2) {
      let p = channel.get(key);
      if (p) {
        if (!preserve && (channel instanceof CI.nsIWritablePropertyBag)) channel.deleteProperty(key);
        return p.wrappedJSObject;
      }
    }
    return null;
  },

  extractInternalReferrer: function(channel) {
    if (channel instanceof CI.nsIPropertyBag2) {
      const key = "docshell.internalReferrer";
      if (channel.hasKey(key))
        try {
          return channel.getPropertyAsInterface(key, CI.nsIURL);
        } catch(e) {}
    }
    return null;
  },
  extractInternalReferrerSpec: function(channel) {
    var ref = this.extractInternalReferrer(channel);
    return ref && ref.spec || null;
  },
  
  getProxyInfo: function(channel) {
    return CI.nsIProxiedChannel && (channel instanceof CI.nsIProxiedChannel) 
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
        return !(proxyInfo && (proxyInfo.flags & CI.nsIProxyInfo.TRANSPARENT_PROXY_RESOLVES_HOST));
      case 2:
        return true;
      default:
        return !proxyInfo || proxyInfo.type == "direct";   
    }

  },
  
  abort: function(channel, noNetwork) {
    if (noNetwork && !ChannelReplacement.supported) {
      // this is for Gecko 1.1 which doesn't allow us to cancel in asyncOpen()
      channel.loadFlags |= CI.nsICachingChannel.LOAD_ONLY_FROM_CACHE; 
    }
    channel.cancel(Components.results.NS_ERROR_ABORT);
  },
  
  findWindow: function(channel) {
    for each(var cb in [channel.notificationCallbacks,
                       channel.loadGroup && channel.loadGroup.notificationCallbacks]) {
      if (cb instanceof CI.nsIInterfaceRequestor) {
        if (CI.nsILoadContext) try {
        // For Gecko 1.9.1
          return cb.getInterface(CI.nsILoadContext).associatedWindow;
        } catch(e) {}
        
        try {
          // For Gecko 1.9.0
          return cb.getInterface(CI.nsIDOMWindow);
        } catch(e) {}
      }
    }
    return null;
  },
  
  readFile: IO.readFile,
  writeFile: IO.writeFile,
  safeWriteFIle: IO.safeWriteFile,
  
  unwrapURL: function(url) {
    
    try {
      if (!(url instanceof CI.nsIURI))
        url = IOS.newURI(url, null, null);
      
      switch (url.scheme) {
        case "view-source":
          return this.unwrapURL(url.path);
        case "wyciwyg":
          return this.unwrapURL(url.path.replace(/^\/\/\d+\//, ""));
        case "jar":
          if (url instanceof CI.nsIJARURI)
            return this.unwrapURL(url.JARFile);
      }
    }
    catch (e) {}
    
    return url;
  },
  
  
  get _channelFlags() {
    delete this._channelFlags;
    var ff = {};
    [CI.nsIHttpChannel, CI.nsICachingChannel].forEach(function(c) {
      for (var p in c) {
        if (/^[A-Z_]+$/.test(p)) ff[p] = c[p];
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
    if (uri instanceof CI.nsIURL) {
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
  anonymizeQS: function(qs, cookie) {
    if (!qs) return qs;
    if (!/[&=]/.test(qs)) return '';
    
    var cookieNames, hasCookies;
    if ((hasCookies = !!cookie)) {
      cookieNames = cookie.split(/\s*;\s*/).map(function(nv) {
        return nv.split("=")[0];
      })
    }
    
    var parms = qs.split("&");
    var nv, name;
    for (var j = parms.length; j-- > 0;) {
      nv = parms[j].split("=");
      name = nv[0];
      if (/(?:auth|s\w+(?:id|key)$)/.test(name) || cookie && cookieNames.indexOf(name) > -1)
        parms.splice(j, 1);
    }
    return parms.join("&");
  },
  
  runWhenPending: function(channel, callback) {
    if (channel.isPending()) {
      callback();
      return false;
    } else {
      new LoadGroupWrapper(channel, {
        addRequest: function(r, ctx) {
          callback();
        }
      });
      return true;
    }
  },
  
  get TLDService() {
    delete this.TLDService;
    return this.TLDService = CC["@mozilla.org/network/effective-tld-service;1"].getService(CI.nsIEffectiveTLDService);
  }
  
};

function CtxCapturingListener(tracingChannel, onCapture) {
  this.originalListener = tracingChannel.setNewListener(this);
  this.onCapture = onCapture;
}
CtxCapturingListener.prototype = {
  originalListener: null,
  originalCtx: null,
  onStartRequest: function(request, ctx) {
    this.originalCtx = ctx;
    if (this.onCapture) this.onCapture(request, ctx);
  },
  onDataAvailable: function(request, ctx, inputStream, offset, count) {},
  onStopRequest: function(request, ctx, statusCode) {},
  QueryInterface: xpcom_generateQI([CI.nsIStreamListener])
}

function ChannelReplacement(chan, newURI, newMethod) {
  return this._init(chan, newURI, newMethod);
}

ChannelReplacement.supported = "nsITraceableChannel" in CI;

ChannelReplacement.prototype = {
  listener: null,
  context: null,
  oldChannel: null,
  channel: null,
  window: null,

  get _unsupportedError() {
    return new Error("Can't replace channels without nsITraceableChannel!");
  },
  
  get _mustClassify() {
    delete this.__proto__._mustClassify;
    return this.__proto__._mustClassify = !("LOAD_CLASSIFIER_URI" in CI.nsIChannel);
  },
  
  _init: function(chan, newURI, newMethod) {
    if (!(ChannelReplacement.supported && chan instanceof CI.nsITraceableChannel))
      throw this._unsupportedError;
  
    newURI = newURI || chan.URI;
    
    var newChan = IOS.newChannelFromURI(newURI);

    // porting of http://mxr.mozilla.org/mozilla-central/source/netwerk/protocol/http/src/nsHttpChannel.cpp#2750
    
    var loadFlags = chan.loadFlags;
    if (chan.URI.schemeIs("https"))
      loadFlags &= ~chan.INHIBIT_PERSISTENT_CACHING;
    
    
    newChan.loadGroup = chan.loadGroup;
    newChan.notificationCallbacks = chan.notificationCallbacks;
    newChan.loadFlags = loadFlags;
    
    if (!(newChan instanceof CI.nsIHttpChannel))
      return newChan;
    
    // copy headers
    chan.visitRequestHeaders({
      visitHeader: function(key, val) {
        try {
          
          // we skip authorization and cache-related fields which should be automatically set
          if (/^(?:Host|Cookie|Authorization)$|Cache|^If-/.test(key)) return;
          
          newChan.setRequestHeader(key, val, false);
        } catch (e) {
          dump(e + "\n");
        }
      }
    });
    
    
    if (!newMethod || newMethod === chan.requestMethod) {
      if (newChan instanceof CI.nsIUploadChannel && chan instanceof CI.nsIUploadChannel && chan.uploadStream ) {
        var stream = chan.uploadStream;
        if (stream instanceof CI.nsISeekableStream) {
          stream.seek(stream.NS_SEEK_SET, 0);
        }
        
        try {
          var ctype = chan.getRequestHeader("Content-type");
          var clen = chan.getRequestHeader("Content-length");
          if (ctype && clen) {
            newChan.setUploadStream(stream, ctype, parseInt(clen, 10));
          }
        } catch(e) {
          newChan.setUploadStream(stream, '', -1);
        }
        
        newChan.requestMethod = chan.requestMethod;
      }
    } else {
      newChan.requestMethod = newMethod;
    }
    
    if (chan.referrer) newChan.referrer = chan.referrer;
    newChan.allowPipelining = chan.allowPipelining;
    newChan.redirectionLimit = chan.redirectionLimit - 1;
    if (chan instanceof CI.nsIHttpChannelInternal && newChan instanceof CI.nsIHttpChannelInternal) {
      if (chan.URI == chan.documentURI) {
        newChan.documentURI = newURI;
      } else {
        newChan.documentURI = chan.documentURI;
      }
    }
    
    if (chan instanceof CI.nsIEncodedChannel && newChan instanceof CI.nsIEncodedChannel) {
      newChan.applyConversion = chan.applyConversion;
    }
    
    // we can't transfer resume information because we can't access mStartPos and mEntityID :(
    // http://mxr.mozilla.org/mozilla-central/source/netwerk/protocol/http/src/nsHttpChannel.cpp#2826
    
    if ("nsIApplicationCacheChannel" in CI &&
      chan instanceof CI.nsIApplicationCacheChannel && newChan instanceof CI.nsIApplicationCacheChannel) {
      newChan.applicationCache = chan.applicationCache;
      newChan.inheritApplicationCache = chan.inheritApplicationCache;
    }
    
    if (chan instanceof CI.nsIPropertyBag && newChan instanceof CI.nsIWritablePropertyBag) 
      for (var properties = chan.enumerator, p; properties.hasMoreElements();)
        if ((p = properties.getNext()) instanceof CI.nsIProperty)
          newChan.setProperty(p.name, p.value);
    
    this.oldChannel = chan;
    this.channel = newChan;
    
    if (chan.loadFlags & chan.LOAD_DOCUMENT_URI) {
      this.window = IOUtil.findWindow(chan);
    }
    
    return this;
  },
  
  _onChannelRedirect: function(trueRedir) {
    var oldChan = this.oldChannel;
    var newChan = this.channel;
    
    if (trueRedir) {
      if (oldChan.redirectionLimit === 0) {
        oldChan.cancel(NS_ERROR_REDIRECT_LOOP);
        throw NS_ERROR_REDIRECT_LOOP;
      }
    } else newChan.redirectionLimit += 1;
    
    newChan.loadFlags |= newChan.LOAD_REPLACE;
    
    // nsHttpHandler::OnChannelRedirect()

    const CES = CI.nsIChannelEventSink;
    const flags = CES.REDIRECT_INTERNAL;
    this._callSink(
      CC["@mozilla.org/netwerk/global-channel-event-sink;1"].getService(CES),
      oldChan, newChan, flags);
    var sink;
    
    for (let cess = CC['@mozilla.org/categorymanager;1']
              .getService(CI.nsICategoryManager)
              .enumerateCategory("net-channel-event-sinks");
          cess.hasMoreElements();
        ) {
      sink = cess.getNext();
      if (sink instanceof CES)
        this._callSink(sink, oldChan, newChan, flags);
    }
    sink = IOUtil.queryNotificationCallbacks(oldChan, CES);
    if (sink) this._callSink(sink, oldChan, newChan, flags);
    
    // ----------------------------------
    
    newChan.originalURI = oldChan.originalURI;
    
    sink = IOUtil.queryNotificationCallbacks(oldChan, CI.nsIHttpEventSink);
    if (sink) sink.onRedirect(oldChan, newChan);
  },
  
  _callSink: function(sink, oldChan, newChan, flags) {
    try { 
      if ("onChannelRedirect" in sink) sink.onChannelRedirect(oldChan, newChan, flags);
      else sink.asyncOnChannelRedirect(oldChan, newChan, flags, this._redirectCallback);
    } catch(e) {
      if (e.toString().indexOf("(NS_ERROR_DOM_BAD_URI)") !== -1 && oldChan.URI.spec !== newChan.URI.spec) {
        let oldURL = oldChan.URI.spec;
        try {
          oldChan.URI.spec = newChan.URI.spec;
          this._callSink(sink, oldChan, newChan, flags);
        } catch(e1) {
          throw e;
        } finally {
          oldChan.URI.spec = oldURL;
        }
      } else if (e.message.indexOf("(NS_ERROR_NOT_AVAILABLE)") === -1) throw e;
    }
  },
  
  get _redirectCallback() {
    delete this.__proto__._redirectCallback;
    return this.__proto__._redirectCallback = ("nsIAsyncVerifyRedirectCallback" in CI)
    ? {
        QueryInterface: xpcom_generateQI([CI.nsIAsyncVerifyRedirectCallback]),
        onRedirectVerifyCallback: function(result) {}
      }
    : null;
  },
  
  replace: function(isRedir, callback) {
    let self = this;
    let oldChan = this.oldChannel;
    this.isRedir = !!isRedir;
    if (typeof(callback) !== "function") {
      callback = this._defaultCallback;
    }
    IOUtil.runWhenPending(oldChan, function() {
      if (oldChan.status) return; // channel's doom had been already defined
      
      let ccl = new CtxCapturingListener(oldChan,
        function() {
          try {
            callback(self._replaceNow(isRedir, this))
          } catch (e) {
            self.dispose();
          }
        });
      self.loadGroup = oldChan.loadGroup;
      oldChan.loadGroup = null; // prevents the wheel from stopping spinning
      // this calls asyncAbort, which calls onStartRequest on our listener
      oldChan.cancel(NS_BINDING_REDIRECTED); 
    });
  },
  
  _defaultCallback: function(replacement) {
    replacement.open();
  },
  
  _replaceNow: function(isRedir, ccl) {
    let oldChan = this.oldChannel;
    oldChan.loadGroup = this.loadGroup;
    
    this._onChannelRedirect(isRedir);
    
    // dirty trick to grab listenerContext
   
    this.listener = ccl.originalListener;
    this.context = ccl.originalCtx;
    return this;
  },
  
  open: function() {
    let oldChan = this.oldChannel,
      newChan = this.channel,
      overlap;
    
    /* XXX: Hack
    if (!(this.window && (overlap = ABERequest.getLoadingChannel(this.window)) !== oldChan)) {
      try {
        if (ABE.consoleDump && this.window) {
          ABE.log("Opening delayed channel: " + oldChan.name + " - (current loading channel for this window " + (overlap && overlap.name) + ")");
        }
    */
    try {
      newChan.asyncOpen(this.listener, this.context);
      
      // safe browsing hook
      if (this._mustClassify)
        CC["@mozilla.org/channelclassifier"].createInstance(CI.nsIChannelClassifier).start(newChan, true);
      
    } catch (e) {}

    
    this.dispose();
  },
  
  dispose: function() {
    if (this.loadGroup) {
      try {
        this.loadGroup.removeRequest(this.oldChannel, null, NS_BINDING_REDIRECTED);
      } catch (e) {}
      this.loadGroup = null;
    }

  }
}

function LoadGroupWrapper(channel, callbacks) {
  this._channel = channel;
  this._inner = channel.loadGroup;
  this._callbacks = callbacks;
  channel.loadGroup = this;
}
LoadGroupWrapper.prototype = {
  QueryInterface: xpcom_generateQI([CI.nsILoadGroup]),
  
  get activeCount() {
    return this._inner ? this._inner.activeCount : 0;
  },
  set defaultLoadRequest(v) {
    return this._inner ? this._inner.defaultLoadRequest = v : v;
  },
  get defaultLoadRequest() {
    return this._inner ? this._inner.defaultLoadRequest : null;
  },
  set groupObserver(v) {
    return this._inner ? this._inner.groupObserver = v : v;
  },
  get groupObserver() {
    return this._inner ? this._inner.groupObserver : null;
  },
  set notificationCallbacks(v) {
    return this._inner ? this._inner.notificationCallbacks = v : v;
  },
  get notificationCallbacks() {
    return this._inner ? this._inner.notificationCallbacks : null;
  },
  get requests() {
    return this._inner ? this._inner.requests : this._emptyEnum;
  },
  
  addRequest: function(r, ctx) {
    this.detach();
    if (this._inner) try {
      this._inner.addRequest(r, ctx);
    } catch(e) {
      // addRequest may have not been implemented
    }
    if (r === this._channel && ("addRequest" in this._callbacks))
      try {
        this._callbacks.addRequest(r, ctx);
      } catch (e) {}
  },
  removeRequest: function(r, ctx, status) {
    this.detach();
    if (this._inner) this._inner.removeRequest(r, ctx, status);
    if (r === this._channel && ("removeRequest" in this._callbacks))
      try {
        this._callbacks.removeRequest(r, ctx, status);
      } catch (e) {}
  },
  
  detach: function() {
    if (this._channel.loadGroup) this._channel.loadGroup = this._inner;
  },
  _emptyEnum: {
    QueryInterface: xpcom_generateQI([CI.nsISimpleEnumerator]),
    getNext: function() { return null; },
    hasMoreElements: function() { return false; }
  }
}
