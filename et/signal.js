import analyzeFunction from './analyze.js';



function exampleFunction(a, b) {
  let c = a;

  function alma(d) {
    let b = d;
    let e = 20;
    return d;
  }
}

console.log(analyzeFunction(exampleFunction));
