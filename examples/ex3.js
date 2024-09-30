import { signal, computed, effect } from '../src/index.js';


const counter = signal(0);
const counter2 = signal(100);
const isEven = computed(() => (counter.get() & 1) == 0);
const parity = computed(() => isEven.get() ? 'even' : 'odd');

const ef = effect(({ onDestroy, onInit }) => {
  console.log(`parity is ${parity()}`)

  const id = setTimeout(() => {
    console.log('hey in 5s', 5000);
  })

  onDestroy(() => {
    console.log('destroy event fired')
    clearTimeout(id);
  })
}, {
  call: (fn) => {
    console.log('calling the effect now!');
    fn();
    console.log('done!');
  },
  async: false,
})

ef()

ef.destroy()

console.log("aaa")
