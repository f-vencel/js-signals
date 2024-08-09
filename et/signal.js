// TODO: remove implicit dependencies at declaration of computed signals, ->
// -> making them exolicit. Possibly by using code analizer. ->
// -> // import analyzeFunction from './analyze.js';  // ?: not functional

const sigID = Symbol('sigID');


function allDepsClean(state) {
  let allClean = true;

  state.dependencies.forEach(d => {
    const dRefState = d.ref.__state;
    
    if (dRefState.computed === 'active' || (dRefState.type === 'computed' && !dRefState.clean)) {
      calculateComputed(dRefState);
      dRefState.clean = true;
    }
    if (!Signal.eq(d.value, dRefState.value)) {
      d.value = dRefState.value;
      allClean = false;
    }
  });
  
  return allClean;
}
function evaluateComputed(state) {
  if (allDepsClean(state)) return state.value;
  
  const newValue = state.callback();
  if (!Signal.eq(state.value, newValue)) state.value = newValue;

  return newValue;
}
function calculateComputed(state) {
  if (allDepsClean(state)) return;

  const newValue = state.callback();
  if (!Signal.eq(state.value, newValue)) state.value = newValue;
}

function computeEffects(callbackQueue) {
  callbackQueue.active.forEach(a => {
    calculateComputed(a);
    a.clean = true;
  });

  const newCallbackQueue = [];
  callbackQueue.effect.forEach(e => {
    if (!allDepsClean(e)) newCallbackQueue.push(e);
  })

  Signal.runEffects(newCallbackQueue);
}

export function Signal(type, initialValue) {
  this.type = type;

  switch (type) {
    case 'computed': {
      this.callback = initialValue[0];
      this.subscribed = [];

      if (initialValue[2] === 'active' || initialValue[2] === true) {
        this.computed = 'active';
        this.clean = true;
        this.dependencies = initialValue[1].map(d => ({ ref: d, value: d.get() }));
      }
      else {
        this.computed = false;
        this.clean = true;
        this.dependencies = initialValue[1].map(d => ({ ref: d }));
      }
      break;
    }
    case 'state':{
      this.value = initialValue;
      this.subscribed = [];
      break;
    }
    case 'effect': {
      this.callback = initialValue[0];
      this.dependencies = initialValue[1].map(d => ({ ref: d }));
    }
  }
}
Object.defineProperty(Signal, 'markDirty', {
  value: function markDirty(state, queue) {
    state.subscribed.forEach(({ __state: sub}) => {
      if (sub.type === 'effect') {
        queue.effect.push(sub);
        return;
      }
      
      if (!sub.clean) return;

      if (sub.computed === 'active') queue.active.push(sub);

      sub.clean = false;
      markDirty(sub, queue);
    });

    return queue;
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

Object.defineProperty(Signal, 'stateProto', {
  value: {
    get: stateGet,
    set: stateGet
  },
  writable: true,
  enumerable: false,
  configurable: true,
});
Object.defineProperty(Signal, 'computedProto', {
  value: {
    get: computedGet
  },
  writable: true,
  enumerable: false,
  configurable: true,
});
Object.defineProperty(Signal, 'effectProto', {
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


Signal.eq = function eq(a, b) {
  return a === b;
}
Signal.runEffects = function runEffects(callbackQueue) {
  callbackQueue.forEach(e => e.callback());
}


function stateGet(value) {
  const state = this.__state;

  if (arguments.length === 0) return state.value;

  // set
  if (typeof value === 'function') value = value(state.value);

  if (Signal.eq(state.value, value)) return value;

  state.value = value;

  const callbackQueue = Signal.markDirty(state, { active: [], effect: [] });
  computeEffects(callbackQueue);

  return value;
}
function computedGet() {
  const state = this.__state;

  // active / has value
  if (state.computed) {
    if (state.clean) return state.value;

    state.clean = true;

    return evaluateComputed(state);
  }

  // doesn't have value
  state.dependencies.forEach(d => {
    d.value = d.ref.get();
  });
  
  const newValue = state.callback();
  state.value = newValue;

  state.computed = true;
  if (!state.clean) state.clean = true;
  
  return newValue;
}
function runEffect() {
  return this.__state.callback();
}


export function state(initialValue) {
  const obj = function state(value) {
    if (arguments.length === 1) return obj.get(value);
    return obj.get();
  }
  
  const sg = new Signal('state', initialValue);
  setUpSignal(obj, sg, Signal.stateProto);
  
  return obj;
}
export function computed(callback, dependencies, mode) {
  if (!Array.isArray(dependencies)) throw new Error('dependency is not an array');;
  dependencies.forEach(d => {
    if (!Signal.isSignal(d)) throw new Error('dependencies are not signals');
  })

  const obj = function computed() {
    return obj.get();
  }

  const sg = new Signal('computed', arguments);
  setUpSignal(obj, sg, Signal.computedProto);

  dependencies.forEach(d => {
    d.__state.subscribed.push(obj);
  });

  if (mode === 'active' || mode === true) {
    sg.value = callback();
  }
    
  return obj;
}
export function effect(callback, dependencies, initialRun) {
  if (!Array.isArray(dependencies)) throw new Error('dependency is not an array');;
  dependencies.forEach(d => {
    if (!Signal.isSignal(d)) throw new Error('dependencies are not signals');
  })

  const obj = callback;
  
  const sg = new Signal('effect', arguments);
  Object.setPrototypeOf(obj, Signal.effectProto);
  Object.defineProperty(obj, '__state', {
    value: sg,
    writable: true,
    enumerable: false,
    configurable: true
  });

  dependencies.forEach(d => {
    d.__state.subscribed.push(obj);
  });

  if (initialRun) callback();

  return obj;
}


const count = state(10);
const countMod2 = computed(() => count() % 2, [count]);


const e = effect(() => {
  console.log('count mod 2: ' + countMod2());
  return 'hey';
}, [countMod2]);

count(count() + 1)
count(count() + 4)


