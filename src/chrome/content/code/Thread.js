var Thread = {
  
  hostRunning: true,
  activeQueues: 0,
  activeLoops: 0,
  _timers: [],
  
  get canSpin() {
    delete this.canSpin;
    return this.canSpin = this.current instanceof CI.nsIEventTarget;
  },
  
  runWithQueue: function(callback, self) {
    var thread = this.current;
    thread instanceof CI.nsIThreadInternal;
    try {
      this.activeQueues++;
      thread.pushEventQueue(null);
      return self ? callback.apply(self) : callback();
    } finally {
      thread.popEventQueue();
      this.activeQueues--;
    }
  },
  
  spinWithQueue: function(ctrl) {
    return this.runWithQueue(function() { return Thread.spin(ctrl); });
  },
  
  spin: function(ctrl) { 
    if (!this.canSpin) throw new Error("Thread: can't spin!");

    ctrl.startTime = ctrl.startTime || Date.now();
    ctrl.timeout = false;
    this.activeLoops++;
    this._spinInternal(ctrl);
    this.activeLoops--;
    ctrl.elapsed = Date.now() - ctrl.startTime;
    return ctrl.timeout;
  },
  
  _spinInternal: function(ctrl) {
    var t = ctrl.startTime;
    var maxTime = parseInt(ctrl.maxTime)
    if (maxTime) {
      while(ctrl.running && this.hostRunning) {
        this.yield();
        if (Date.now() - t > maxTime) {
          ctrl.timeout = true;
          ctrl.running = false;
          break;
        }
      }
    } else while(ctrl.running && this.hostRunning) this.yield();
  },
  
  yield: function() {
    this.current.processNextEvent(true);
  },
  
  yieldAll: function() {
    var t = this.current;
    while(t.hasPendingEvents()) t.processNextEvent(false);
  },
  
  get current() {
    delete this.current;
    var obj = "@mozilla.org/thread-manager;1" in CC 
      ? CC["@mozilla.org/thread-manager;1"].getService() 
      : CC["@mozilla.org/thread;1"].createInstance(CI.nsIThread);
    this.__defineGetter__("current", function() { return obj.currentThread; });
    return this.current; 
  },
  
  get currentQueue() {
    delete this.currentQueue;
    var eqs = null;
    const CTRID = "@mozilla.org/event-queue-service;1";
    if (CTRID in CC) {
      const IFace = CI.nsIEventQueueService;
      eqs = CC[CTRID].getService(IFace);
    }
    this.__defineGetter__("currentQueue", eqs
      ? function() { return eqs.getSpecialEventQueue(IFace.CURRENT_THREAD_EVENT_QUEUE); }
      : this.__lookupGetter__("current")
    );
    return this.currentQueue;  
  },
  
  delay: function(callback, time, self, args) {
    var timer = CC["@mozilla.org/timer;1"].createInstance(CI.nsITimer);
    this._timers.push(timer);
    timer.initWithCallback({
      notify: this._delayRunner,
      context: { callback: callback, args: args || [], self: self || null }
    }, time || 1, 0);
  },
  
  asap: function(callback, self, args) {
    if (this.canSpin) {
      this.current.dispatch({
        run: function() {
          callback.apply(self, args || []);
        }
      }, CI.nsIEventTarget.DISPATCH_NORMAL);
    } else {
      this.delay(callback, 0, self, args);
    }
  },
  
  basap: function(callback, self, args) { // before as soon as possible
    if (!this.canSpin) {
      this.asap(callback, self, args);
      return;
    }
    var thread = this.current;
    thread instanceof CI.nsIThreadInternal;
    this.activeQueues++;
    thread.pushEventQueue(null);
    this.asap(function() {
      callback.apply(self, args || []);
      thread.popEventQueue();
      Thread.activeQueues--;
    }, self, args);
  },
  
  
  _delayRunner: function(timer) {
    var ctx = this.context;
    try {
      ctx.callback.apply(ctx.self, ctx.args);
    } finally {
      this.context = null;
      var tt = Thread._timers;
      var pos = tt.indexOf(timer);
      if (pos > -1) tt.splice(pos, 1);
      timer.cancel();
    }
  }
  
}