export function capitalLetter(str: string) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export function decapitalLetter(str: string) {
  return str.charAt(0).toLocaleLowerCase() + str.slice(1);
}

export function snakeToCamelCase(snake: string) {
  return snake.split('_').map((t, i) => i === 0 ? decapitalLetter(t) : capitalLetter(t)).join('');
}
