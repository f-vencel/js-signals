import { signal, computed, effect, defaults } from './signal2.js';
import * as core from '@angular/core'




const count = signal(9)
const isDarkSig = signal(false)
const isDark = computed(() => isDarkSig())

const doubleCount = computed(() => count() * 2)
const countMod = computed(() => count() % 2)

const _e =
effect(() => {
  console.log('effect')
  if (isDark())
    console.log(doubleCount())
  else
  console.log(countMod())
})

defaults.async = false
isDarkSig(true)
isDarkSig(false)