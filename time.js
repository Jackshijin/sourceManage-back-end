
function findNum(start, end) {
  let count = 0, sum = 0;
  if (start%2 === 0) {
    for (let i = start + 1; i <= end; i += 2) {
      let p = true;
      for (let j = 2; j * j <= i; j++) {
        if (i % j === 0) {
          p = false;
          break;
        }
      }
      if (p) {
        count++;
        sum += i;
      }
    }
  } else {
    for (let i = start; i <= end; i += 2) {
      let p = true;
      for (let j = 2; j * j <= i; j++) {
        if (i % j === 0) {
          p = false;
          break;
        }
      }
      if (p) {
        count++;
        sum += i;
      }
    }
  }
  return [count, sum];
}
console.log(findNum(10,100))

