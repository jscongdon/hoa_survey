const fs = require('fs');
const s = fs.readFileSync('app/survey/[token]/page.tsx','utf8');
const pairs = {'(':')','{':'}','[':']'};
const stack = [];
for (let i = 0; i < s.length; i++) {
  const ch = s[i];
  if ('({['.includes(ch)) stack.push({ ch, i });
  else if (')}]'.includes(ch)) {
    const last = stack.pop();
    if (!last || pairs[last.ch] !== ch) {
      console.error('Mismatch at', i, ch);
      process.exit(1);
    }
  }
}
if (stack.length) {
  console.error('Unclosed at', stack[stack.length-1]);
  process.exit(2);
}
console.log('Braces appear balanced');
