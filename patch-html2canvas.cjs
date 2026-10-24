const fs = require('fs');
const path = require('path');

const targetFiles = [
  path.join(__dirname, 'node_modules', 'html2canvas', 'dist', 'html2canvas.esm.js'),
  path.join(__dirname, 'node_modules', 'html2canvas', 'dist', 'html2canvas.js'),
  path.join(__dirname, 'node_modules', 'html2canvas', 'dist', 'lib', 'css', 'types', 'color.js'),
];

const errorPattern = /if\s*\(\s*typeof\s+colorFunction\s*===\s*'undefined'\s*\)\s*\{[\s\S]*?throw\s+new\s+Error\([^\)]*unsupported color function[^\)]*\);\s*\}/g;

const replacement = `if (typeof colorFunction === 'undefined') {
                try {
                    if (typeof document !== 'undefined') {
                        var c = document.createElement('canvas');
                        var ctx = c.getContext('2d');
                        if (ctx) {
                            var args = (value.values || []).map(function(v) { return v.value !== undefined ? v.value : (v.number !== undefined ? v.number : ''); }).join(' ');
                            ctx.fillStyle = '#000000';
                            ctx.fillStyle = value.name + '(' + args + ')';
                            var res = ctx.fillStyle;
                            if (res && res.indexOf('rgb') === 0) {
                                var m = res.match(/[\\d.]+/g);
                                if (m && m.length >= 3) {
                                    var packFn = typeof pack === 'function' ? pack : (exports && exports.pack ? exports.pack : null);
                                    if (packFn) {
                                        return packFn(parseFloat(m[0]), parseFloat(m[1]), parseFloat(m[2]), m[3] ? parseFloat(m[3]) : 1);
                                    }
                                }
                            }
                        }
                    }
                } catch(e) {}
                return 0;
            }`;

for (const filePath of targetFiles) {
  if (fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath, 'utf8');
    if (content.match(errorPattern)) {
      content = content.replace(errorPattern, replacement);
      fs.writeFileSync(filePath, content, 'utf8');
      console.log('[patch-html2canvas] Successfully patched:', filePath);
    } else {
      console.log('[patch-html2canvas] Already patched or pattern not found:', filePath);
    }
  }
}
