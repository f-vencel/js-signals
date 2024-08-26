//signal2.js

const $sigID = Symbol('sigID')
const $unset = Symbol('unset')
const $computing = Symbol('computing')

const mustRecall = 1
const mayRecall = 2
const inRecall = 10


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
    if (!allDepsClean(sig)) effectQueue.push(effectCallbackFn(sig))
    else sig.checked = 0
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
  if (isEffect) sig.checked = 0

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
  const newValue = callBackComputed(sig)

  // sets the new value if its not equal to the old value
  if (!sig.equal(oldValue, newValue)) {
    sig.value = newValue
    increaseVersion(sig)
  }
  else sig.value = oldValue
}
// calls the computed signal's callback, sets up the new dependencies (run on first access / on access when some of its dependencies change)
function callBackComputed(sig) {
  setToComputing(sig)
  
  // sets up the new dependencies, and updates the old dependencies if they are no longer a dependence

  const oldDependencies = setNewDependencies(sig)

  const newValue = callCallBackWithCapture(sig)

  checkOldDependencies(oldDependencies, sig)
  
  return newValue
}
// calls the effect's callback, sets up the new dependencies (run on initialization / when some of its dependencies change)
function callBackEffect(sig) {
  const oldDependencies = setNewDependencies(sig)

  const newValue = callCallBackWithCapture(sig, true)
  
  checkOldDependencies(oldDependencies, sig)
  
  return newValue
}

// returns the callback function for an effect
function effectCallbackFn(sig) {
  return () => sig.call(() => callBackEffect(sig))
}

// marks dirty the subscribed effects
function markEffectDirty(sig, fromState) {
  if (fromState) {
    if (sig.checked === mustRecall) return

    sig.checked = mustRecall  // effect certainly needs to be recalled (async schedule, as in after the marking)
    effectQueue.push(effectCallbackFn(sig))
  }
  else {
    if (sig.checked) return

    sig.checked = mayRecall  // effect needs to be checked before recall (async check, as in after the marking)
    possibleEffectQueue.push(sig)
  }
}
// marks dirty the subscribed signals (a signal is dirty (not clean) if its dependencies may have changed)
function markSubscribedDirty(sig, fromState) {
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

  sig.value = callBackComputed(sig)
  increaseVersion(sig)
      
  return captureDependency(sig)
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

  effect.run = effectCallbackFn(effect[$sigID])
  effect.toString = () => effectToString(effect[$sigID])

  setUpDependencies(effect[$sigID])
  effect.run()

  return effect
}