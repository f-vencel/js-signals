//signal2.js

export const $sigID = Symbol('sigID')
const $unset = Symbol('unset')
const $computing = Symbol('computing')


let activeListeners = []

function captureDependency(sig) {
  if (activeListeners.length === 0) return sig.value

  const listener = activeListeners[activeListeners.length - 1]

  listener.dependencies.push(sig)
  listener.dependencyValues.push(sig.value)

  if (!sig.subscribed.includes(listener)) {
    sig.subscribed.push(listener)
  }
  
  return sig.value
}


const possibleEffectQueue = []
const effectQueue = []

function evaluatePossibleEffects() {
  if (possibleEffectQueue.length === 0) return

  possibleEffectQueue.forEach(sig => {
    if (sig.checked) return
    
  })
}
function computeEffects() {
  effectQueue.forEach(fn => fn.call(fn.callback))
}


function defaultEqual(a, b) {
  return Object.is(a, b)
}
function defaultCall(fn) {
  fn()
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
}
function callBackComputed(sig) {
  activeListeners.push(sig)
  const oldDependencies = sig.dependencies
  sig.dependencies = []
  sig.dependencyValues.length

  if (sig.value === $computing) throw new Error('cycle in signals\n//? (shouldn\'t be thrown, because this signal was already successfully computed)')
  sig.value = $computing

  const newValue = sig.callback()

  activeListeners.pop()
  oldDependencies.forEach(dep => {
    if (!sig.dependencies.includes(dep)) {
      const index = dep.subscribed.indexOf(sig)

      dep.subscribed.splice(index, 1)
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
        sub.checked = true
        effectQueue.push(sub.callback)
      }
      else {
        if (sub.inPossible || sub.checked) return
        sub.inPossible = true
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
  return captureDependency(sig)
}
function setSignal(sig, value) {
  if (typeof value === 'function') value = value(sig.value)

  if (sig.equal(sig.value, value)) return sig.value

  sig.value = value

  markSubscribedDirty(sig)

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
  return `[signal ${getComputed(sig)}]`
}

export function signal(init, options) {
  const sig = function signal(value) {
    if (arguments.length === 1) return sig.set(value)
    return sig.get()
  }
  
  sig[$sigID] = {
    value: init,
    subscribed: [],
    equal: options?.equal ?? defaultEqual
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
    value: $unset,
    callback,
    clean: true,
    subscribed: [],
    equal: options?.equal ?? defaultEqual
  }

  sig.get = () => getComputed(sig[$sigID])
  sig.toString = () => computedToString(sig[$sigID])

  return sig
}
