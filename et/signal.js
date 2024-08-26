// TODO: remove implicit dependencies at declaration of computed signals, ->
// -> making them explicit. Possibly by using code analizer. ->
// -> // import analyzeFunction from './analyze.js';  // ?: not functional
// UPDATE:
// see `signal2.js` for details

const sigID = Symbol('signalID');


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
  if (!Signal.eq(state.value, newValue)) {
    state.value = newValue;

    state.subscribed.forEach(({ __state: s }) => {
      if (s.type === 'effect') {
        s.changed = true;
      }
    });
  }

  return newValue;
}
function calculateComputed(state) {
  if (allDepsClean(state)) return;

  const newValue = state.callback();
  if (!Signal.eq(state.value, newValue)) {
    state.value = newValue;

    state.subscribed.forEach(({ __state: s }) => {
      if (s.type === 'effect') {
        s.changed = true;
      }
    });
  }
}

function computeEffects(callbackQueue) {
  callbackQueue.active.forEach(a => {
    calculateComputed(a);
    a.clean = true;
  });

  const newCallbackQueue = [];
  callbackQueue.effect.forEach(e => {
    if (e.changed) {
      e.changed = false;
      newCallbackQueue.push(e.callback);
    }
  })

  Signal.runEffects(newCallbackQueue);
}

function markDirty(state, queue, isState) {
  state.subscribed.forEach(({ __state: sub}) => {
    if (sub.type === 'effect') {
      if (isState) sub.changed = true;
      queue.effect.push(sub);
      return;
    }
    
    if (!sub.clean) return;

    if (sub.computed === 'active') queue.active.push(sub);

    sub.clean = false;
    markDirty(sub, queue);
  });

  return queue;
}


export default function Signal(type, initialValue) {
  this.type = type;

  switch (type) {
    case 'computed': {
      this.callback = initialValue.callback;
      this.subscribed = [];

      if (initialValue.mode === 'active' || initialValue.mode === true) {
        this.computed = 'active';
        this.clean = true;
        this.dependencies = initialValue.dependencies.map(d => {
          d.__state.subscribed.push(initialValue.obj);
          return { ref: d, value: d.get() };
        });
      }
      else {
        this.computed = false;
        this.clean = true;
        this.dependencies = initialValue.dependencies.map(d => {
          d.__state.subscribed.push(initialValue.obj);
          return { ref: d };
        });
      }
      break;
    }
    case 'state':{
      this.value = initialValue;
      this.subscribed = [];
      break;
    }
    case 'effect': {
      this.callback = initialValue.callback;
      this.dependencies = this.dependencies = initialValue.dependencies.map(d => {
        d.__state.subscribed.push(initialValue.obj);
        return { ref: d, value: d.get() };
      });
    }
  }
}

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

function setUpSignal(sig, state, proto, noID) {
  Object.setPrototypeOf(sig, proto);
  Object.defineProperty(sig, '__state', {
    value: state,
    writable: true,
    enumerable: false,
    configurable: true
  });

  if (noID) return
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
  callbackQueue.forEach(e => e());
}
Signal.state = state;
Signal.computed = computed;
Signal.effect = computed;


function stateGet(value) {
  const state = this.__state;

  if (arguments.length === 0) return state.value;

  // set
  if (typeof value === 'function') value = value(state.value);

  if (Signal.eq(state.value, value)) return value;

  state.value = value;

  const callbackQueue = markDirty(state, { active: [], effect: [] }, true);
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
  if (!Array.isArray(dependencies)) dependencies = [dependencies];
  dependencies.forEach(d => {
    if (!Signal.isSignal(d)) throw new Error('dependencies are not signals');
  })

  const obj = function computed() {
    return obj.get();
  }
  
  const sg = new Signal('computed', { callback, dependencies, mode, obj });
  setUpSignal(obj, sg, Signal.computedProto);

  if (mode === 'active' || mode === true) sg.value = callback();
    
  return obj;
}
export function effect(callback, dependencies, initialRun) {
  if (!Array.isArray(dependencies)) dependencies = [dependencies];
  dependencies.forEach(d => {
    if (!Signal.isSignal(d)) throw new Error('dependencies are not signals');
  })

  const obj = function effect() {
    return obj.run();
  };
  
  const sg = new Signal('effect', { callback, dependencies, obj });
  setUpSignal(obj, sg, Signal.effectProto, true);
  
  if (initialRun) callback();

  return obj;
}



