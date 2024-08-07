// import analyzeFunction from './analyze.js';

const sigID = Symbol('sigID');


function Signal(initialValue) {
  Object.assign(this, initialValue);
  //this.subscribed = [];
  
  // computed
  // clean
  // callback
  // dependencies
  // 
}
Object.defineProperty(Signal, 'markDirty', {
  value: function dirty(state) {
    state.subscribed.forEach(({ __state: s}) => {
      if (s.type === 'effect') s.callback();
      else if (s.clean) {
        s.clean = false;
        dirty(s);
      }
    });
  },
  writable: true,
  enumerable: false,
  configurable: true,
});
Object.defineProperty(Signal, 'eq', {
  value: function eq(a, b) {
    return a === b;
  },
  writable: true,
  enumerable: false,
  configurable: true,
});
Object.defineProperty(Signal, 'isSignal', {
  value: function isSignal(sig) {
    if (typeof sig !== 'function') return false;
    return sig[sigID] === true;
  },
  writable: true,
  enumerable: false,
  configurable: true,
});

function stateGet(value) {
  const state = this.__state;

  if (arguments.length === 1) {
    if (typeof value === 'function') value = value(state.value);

    if (Signal.eq(state.value, value)) return value;

    state.value = value;
    Signal.markDirty(state);

    return value;
  }

  return state.value;
}
function computedGet() {
  const state = this.__state;

  // doesn't have value
  if (state.computed === 'pending') throw new Error('circular reference between signals');
  if (!state.computed) {
    state.computed = 'pending';
    state.dependencies.forEach(d => {
      d.value = d.ref();
    });
    
    const newValue = state.callback();
    state.value = newValue;
    state.computed = true;
    if (!state.clean) state.clean = true;
    
    return newValue;
  }

  // has value
  if (state.clean) return state.value;

  function hasDepsChanged(state) {
    const dependencies = state.dependencies;

    let allClean = true;
    for (let i = 0; i < dependencies.length; i++) {
      const d = dependencies[i];
      
      // state
      if (d.ref.__state.type === 'state') {
        if (!Signal.eq(d.value, d.ref.__state.value)) {
          d.value = d.ref.__state.value;
          allClean = false;
        }
      }
      // computed
      else {
        if (d.ref.__state.clean) {
          if (!Signal.eq(d.value !== d.ref.__state.value)) {
            d.value = d.ref.__state.value;
            allClean = false;
          }
        }
        else {
          d.value = d.ref.get();
          allClean = false;
        }
      }
    }
    
    if (allClean) return false;
    return true;
  }

  state.clean = true;

  if (!hasDepsChanged(state)) return state.value;
  
  const newValue = state.callback();
  if (Signal.eq(state.value, newValue)) return newValue;
  
  state.value = newValue;
  
  return newValue;
}
function runEffect() {
  return this.__state.callback();
}

Object.defineProperty(Signal, 'state', {
  value: {
    get: stateGet,
    set: stateGet
  },
  writable: true,
  enumerable: false,
  configurable: true,
});
Object.defineProperty(Signal, 'computed', {
  value: {
    get: computedGet
  },
  writable: true,
  enumerable: false,
  configurable: true,
});
Object.defineProperty(Signal, 'effect', {
  value: {
    call: runEffect,
    run: runEffect
  },
  writable: true,
  enumerable: false,
  configurable: true,
});


function setUpSignal(sig, state, proto) {
  Object.setPrototypeOf(sig, proto);
  Object.defineProperty(sig, '__state', {
    value: state,
    writable: true,
    enumerable: false,
    configurable: true
  });
  Object.defineProperty(sig, sigID, {
    value: true,
    writable: true,
    enumerable: false,
    configurable: true
  });
}


export function state(initialValue) {
  const sg = new Signal({
    type: 'state', 
    value: initialValue,
    subscribed: []
  });

  const obj = function state(value) {
    if (arguments.length === 1) return obj.get(value);
    return obj.get();
  }

  setUpSignal(obj, sg, Signal.state);
  
  return obj;
}
export function computed(callback, dependencies) {
  if (!Array.isArray(dependencies)) throw new Error('dependencies are not signals');;
  dependencies.forEach(d => {
    if (!Signal.isSignal(d)) throw new Error('dependencies are not signals');
  })

  const sg = new Signal({
    type: 'computed',
    computed: false,
    clean: true,
    callback,
    dependencies: dependencies.map(d => ({ ref: d })),
    subscribed: []
  });

  const obj = function computed() {
    return obj.get();
  }

  setUpSignal(obj, sg, Signal.computed);

  dependencies.forEach(d => {
    d.__state.subscribed.push(obj);
  });

  return obj;
}
export function effect(callback, dependencies) {
  if (!Array.isArray(dependencies)) throw new Error('dependencies are not signals');;
  dependencies.forEach(d => {
    if (!Signal.isSignal(d)) throw new Error('dependencies are not signals');
  })

  const sg = new Signal({
    type: 'effect',
    callback
  });

  const obj = callback;
  
  Object.setPrototypeOf(obj, Signal.effect);
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


const coun = state([undefined, 7]);


let e = effect(() => {
  console.log('effect called', coun()[1]);
}, [coun]);


coun(([p, t]) => [t, t + 1]);
