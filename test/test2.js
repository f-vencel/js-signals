import { signal, computed, effect, defaults } from './signal2.js';
import * as core from '@angular/core'


// defaults.async = true


// const count = signal(9)
// const isDarkSig = signal(false)
// const isDark = computed(() => isDarkSig())

// const doubleCount = computed(() => count() * 2)
// const countMod = computed(() => count() % 2)

// const _e =
// effect(() => {
//   console.log('effect')
//   if (isDark())
//     console.log(doubleCount())
//   else
//   console.log(countMod())
// })

// isDarkSig(true)
// isDarkSig(false)


const a = core.signal(0);
const b = core.computed(() => {
  console.log('b')
  throw new Error('dwdww')
  return a() + a()
})
b()


// a(2)
// a(3)
// a(4)
// a(66)

// console.log(b())

