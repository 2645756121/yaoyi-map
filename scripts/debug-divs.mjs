import fs from 'node:fs';
const file = fs.readFileSync('src/components/HerbModal/HerbModal.tsx', 'utf8');
// 重新按字符解析，按行号记录 div 标签
const lines = file.split('\n');
let depth = 0;
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  const clean = line.replace(/"[^"]*"/g, '""');
  // 使用 \b 匹配 <div 后跟空白或 > 或行末
  const opens = (clean.match(/<div(\s|>|\b)/g) || []).length;
  const closes = (clean.match(/<\/div>/g) || []).length;
  depth += opens - closes;
  if (opens > 0 || closes > 0) {
    console.log(`L${i+1} (d=${depth}): +${opens} -${closes} | ${line.trim().substring(0, 80)}`);
  }
}
console.log('Final depth:', depth);