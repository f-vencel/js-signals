import { signal, computed, effect, untrack, track, defaults } from '../src/signals.js'

// const name = signal('mark')
// const familyName = signal('Robinson')
// const score = signal({
//   today: 10,
//   past: [2,3,4,5,6,7]
// }, {
//   equal: defaults.deepEqual
// })
    
const count = signal(1)
const doubleCount = computed(() => count() * 2)

// const isEven = computed(() => count() % 2 === 0)
// const parity = computed(() => isEven() ? 'even' : 'odd')

// const fullName = computed(() => `${name()} ${familyName()}`)

// const efID = effect(() => {
//   console.log(`doubleCount is: ${doubleCount()}`)
// })

// count(c => c + 3)

// effect(() => {
//   console.log(`parity is: ${parity()}`)
// })

// efID.pause()

// count.set(11)

// effect(({ onLoop }) => {
//   onLoop(() => false)

//   console.log(`your name is: ${fullName()}`)
//   console.log(`your today's score is: ${score().today}`)

//   track(() => {
//     console.log(`your past score is: ${score().past}`)
//     score.set(o => {
//       return {
//         ...o,
//         past: [...o.past, Math.random()]
//       }
//     })
//   })

// }, {
//   async: false,
// })

// efID.resume()

// name('norbert')



const b = computed(() => {
  console.log('hey b')

  count.set(c => c + 1)
})

const ef = effect(({ onLoop }) => {
  onLoop(() => true)
  console.log('hey effect')

  console.log(doubleCount())

  b()
})

