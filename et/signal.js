// import analyzeFunction from './analyze.js';


function Signal(initialValue) {
  Object.assign(this, initialValue);
  this.subscribed = [];
  
  // computed
  // clean
  // callback
  // dependencies
  // 
}
Object.defineProperty(Signal, 'dirtyDependencies', {
  value: function dirty(state) {
    state.subscribed.forEach(({ __state: s }) => {
      if (s.clean) {
        s.clean = false;
        dirty(s);
      }
    });
  },
  writable: true,
  enumerable: false,
  configurable: true,
});

function stateGet(value) {
  const state = this.__state;

  if (arguments.length === 1) {
    if (state.value === value) return value;

    Signal.dirtyDependencies(state);
    return state.value = value;
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

  state.clean = 'pending';

  function hasDepsChanged(state) {
    const dependencies = state.dependencies;

    let allClean = true;
    for (let i = 0; i < dependencies.length; i++) {
      const d = dependencies[i];
      
      // state
      if (d.ref.__state.type === 'state') {
        if (d.value !== d.ref.__state.value) {
          d.value = d.ref.__state.value;
          allClean = false;
        }
      }
      // computed
      else {
        if (d.ref.__state.clean) {
          if (d.value !== d.ref.__state.value) {
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
  if (state.value === newValue) return newValue;
  
  state.value = newValue;
  
  return newValue;
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


export function state(initialValue) {
  const sg = new Signal({
    type: 'state', 
    value: initialValue
  });

  const obj = function state(value) {
    if (arguments.length === 1) return obj.get(value);
    return obj.get();
  }

  Object.setPrototypeOf(obj, Signal.state);
  Object.defineProperty(obj, '__state', {
    value: sg,
    writable: true,
    enumerable: false,
    configurable: true
  });
  
  return obj;
}
export function computed(callback, dependencies) {
  const sg = new Signal({
    type: 'computed',
    computed: false,
    clean: true,
    callback,
    dependencies: dependencies.map(d => ({ ref: d }))
  });

  const obj = function computed(value) {
    if (arguments.length === 1) return obj.get(value);
    return obj.get();
  }

  Object.setPrototypeOf(obj, Signal.computed);
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




