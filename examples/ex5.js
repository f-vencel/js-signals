import { signal, effect } from '../src/index.js'

const person = signal.fromObject({
  name: 'John',
  id: 1234567,
  height: 100,
  hasHair: true,
  score: 32,
  occupation: [
    {
      company: 'MNB',
      salary: 3200,
      roles: ['admin', 'manager']
    },
    {
      company: 'UNI',
      salary: 5200,
      roles: ['manager', 'designer']
    },
    {
      company: 'Google',
      salary: 32000,
      roles: ['engineer', 'janitor', 'sanitation']
    }
  ]
})

effect(() => {
  console.log('person ---------------------------------------------------')

  person()

  console.log(JSON.stringify(person, (k, v) => {
    if (typeof v === 'function') return v.toString()
    return v
  }, 2))
})

person().score(54)