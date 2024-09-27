import { signal, computed, effect } from '../src/signals.js';



const count = signal(0)
const doubleCount = computed(() => count() * 2);

effect(() => {
  console.log(count());

  count(a => a + 1)
})