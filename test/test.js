import { signal, computed, effect } from '../src/signals.js';



const count = signal(0)
const doubleCount = computed(() => count() * 2);



let e = effect(() => {
  console.log(doubleCount());

})

console.log(e.destroy)