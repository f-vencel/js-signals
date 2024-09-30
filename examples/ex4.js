import { signal, effect } from '../src/index.js'


const counter = signal(1)
const lever = signal(false)

effect(({ onLoop }) => {
  onLoop(() => counter() !== (lever() ? 10 : 0))

  console.log('lever is ' + (lever() ? 'up' : 'down'))

  counter()
  lever() ? counter(c => c + 1) : counter(c => c - 1)
})

lever(c => !c)
lever(c => !c)
lever(c => !c)
