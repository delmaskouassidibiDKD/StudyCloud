const fs = require('fs');
const path = require('path');
const dir = './src/components';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.tsx'));
let changed = 0;
files.forEach(f => {
  const fp = path.join(dir, f);
  let content = fs.readFileSync(fp, 'utf8');
  const orig = content;
  content = content.replace(/md:left-64 z-30 w-full/g, 'md:left-64 z-30 w-full md:w-[calc(100%-16rem)]');
  if(content !== orig) {
    fs.writeFileSync(fp, content);
    changed++;
    console.log('Updated ' + f);
  }
});
console.log('Total files changed: ' + changed);
