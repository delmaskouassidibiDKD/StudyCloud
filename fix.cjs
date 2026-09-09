const fs = require('fs');
const path = require('path');
const dir = './src/components';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.tsx'));
let changed = 0;
files.forEach(f => {
  const fp = path.join(dir, f);
  let content = fs.readFileSync(fp, 'utf8');
  const orig = content;
  content = content.replace(/className="fixed top-14 left-4 right-4/g, 'className="fixed top-14 left-4 right-4 md:left-[17rem]');
  content = content.replace(/className="fixed top-12 left-2 right-2/g, 'className="fixed top-12 left-2 right-2 md:left-[16.5rem]');
  content = content.replace(/className="absolute inset-x-0 bottom-0 top-\[56px\] md:top-\[60px\]/g, 'className="absolute inset-x-0 bottom-0 top-[56px] md:top-[60px] md:left-64');
  if(content !== orig) {
    fs.writeFileSync(fp, content);
    changed++;
    console.log('Updated ' + f);
  }
});
console.log('Total files changed: ' + changed);
