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


const a = signal(0);
const b = computed(() => {
  console.log('b')
  return a() - a()
})
b()

effect(() => {
  console.log('effect')
  b()
})

a(2)
a(3)
a(4)
a(66)

// console.log(b())

