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



