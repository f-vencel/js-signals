import { signal, computed, $sigID } from './signal2.js';
import * as core from '@angular/core'


const a = signal(2)
const b = signal(200)
const isD = signal(true)

const comp = computed(() => {
  console.log('b')
  if (isD()) return b() + 1
  return a() + 1
})







// let a = signal(0)
// let b = computed(() => a() + c())
// let c = computed(() => a() + b())

// console.log(b())
