import fs from 'node:fs';
const file = fs.readFileSync('src/components/HerbModal/HerbModal.tsx', 'utf8');
const lines = file.split('\n');
// 跟踪 { } 嵌套
let inExpr = 0;
let inStr = false;
let strChar = '';
let lineNum = 1;
let colNum = 1;
for (let i = 0; i < file.length; i++) {
  const ch = file[i];
  if (ch === '\n') {
    lineNum++;
    colNum = 1;
    continue;
  }
  colNum++;
  if (inStr) {
    if (ch === strChar) inStr = false;
    continue;
  }
  if (ch === '"' || ch === "'" || ch === '`') { inStr = true; strChar = ch; continue; }
  // 跳过 // 注释
  if (ch === '/' && file[i+1] === '/') { while(i < file.length && file[i] !== '\n') i++; continue; }
  // 跳过 /* */ 注释
  if (ch === '/' && file[i+1] === '*') { while(i < file.length && !(file[i] === '*' && file[i+1] === '/')) i++; i++; continue; }
  if (ch === '{') {
    inExpr++;
  }
  if (ch === '}') {
    inExpr--;
    if (inExpr < 0) {
      console.log(`Mismatch at line ${lineNum} col ${colNum}: extra }, inExpr=${inExpr}`);
    }
  }
}
console.log(`Final inExpr at L${lineNum}: ${inExpr}`);