// signals.js
//
//
// Description: 
// 
// An implementation of signals in javascript inspired by the angular framework
// It provides functions (signal, computed) to store states and computed values
// It also provides an effect function to set effects that run on change of thier dependencies
// You can set equality functions,
// You can also set callback functions on computed values and effects to call them asynchronously
//
//
// 
// 
// Licence: 
//
// “Commons Clause” License Condition v1.0
//
// The Software is provided to you by the Licensor under the License, as defined below, subject to the following condition.
//
// Without limiting other conditions in the License, the grant of rights under the License will not include, and the License does not grant to you, the right to Sell the Software.
//
// For purposes of the foregoing, “Sell” means practicing any or all of the rights granted to you under the License to provide to third parties, for a fee or other consideration (including without limitation fees for hosting or consulting/ support services related to the Software), a product or service whose value derives, entirely or substantially, from the functionality of the Software. Any license notice or attribution required by the License must also include this Commons Clause License Condition notice.
//
// License: [i.e. Apache 2.0]
//
//



const $sigID = Symbol('sigID')
const $unset = Symbol('unset')
const $computing = Symbol('computing')
const $computed = Symbol('computed')

const $inQueue = Symbol('inQueue')
const $mayRecall = Symbol('mayRecall')
const $paused = Symbol('paused')


let tracking = true
const activeListeners = []

const possibleEffectQueue = []
const effectQueue = []


// pushed the dependency for the most recent listener
function pushDependency(listener, sig, isStateSignal) {
  // if listener is an effect and dependency is a state, then we don't register it, as effects only have computed dependencies
  // as of now, computed signals also only have computed dependencies 
  // only adds it if it doesn't already have the dependency
  if (!(isStateSignal) && !listener.dependencies.includes(sig)) { 
    listener.dependencies.push(sig)
    listener.dependencyValues.push(sig.value)
    listener.dependencyVersions.push(sig.version)
  }

  // listener subscribes to the signal (if not already)
  if (!sig.subscribed.includes(listener)) {
    sig.subscribed.push(listener)
  }
}
// captures the dependency for the most recent listener (called when a signal is accessed)
// returns the value of the signal
function captureDependency(sig, isStateSignal) {
  if (activeListeners.length === 0) return sig.value

  const listener = activeListeners[activeListeners.length - 1]

  pushDependency(listener, sig, isStateSignal)
  
  return sig.value
}
function increaseVersion(sig) {
  sig.version ??= 0
  sig.version++
  if (sig.version === Number.MAX_SAFE_INTEGER) sig.version = 0
}



// determines if an effect needs to be called based on the dependencies
function evaluatePossibleEffects() {
  possibleEffectQueue.forEach(sig => {
    if (sig.value === $inQueue) return

    // adds the effect to the effect-callbackQueue if some of its dependencies have changed
    if (!allDepsClean(sig)) {
      sig.value = $inQueue
      effectQueue.push(sig.run)
    }
    else sig.value = $computed
  })
  possibleEffectQueue.length = 0
}
// calls the effects in the effect-callbackQueue
function runEffects() {
  if (effectQueue.length === 0) return

  const copyQueue = effectQueue.slice()
  effectQueue.length = 0

  defaults.runEffectsFn(copyQueue)
}

export const defaults = {
  equal: defaultEqual,
  deepEqual,
  syncEffectFn: defaultSyncEffectFn,
  asyncEffectFn: defaultAsyncEffectFn,
  async: false,
  runEffectsFn: (fnArray) => {
    fnArray.forEach(fn => fn())
  }
}
function defaultEqual(a, b) {
  return Object.is(a, b)
}
function deepEqual(a, b) {
  if (a === b) return true

  if (typeof(a) !== typeof(b)) return false

  if (Object.is(a, b)) return true
  
  if (typeof(a) !== 'object') return false

  const aKeys = Object.getOwnPropertyNames(b)
  const bKeys = Object.getOwnPropertyNames(b)

  if (aKeys.length !== bKeys.length) return false

  for (let k in aKeys) {
    if (!bKeys.includes(k)) return false
    if (!deepEqual(a[k], b[k])) return false
  }

  return true
}
function defaultSyncEffectFn(fn) {
  return fn()
}
function defaultAsyncEffectFn(fn) {
  queueMicrotask(fn)
}

// checks if all the dependencies of a computed signal are clean
function allDepsClean(sig) {
  for (let i = 0; i < sig.dependencies.length; i++) {
    const dep = sig.dependencies[i]
    
    // if dependency version or value is different then dependency is not clean
    if ((dep.version !== sig.dependencyVersions[i]) || !dep.equal(dep.value, sig.dependencyValues[i])) return false
      
    // evaluates computed dependency (because it might be stale)
    if ((dep.type === 'computed') && !dep.clean) {
      evaluateComputed(dep)

      if ((dep.version !== sig.dependencyVersions[i]) || !dep.equal(dep.value, sig.dependencyValues[i])) return false
    }
  }

  return true
}
// checks if the oldDependencies are still dependencies of a signal, if not the old dependency unsubscribes
function checkOldDependencies(oldDependencies, sig) {
  oldDependencies.forEach(dep => {
    if (!sig.dependencies.includes(dep)) {
      dep.subscribed.splice(dep.subscribed.indexOf(sig), 1)
    }
  })
}
function checkIndirectSignals(sig) {
  for (const state of sig.indirectSignals ?? []) {
    state.indirectEffects.splice(state.indirectEffects.indexOf(sig), 1)
    sig.indirectSignals.splice(sig.indirectSignals.indexOf(state), 1)
  }
}

