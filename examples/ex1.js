import { signal, computed } from '../src/index.js'

const count = signal(1)

const doubleCount = computed(() => count() * 2)
const quadrupleCount = computed(() => doubleCount() * 2)

console.log(quadrupleCount())

count.set(2)

console.log(doubleCount())

count.set(c => c + 3)
console.log(count())

count(c => c + 9)
console.log(count())