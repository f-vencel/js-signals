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

const mustRecall = 1
const mayRecall = 2
const inRecall = 10
const checked = 0


let tracked = true
const activeListeners = []

// pushed the dependency for the most recent listener
function pushDependency(listener, sig, isStateSignal) {
  // if listener is an effect and dependency is a state, then we don't register it, as effects only have computed dependencies
  // only adds it if it doesn't already have the dependency
  if (!((listener.checked === inRecall) && isStateSignal) && !listener.dependencies.includes(sig)) { 
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


const possibleEffectQueue = []
const effectQueue = []

// determines if an effect needs to be called based on the dependencies
function evaluatePossibleEffects() {
  possibleEffectQueue.forEach(sig => {
    if (sig.checked === mustRecall) return

    // adds the effect to the effect-callbackQueue if some of its dependencies have changed
    if (!allDepsClean(sig)) effectQueue.push(getEffectCallbackFn(sig))
    else sig.checked = checked
  })
  possibleEffectQueue.length = 0
}
// calls the effects in the effect-callbackQueue
function computeEffects() {
  defaults.runEffectsFn(effectQueue)
  effectQueue.length = 0
}

export const defaults = {
  equal: defaultEqual,
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

function setToComputing(sig) {
  if (sig.value === $computing)
    throw new Error('cycle in signals\n//? (shouldn\'t be thrown, because this signal was already successfully computed before)')
  sig.value = $computing
}
// calls a computed signal's / effect's callback with dependency capturing
function callCallBackWithCapture(sig, isEffect) {
  // add listener to capture
  activeListeners.push(sig)
  if (isEffect) sig.checked = inRecall
  
  const newValue = sig.callback()
  
  activeListeners.pop()
  if (isEffect) sig.checked = checked

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
function evaluateComputed(sig) {
  if (sig.clean) return
  sig.clean = true

  // if dependencies are clean then we don't need to reevaluate the signal
  if (allDepsClean(sig)) return
  
  const oldValue = sig.value
  const newValue = callComputed(sig)

  // sets the new value if its not equal to the old value
  if (!sig.equal(oldValue, newValue)) {
    sig.value = newValue
    increaseVersion(sig)
  }
  else sig.value = oldValue
}
// calls the computed signal's callback, sets up the new dependencies (run on first access / on access when some of its dependencies change)
function callComputed(sig) {
  setToComputing(sig)
  
  // sets up the new dependencies, and updates the old dependencies if they are no longer a dependence

  const oldDependencies = setNewDependencies(sig)

  const newValue = callCallBackWithCapture(sig)

  checkOldDependencies(oldDependencies, sig)
  
  return newValue
}
// calls the effect's callback, sets up the new dependencies (run on initialization / when some of its dependencies change)
function callEffect(sig) {
  const oldDependencies = setNewDependencies(sig)

  const newValue = callCallBackWithCapture(sig, true)
  
  checkOldDependencies(oldDependencies, sig)
  
  return newValue
}

// returns the callback function for an effect
function getEffectCallbackFn(sig) {
  return () => sig.call(() => callEffect(sig))
}

// marks dirty the subscribed effects
function markEffectDirty(sig, fromState) {
  if (sig.checked === inRecall)
    throw new Error('loop in effect, effect sets signal(s) that cause(s) it to run\ncallback function: ' + sig.callback + '\n')
  if (sig.checked === mustRecall) return

  if (fromState) {
    sig.checked = mustRecall  // effect certainly needs to be recalled (async schedule, as in after the marking)
    effectQueue.push(getEffectCallbackFn(sig))
  }
  else {
    if (sig.checked === mayRecall) return

    sig.checked = mayRecall  // effect needs to be checked before recall (async check, as in after the marking)
    possibleEffectQueue.push(sig)
  }
}
// marks dirty the subscribed signals (a signal is dirty (not clean) if its dependencies may have changed)
function markSubscribedDirty(sig, fromState) {
  if (!tracked) return

  sig.subscribed.forEach(sub => {
    if (sub.type === 'effect') {
      markEffectDirty(sub, fromState)
      return
    }
    
    // if subscribed signal is clean we don't mark it, neither their subscribed signals
    if (!sub.clean) return

    sub.clean = false
    markSubscribedDirty(sub)
  })
}

function getSignal(sig) {
  return captureDependency(sig, true)
}
function setSignal(sig, value) {
  if (typeof value === 'function') value = value(sig.value)

  if (sig.equal(sig.value, value)) return sig.value

  sig.value = value
  increaseVersion(sig)

  markSubscribedDirty(sig, true)

  evaluatePossibleEffects()

  computeEffects()

  return value
}
function getComputed(sig) {
  if (sig.value === $computing)
    throw new Error('cycle in signals\ncallback function: ' + sig.callback + '\n')

  if (sig.value === $unset) return getUnsetComputed(sig)

  evaluateComputed(sig)
  return captureDependency(sig)
}
function getUnsetComputed(sig) {
  setUpDependencies(sig)

  sig.value = callComputed(sig)
  increaseVersion(sig)
      
  return captureDependency(sig)
}
function destroyEffect(sig) {
  sig.checked = mustRecall
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


export function signal(init, options) {
  const sig = function signal(value) {
    if (arguments.length === 1) return sig.set(value)
    return sig.get()
  }
  
  sig[$sigID] = {
    value: init,
    subscribed: [],
    equal: options?.equal ?? defaults.equal,
  }

  sig.get = () => getSignal(sig[$sigID])
  sig.set = (value) => setSignal(sig[$sigID], value)
  sig.toString = () => signalToString(sig[$sigID])

  return sig
}

export function computed(callback, options) {
  const sig = function computed() {
    return sig.get()
  }
  
  sig[$sigID] = {
    type: 'computed',
    value: $unset,
    callback,
    clean: true,
    subscribed: [],
    equal: options?.equal ?? defaults.equal
  }

  sig.get = () => getComputed(sig[$sigID])
  sig.toString = () => computedToString(sig[$sigID])

  return sig
}

export function effect(callback, options) {
  const effect = () => effect.run()
  
  effect[$sigID] = {
    type: 'effect',
    callback,
    call:
      (options?.call === 'async')
        ? defaults.asyncEffectFn
        : options?.call ?? (defaults.async ? defaults.asyncEffectFn : defaults.syncEffectFn),
  }
  // effect only has computed as dependencies

  effect.destroy = () => destroyEffect(effect[$sigID])
  effect.run = getEffectCallbackFn(effect[$sigID])
  effect.toString = () => effectToString(effect[$sigID])

  setUpDependencies(effect[$sigID])
  effect.run()

  return effect
}

export function untrack(callback) {
  if (tracked) {
    tracked = false
    callback()
    tracked = true
  }
  else {
    callback()
  }
}