export function capitalLetter(str: string) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export function decapitalLetter(str: string) {
  return str.charAt(0).toLowerCase() + str.slice(1);
}

export function snakeToPascalCase(snake: string) {
  return snake.toLowerCase().split('_').map(t => capitalLetter(t)).join('');
}

export function pascalToSnakeCase(pascal: string) {
  return pascal.replace(/([a-z])([A-Z])/g, '$1 $2').replaceAll(' ', '_').toLowerCase();
}

export function snakeToCamelCase(snake: string) {
  return snake.split('_').map((t, i) => i === 0 ? decapitalLetter(t) : capitalLetter(t)).join('');
}

export function camelToSnakeCase(camel: string) {
  return pascalToSnakeCase(camelToPascalCase(camel));
}

export function pascalToCamelCase(pascal: string) {
  return decapitalLetter(pascal);
}

export function camelToPascalCase(camel: string) {
  return capitalLetter(camel);
}

export function pascalToKebabCase(pascal: string) {
  return pascal.replace(/([a-z])([A-Z])/g, '$1 $2').replaceAll(' ', '-').toLowerCase();
}

export function kebabToPascalCase(kebab: string) {
  return kebab.toLowerCase().split('-').map(t => capitalLetter(t)).join('');
}
