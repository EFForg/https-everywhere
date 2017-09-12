// split a hostname and reverse it
function splitter(dottedName) {
  return dottedName.split('.').reverse();
}

let Node = Map;

function Tree() {
  this._base = new Node();
}

Tree.prototype = {
  sentinel: '.', // since '.' should not appear in the label of a hostname

  set: function(item, val) {
    let parts = splitter(item),
      len = parts.length,
      node = this._base;

    for (let i = 0; i < len; i++) {
      let part = parts[i];
      if (!node.has(part)) {
        node.set(part, new Node());
      }
      node = node.get(part);
    }
    node.set(this.sentinel, val);
  },

  get: function(item) {
    let parts = splitter(item).concat(this.sentinel),
      len = parts.length,
      node = this._base;

    for (let i = 0; i < len; i++) {
      let part = parts[i];
      if (!node.has(part)) {
        return undefined;
      }
      node = node.get(part);
    }
    return node;
  },

  has: function(item) {
    if (typeof this.get(item) == 'undefined') {
      return false;
    }
    return true;
  },

  delete: function(item) {
    let parts = splitter(item),
      len = parts.length,
      node = this._base,
      branch = [node];

    for (let i = 0; i < len; i++) {
      let part = parts[i];
      if (!node.has(part)) {
        return false;
      }
      node = node.get(part);
      branch.push(node);
    }
    for (let i = branch.length - 1; i > 0; i--) {
      if (!branch[i].delete(parts[i])) {
        return true;
      }
    }
    return true;
  },
};