function setToComputing(sig) {
  if (sig.value === $computing)
    throw new Error('cycle in signals\n//? (shouldn\'t be thrown, because this signal was already successfully called before)')
  sig.value = $computing
}
function setToComputed(sig) {
  sig.value = $computed
}
// calls a computed signal's / effect's callback with dependency capturing
function callCallBackWithCapture(sig, options) {
  setToComputing(sig)

  // add listener to capture
  activeListeners.push(sig)
  
  const newValue = sig.callback(options)
  
  activeListeners.pop()

  setToComputed(sig)

  return newValue
}

function setUpDependencies(sig) {
  sig.dependencies = []
  sig.dependencyValues = []
  sig.dependencyVersions = []
}
function setNewDependencies(sig) {
  const oldDependencies = sig.dependencies
  sig.dependencies = []
  sig.dependencyValues.length = 0
  sig.dependencyVersions.length = 0
  
  return oldDependencies
}

// evaluates a computed signal if its not clean (it becomes clean after evaluation)
function evaluateComputed(sig, options) {
  if (sig.clean && !options?.noCache) return
  sig.clean = true

  // if dependencies are clean then we don't need to reevaluate the signal
  if (!sig.veryDirty && !options?.noCache && allDepsClean(sig)) return
  sig.veryDirty = false
  
  const oldValue = sig.value
  const newValue = callComputed(sig)

  // sets the new value if its not equal to the old value
  if (!sig.equal(oldValue, newValue)) {
    sig.value = newValue
    increaseVersion(sig)
  }
  else sig.value = oldValue
}
// calls the computed signal's callback, sets up the new dependencies (run on first access / on access when its dependencies change)
function callComputed(sig) {  
  // sets up the new dependencies, and updates the old dependencies if they are no longer a dependence
  const oldDependencies = setNewDependencies(sig)

  const options = {
    onFirst: (callback) => {
      if (sig.value !== $unset) return
      callback()
    },
    onNotFirst: (callback) => {
      if (sig.value === $unset) return
      callback()
    },
  }

  const newValue = callCallBackWithCapture(sig, options)

  checkOldDependencies(oldDependencies, sig)
  
  return newValue
}
// calls the effect's callback, sets up the new dependencies (run on initialization / when its dependencies change)
function callEffect(sig) {
  const oldDependencies = setNewDependencies(sig)

  const options = {
    onDestroy: (callback) => {
      if (sig.onDestroy) return
      sig.onDestroy = callback ?? (() => {})
    },
    onKill: (callback) => {
      if (sig.onDestroy) return
      sig.onDestroy = callback ?? (() => {})
    },
    onLoop: (callback) => {
      if (sig.onLoop) return
      sig.onLoop = callback ?? (() => true)
    },
    onInit: (callback) => {
      if (sig.value !== $unset) return
      callback()
    },
    onNotInit: (callback) => {
      if (sig.value === $unset) return
      callback()
    },
    onFirst: (callback) => {
      if (sig.value !== $unset) return
      callback()
    },
    onNotFirst: (callback) => {
      if (sig.value === $unset) return
      callback()
    },
  }

  const newValue = callCallBackWithCapture(sig, options)
  
  checkOldDependencies(oldDependencies, sig)
  checkIndirectSignals(sig)
  
  return newValue
}

// returns the callback function for an effect
function getEffectCallbackFn(sig) {
  return () => sig.call(() => callEffect(sig))
}

function signalChangeEffect(sig) {
  increaseVersion(sig)

  markSubscribedDirty(sig, true, sig)
  markIndirectEffects(sig)

  evaluatePossibleEffects()

  runEffects()
}

// marks dirty the subscribed effects
function markEffectDirty(sig, fromState, state) {
  if (sig.value === $computing) {
    if (sig.onLoop) {
      if (!sig.onLoop()) return
    }
    else
      throw new Error('loop in effect, effect sets signal(s) that cause(s) it to run in a loop\ncallback function: ' + sig.callback + '\n')
  }

  if (sig.value === $inQueue) return
  if (sig.value === $paused) {
    state.indirectEffects ??= []
    sig.indirectSignals ??= []

    if (!state.indirectEffects.includes(sig)) state.indirectEffects.push(sig)
    if (!sig.indirectSignals.includes(sig)) sig.indirectSignals.push(state)
    return
  }

  if (fromState) {
    sig.value = $inQueue  // effect certainly needs to be recalled (async schedule, as in after the marking)
    effectQueue.push(sig.run)
  }
  else {
    if (sig.value === $mayRecall) return

    sig.value = $mayRecall  // effect needs to be checked before recall (async check, as in after the marking)
    possibleEffectQueue.push(sig)
  }
}
// marks dirty the subscribed signals (a signal is dirty (not clean) if its dependencies may have changed)
function markSubscribedDirty(sig, fromState, state) {
  if (!tracking) return

  sig.subscribed.forEach(sub => {
    if (sub.type === 'effect') {
      markEffectDirty(sub, fromState, state)
      return
    }
    
    if (fromState) sub.veryDirty = true
    
    // if subscribed signal is clean we don't mark it, neither their subscribed signals (because they have already been marked dirty)
    if (!sub.clean) return

    sub.clean = false
    markSubscribedDirty(sub, false, state)
  })
}
function markIndirectEffects(sig) {
  for (const effect of sig.indirectEffects ?? []) {
    if (effect.value !== $paused) markEffectDirty(effect, false, sig)
  }
}

