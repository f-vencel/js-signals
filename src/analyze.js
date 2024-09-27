import { parse } from "acorn";

export default function analyzeFunction(fn) {
  const code = fn.toString();
  const ast = parse(code, { ecmaVersion: 2020 });

  const dependencies = {
    parameters: [],
    variables: [],
    globals: []
  };

  function traverse(node, parent) {
    switch (node.type) {
      case "FunctionDeclaration":
      case "FunctionExpression":
        node.params.forEach(param => {
            dependencies.parameters.push(param.name);
        });
        break;
      case "VariableDeclarator":
        dependencies.variables.push(node.id.name);
        break;
      case "Identifier":
        if (parent.type !== "VariableDeclarator" && parent.type !== "FunctionDeclaration" && parent.type !== "FunctionExpression" && parent.type !== "MemberExpression") {
            dependencies.globals.push(node.name);
        }
        break;
    }

    for (let key in node) {
      if (node.hasOwnProperty(key) && typeof node[key] === "object" && node[key] !== null) {
        traverse(node[key], node);
      }
    }
  }

  traverse(ast, null);

  return dependencies;
}