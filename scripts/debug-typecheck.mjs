#!/usr/bin/env node
// debug-typecheck.mjs - 查看 build job 的完整日志
const TOKEN = process.env.GITHUB_TOKEN || 'ghp_REPLACE_ME';
const REPO = '2645756121/yaoyi-map';
const RUN_ID = '30472335196';

const headers = {
  Authorization: `Bearer ${TOKEN}`,
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
};

// 获取 jobs 列表
const runRes = await fetch(`https://api.github.com/repos/${REPO}/actions/runs/${RUN_ID}`, { headers });
const run = await runRes.json();
const jobsRes = await fetch(run.jobs_url, { headers });
const jobsJson = await jobsRes.json();
const buildJob = jobsJson.jobs.find(j => j.name === 'build');

console.log(`Build job ID: ${buildJob.id}`);
console.log(`Steps: ${buildJob.steps.map(s => `${s.number}.${s.name}`).join(', ')}\n`);

// 获取 build job 的日志（zip 流）
const logRes = await fetch(`https://api.github.com/repos/${REPO}/actions/jobs/${buildJob.id}/logs`, { headers });
if (!logRes.ok) {
  console.log(`Logs endpoint: ${logRes.status}`);
  process.exit(1);
}
const logText = await logRes.text();
console.log(`Log length: ${logText.length}\n`);

// 找 TypeScript 错误信息
const lines = logText.split('\n');
console.log('=== Lines containing "error" (excluding timestamps) ===');
let count = 0;
for (let i = 0; i < lines.length; i++) {
  const l = lines[i];
  if (/error|TS\d{4}|Cannot find|✖/i.test(l) && !/^202[56]-/.test(l)) {
    console.log(`L${i}: ${l.substring(0, 300)}`);
    count++;
    if (count >= 30) break;
  }
}
console.log(`\nTotal error lines found: ${count}`);