// import analyzeFunction from './analyze.js';


export function Signal(type, initialValue) {
  this.type = type;
  this.value = initialValue;
  this.subscribed = [];
  this.dirty = type === 'computed';
}
Signal.prototype.get = Signal.prototype.set = function get(value) {
  const state = this.__state;

  if (state.type === 'computed') {
    // computed
    // has value
    if (state.value.computed === 'pending') throw new Error('circular reference between signals');
    if (state.value.computed) {
      // dirty
      if (state.dirty) {
        state.dirty = 'pending';

        const dependencies = state.value.dependencies;
        let i = 0;
        for (; i < dependencies.length; i++) {
          if (!Signal.markClean(dependencies[i])) break;
        }
        
        state.dirty = false;
        if (i === dependencies.length) return state.value.value;

        const newValue = state.value.callback();
        if (state.value.value === newValue) return newValue;

        state.value.value = newValue;
        state.value.dirty = true;
        state.dirty = true;

        return newValue;
      }
      // clean
      return state.value.value;
    }
    // doesn't have value
    state.value.computed = 'pending';
    state.value.dependencies.forEach(d => {
      if (d.ref.__state.type === 'state') d.value = d.ref.__state.value;
    });

    const newValue = state.value.callback();
    state.value.value = newValue;
    state.value.computed = true;
    if (state.dirty) state.dirty = false;

    return newValue;
  }
  // state
  if (arguments.length === 1) {
    // set
    if (state.value === value) return value;

    state.dirty = true;
    Signal.dirtyDependencies(this);
    return state.value = value;
  }
  // get
  return state.value;
}
Object.defineProperty(Signal, 'dirtyDependencies', {
  value: function dirty(signal) {
    signal.__state.subscribed.forEach((s) => {
      if (!s.__state.dirty) {
        s.__state.dirty = true;
        dirty(s);
      }
    });
  },
  writable: true,
  enumerable: false,
  configurable: true,
});
Object.defineProperty(Signal, 'markClean', {
  value: function markClean(dependency) {
    const state = dependency.ref.__state;
    if (state.dirty === 'pending') throw new Error('circular reference between signals at recomputing');
    if (!state.dirty) return true;

    if (state.type === 'computed') {
      if (state.value.dirty) return false;
      state.dirty = 'pending';
      // computed
      const dependencies = state.value.dependencies;
      let i = 0;
      for (; i < dependencies.length; i++) {
        if (!markClean(dependencies[i])) break;
      }

      state.dirty = false;
      if (i === dependencies.length) return true;

      const newValue = state.value.callback();
      if (state.value.value === newValue) return true;

      state.value.value = newValue;
      state.value.dirty = true;
      state.dirty = true;
      
      return false;
    }
    // state
    if (dependency.value === state.value) return true;
    dependency.value = state.value;
    return false;
  },
  writable: true,
  enumerable: false,
  configurable: true,
});


export function state(initialValue) {
  const sg = new Signal('state', initialValue);

  const obj = function state(value) {
    if (arguments.length === 1) return obj.get(value);
    return obj.get();
  }

  Object.setPrototypeOf(obj, Signal.prototype);
  Object.defineProperty(obj, '__state', {
    value: sg,
    writable: true,
    enumerable: false,
    configurable: true
  });
  
  return obj;
}

export function computed(callback, dependencies) {
  const sg = new Signal('computed', { 
    computed: false,
    callback,
    dependencies: dependencies.map(d => ({ ref: d }))
  });

  const obj = function computed(value) {
    if (arguments.length === 1) return obj.get(value);
    return obj.get();
  }

  Object.setPrototypeOf(obj, Signal.prototype);
  Object.defineProperty(obj, '__state', {
    value: sg,
    writable: true,
    enumerable: false,
    configurable: true
  });

  dependencies.forEach(d => {
    d.__state.subscribed.push(obj);
  });

  return obj;
}



let count = state(4);
let even = state('even');
let odd = state('odd');

let isEven = computed(() => {
  console.log('isEven called')
  return (count() & 1) === 0
}, [count]);

let parity = computed(() => {
  console.log('parity called')
  return isEven() ? even() : odd()
}, [isEven, even, odd]);

let printParity = computed(() => {
  console.log('printParity called');
  return parity()
}, [parity]);


console.log(count(), isEven(), parity());


count(count() + 2);

console.log(count(), parity(), printParity());

count(count() + 3);

console.log(count(), parity());
console.log(count(), parity())
console.log(printParity());

even('evenn')
// count(count() + 3)
console.log(count(), parity(), isEven(), printParity());

// TODO: fix old value, dirty