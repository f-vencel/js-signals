# JavaScript Signals implementation

This is an implementation of signals in JavaScript, for the proposal
(https://github.com/tc39/proposal-signals/tree/main)

This document describes an early common direction for signals in JavaScript, similar to the Promises/A+ effort which preceded the Promises standardized by TC39 in ES2015.

This implementation does include a fully concrete API, but the API is not targeted to most application developers. Instead, the signal API here is a better fit for frameworks to build on top of, providing interoperability through common signal graph and auto-tracking mechanism.

## Background: Why Signals?

To develop a complicated user interface (UI), JavaScript application developers need to store, compute, invalidate, sync, and push state to the application's view layer in an efficient way. UIs commonly involve more than just managing simple values, but often involve rendering computed state which is dependent on a complex tree of other values or state that is also computed itself. The goal of Signals is to provide infrastructure for managing such application state so developers can focus on business logic rather than these repetitive details.

Signal-like constructs have independently been found to be useful in non-UI contexts as well, particularly in build systems to avoid unnecessary rebuilds.

Signals are used in reactive programming to remove the need to manage updating in applications.

#### Example - A VanillaJS Counter

Given a variable, `counter`, you want to render into the DOM whether the counter is even or odd. Whenever the `counter` changes, you want to update the DOM with the latest parity. In Vanilla JS, you might have something like this:

```js
let counter = 0;
const setCounter = (value) => {
  counter = value;
  render();
};

const isEven = () => (counter & 1) == 0;
const parity = () => isEven() ? "even" : "odd";
const render = () => element.innerText = parity();

// Simulate external updates to counter...
setInterval(() => setCounter(counter + 1), 1000);
```

### Introducing Signals

To understand Signals, let's take a look at the above example, re-imagined with a Signal API further articulated below.

#### Example - A Signals Counter

```js
const counter = signal(0);
const isEven = computed(() => (counter.get() & 1) == 0);
const parity = computed(() => isEven.get() ? 'even' : 'odd');


effect(() => element.innerText = parity.get());

// Simulate external updates to counter...
setInterval(() => counter.set(counter.get() + 1), 1000);
```

There are a few things we can see right away:
* We've eliminated the noisy boilerplate around the `counter` variable from our previous example.
* There is a unified API to handle values, computations, and side effects.
* There's no circular reference problem or upside down dependencies between `counter` and `render`.
* There are no manual subscriptions, nor is there any need for bookkeeping.
* There is a means of controlling side-effect timing/scheduling.

### See examples folder for more examples

#### Setting/Getting a signal

```js
const counter = signal(0);

counter.set(1);
counter.set(c => c + 1);
counter(2);
counter(c => c + 1);

console.log(count())
console.log(count.get())

const data = signal({
  name: 'apple',
  model: 2.4
})

data.update(o => o.model++)
```

You can use the `untrack` function to set a signal, but not have any effect of it

```js
const count = signal(0)

effect(() => console.log(count()))

untrack(() => count.set(1))
untrack(() => count.set(2))
```

Or even the `track` function to set a signal inside the `untrack` function

You can nest these as deep as you want

```js
const count = signal(0)
const greet = signal('hey')

effect(() => console.log(count()))

untrack(() => {
  count.set(1)
  track(() => greet('hello'))
})
```

#### Effects

Effect are run when their dependecies change

By default effects run synchronously

You can accept optional function, such as `onDestroy`, `onInit`, `onLoop` to set up callback functions

By default every effect throws an Error if its gets into a loop

the `onLoop` is executed when the effect gets into a loop. It expects a boolean return value, which indicates whether the effect should stay in a loop or not

```js
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
    clearTimeout(id);
  })

  untrack(() => {
    counter.set(c => c + 10)
  })
}, {
  call: (fn) => {
    console.log('calling the effect now!');
    fn();
    console.log('done!');
  },
  async: true,
})

ef()

// You can stop the effect by calling .destroy()
ef.destroy()

// You can also pause/resume the effect
ef.pause()
ef.resume()
```


