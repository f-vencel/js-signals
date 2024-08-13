//signal2.js

const $sigID = Symbol('sigID')
const $unset = Symbol('unset')
const $computing = Symbol('computing')

const mustRecall = 1
const mayRecall = 2
const exsigs = 10


const activeListeners = []

function captureDependency(sig, isSignal) {
  if (activeListeners.length === 0) return sig.value

  const listener = activeListeners[activeListeners.length - 1]

  if ((listener.checked !== exsigs) || !isSignal) { 
    listener.dependencies.push(sig)
    listener.dependencyValues.push(sig.value)
  }

  if (!sig.subscribed.includes(listener)) {
    sig.subscribed.push(listener)
  }
  
  return sig.value
}


const possibleEffectQueue = []
const effectQueue = []

function evaluatePossibleEffects() {
  possibleEffectQueue.forEach(sig => {
    if (sig.checked === mustRecall) return

    if (!allDepsClean(sig))
      effectQueue.push(sig)

    sig.checked = 0
  })
  possibleEffectQueue.length = 0
}
function computeEffects() {
  if (defaults.runAllEffectsAsync) {
    defaults.runAllEffectsAsyncFn(effectQueue.map(fn => {
      fn.checked = 0
      return () => callBackEffect(fn)
    }))
    return
  }

  effectQueue.forEach(fn => {
    fn.checked = 0
    fn.call(() => callBackEffect(fn))
  })
  effectQueue.length = 0
}

export const defaults = {
  defaultEqual,
  defaultFnCall,
  defaultAsyncFnCall,
  runAllEffectsAsync: false,
  runAllEffectsAsyncFn: (fnArray) => {
    Promise.all(fnArray.map(fn => Promise.resolve().then(fn)))
  }
}

function defaultEqual(a, b) {
  return Object.is(a, b)
}
function defaultFnCall(fn) {
  fn()
}
function defaultAsyncFnCall(fn) {
  queueMicrotask(fn)
}

function allDepsClean(sig) {
  for (let i = 0; i < sig.dependencies.length; i++) {
    const dep = sig.dependencies[i]
    
    if (!dep.equal(dep.value, sig.dependencyValues[i])) return false
    
    if (dep.type === 'computed') {
      if (!dep.clean) evaluateComputed(dep)

      if (!dep.equal(dep.value, sig.dependencyValues[i])) return false
    }
  }

  return true
}

function evaluateComputed(sig) {
  sig.clean = true

  if (allDepsClean(sig)) return
  
  const oldValue = sig.value
  const newValue = callBackComputed(sig)

  if (!sig.equal(oldValue, newValue)) sig.value = newValue
  else sig.value = oldValue
}
function callBackComputed(sig) {
  if (sig.value === $computing)
    throw new Error('cycle in signals\n//? (shouldn\'t be thrown, because this signal was already successfully computed)')
  sig.value = $computing
  
  const oldDependencies = sig.dependencies
  sig.dependencies = []
  sig.dependencyValues.length = 0

  activeListeners.push(sig)
  
  const newValue = sig.callback()
  
  activeListeners.pop()

  oldDependencies.forEach(dep => {
    if (!sig.dependencies.includes(dep)) {
      dep.subscribed.splice(dep.subscribed.indexOf(sig), 1)
    }
  })
  
  return newValue
}
function callBackEffect(sig) {
  const oldDependencies = sig.dependencies
  sig.dependencies = []
  sig.dependencyValues.length = 0

  activeListeners.push(sig)
  sig.checked = exsigs
  
  const newValue = sig.callback()
  
  activeListeners.pop()
  sig.checked = 0
  
  oldDependencies.forEach(dep => {
    if (!sig.dependencies.includes(dep)) {
      dep.subscribed.splice(dep.subscribed.indexOf(sig), 1)
    }
  })
  
  return newValue
}

function setUpDependencies(sig) {
  sig.dependencies = []
  sig.dependencyValues = []
}


function markSubscribedDirty(sig, fromState) {
  sig.subscribed.forEach(sub => {
    if (sub.type === 'effect') {
      if (fromState) {
        if (sub.checked === mustRecall) return

        sub.checked = mustRecall  // effect certainly needs to be recalled
        effectQueue.push(sub)
      }
      else {
        if (sub.checked) return

        sub.checked = mayRecall  // effect needs to be checked for recall
        possibleEffectQueue.push(sub)
      }
      return
    }
    
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

  markSubscribedDirty(sig, true)

  evaluatePossibleEffects()

  computeEffects()

  return value
}
function getComputed(sig) {
  if (sig.value === $computing)
    throw new Error('cycle in signals\ncallback function: ' + sig.callback + '\n')

  if (sig.value === $unset) {
    setUpDependencies(sig)

    sig.value = callBackComputed(sig)
        
    return captureDependency(sig)
  }

  if (sig.clean) return captureDependency(sig)

  evaluateComputed(sig)

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
    equal: options?.equal ?? defaults.defaultEqual
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
    equal: options?.equal ?? defaults.defaultEqual
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
    equal: options?.equal ?? defaults.defaultEqual,
    call:
      (options?.call === 'async')
        ? defaults.defaultAsyncFnCall
        : options?.call ?? defaults.defaultFnCall,
    dependencies: [],
    dependencyValues: []
  }  

  effect.run = () => effect[$sigID].call(() => callBackEffect(effect[$sigID]))
  effect.toString = () => effectToString(effect[$sigID])

  effect.run()

  return effect
}