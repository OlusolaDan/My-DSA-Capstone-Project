export function mergeSort(items, compare) {
  const source = [...items];
  if (source.length < 2) return source;
  const middle = Math.floor(source.length / 2);
  const left = mergeSort(source.slice(0, middle), compare);
  const right = mergeSort(source.slice(middle), compare);
  const result = [];
  let i = 0;
  let j = 0;
  while (i < left.length && j < right.length) {
    // Taking from the left on equality preserves the input order.
    if (compare(left[i], right[j]) <= 0) result.push(left[i++]);
    else result.push(right[j++]);
  }
  while (i < left.length) result.push(left[i++]);
  while (j < right.length) result.push(right[j++]);
  return result;
}
