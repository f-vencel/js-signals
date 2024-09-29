import { signal, computed, effect, track } from '../src/signals.js'

const count = signal(1)

const doubleCount = computed(() => count() * 2)
const quadrupleCount = computed(() => doubleCount() * 2)


