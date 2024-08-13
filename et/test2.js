import { signal, computed, effect } from './signal2.js';
import * as core from '@angular/core'


const a = signal(2)


const c1 = computed(() => {
  console.log('c1')
  return a()
})
const c2 = computed(() => {
  console.log('c2')
  return c1()
})
const c3 = computed(() => {
  console.log('c3')
  return c2()
})


let ef = effect(() => {
  console.log('effect start')
  console.log(a())

  c3()
  console.log('effect over')
}, {
  call: 'async'
})

a.set(3)

console.log('   between')

a.set(5)
a.set(9)
a.set(99)
console.log('   between   eeee')
// a.set(5)
// setTimeout(() => {
//   Promise.resolve().then(() => a.set(7))
// }, 1000)


// let a = signal(0)
// let b = computed(() => a() + c())
// let c = computed(() => a() + b())

// console.log(b())
