import Signal, { state, computed, effect } from './signal.js';



const count = state(0)

const countmod2 = computed(() => {
  console.log('mod called')
  return count() % 2
}, count)

const isEven = computed(() => {
  console.log('isEven called')
  return countmod2() === 0
}, countmod2)

const parity = computed(() => {
  console.log('parity called')
  return isEven() ? 'even' : 'odd'
}, isEven)




effect(() => {
  console.log('effect called')
  console.log(parity())
}, parity)


console.log(parity())

count(c => c + 1)
// count(c => c + 1)