function getSignal(sig) {
  return captureDependency(sig, true)
}
function setSignal(sig, value, update) {
  if (update) {
    value(sig.value)
    return
  }
  else if (typeof value === 'function') value = value(sig.value)

  if (sig.equal(sig.value, value)) return sig.value

  sig.value = value

  signalChangeEffect(sig)

  return value
}
function getComputed(sig, options) {
  if (sig.value === $computing)
    throw new Error('cycle in signals\ncallback function: ' + sig.callback + '\n')

  if (sig.value === $unset) return getUnsetComputed(sig)

  evaluateComputed(sig, options)

  return captureDependency(sig)
}
function getUnsetComputed(sig) {
  setUpDependencies(sig)

  sig.value = callComputed(sig)
  increaseVersion(sig)
      
  return captureDependency(sig)
}
function destroyEffect(sig) {
  pauseEffect(sig)

  for (const dependency of sig.dependencies) {
    dependency.subscribed.splice(dependency.subscribed.indexOf(sig), 1)
  }

  sig.call = (() => {})
  sig.onDestroy?.()
}
function pauseEffect(sig) {
  sig.value = $paused
}
function resumeEffect(sig) {
  sig.value = $computed
}


function signalToString(sig) {
  return `[signal ${sig.value}]`
}
function computedToString(sig) {
  return `[computed ${getComputed(sig)}]`
}
function effectToString(sig) {
  return `[effect: ${sig.callback}]`
}


function signal(init, options) {
  const signal = function (value) {
    if (arguments.length === 1) return signal.set(value)
    return signal.get()
  }
  
  const sigID = signal[$sigID] = {
    value: init,
    subscribed: [],
    equal: options?.equal ?? defaults.equal,
  }

  signal.asreadonly = () => computed(() => getSignal(sigID))
  signal.ascomputed = signal.asreadonly
  signal.forceChange = () => signalChangeEffect(sigID)
  signal.get = () => getSignal(sigID)
  signal.set = (value) => setSignal(sigID, value)
  signal.update = (value) => setSignal(sigID, value, true)
  signal.toString = () => signalToString(sigID)

  return signal
}
signal.fromObject = function (obj, options) {
  if (typeof(obj) !== 'object' && typeof(obj) !== 'function') throw new Error('signal initial state is not an object')

  for (const key in obj) {
    if (typeof(obj[key]) === 'object' || typeof(obj[key]) === 'object') {
      obj[key] = signal.fromObject(obj[key], options)
    }
    else {
      obj[key] = signal(obj[key], options)
    }
  }

  return computed(() => {
    for (const key in obj) obj[key]()
    return obj
  })
}
export { signal }


export function computed(callback, options) {
  const computed = (options) => computed.get(options)
  
  const sigID = computed[$sigID] = {
    type: 'computed',
    value: $unset,
    callback,
    clean: true,
    subscribed: [],
    equal: options?.equal ?? defaults.equal
  }
  // computed signals only has computed signals as dependencies

  computed.get = (options) => getComputed(sigID, options)
  computed.toString = () => computedToString(sigID)

  return computed
}

export function effect(callback, options) {
  const effect = () => effect.run()

  const callFn = options?.call ?? ((fn) => fn())
  
  const sigID = effect[$sigID] = {
    type: 'effect',
    value: $unset,
    callback,
    call: (options?.async)
      ? (fn) => defaults.asyncEffectFn(() => callFn(fn))
      : (fn) => defaults.syncEffectFn(() => callFn(fn)),

    onDestroy: options?.onDestroy,
    onLoop: options?.onLoop
  }
  sigID.run = getEffectCallbackFn(sigID)
  // effect only has computed signals as dependencies

  effect.destroy = () => destroyEffect(sigID)
  effect.kill = effect.destroy
  effect.pause = () => pauseEffect(sigID)
  effect.stop = effect.pause
  effect.halt = effect.pause
  effect.resume = () => resumeEffect(sigID)
  effect.continue = effect.resume

  effect.run = sigID.run
  effect.toString = () => effectToString(sigID)

  setUpDependencies(sigID)
  effect.run()

  return effect
}

export function untrack(callback) {
  if (tracking) {
    tracking = false
    callback()
    tracking = true
  }
  else {
    callback()
  }
}
export function track(callback) {
  if (!tracking) {
    tracking = true
    callback()
    tracking = false
  }
  else {
    callback()
  }
}