#!/usr/bin/env node
// debug-failed-run.mjs - 查看 run #42 的具体失败步骤
const TOKEN = process.env.GITHUB_TOKEN || 'ghp_REPLACE_ME';
const REPO = '2645756121/yaoyi-map';

const RUN_ID = process.argv[2] || '30472335196';
const headers = {
  Authorization: `Bearer ${TOKEN}`,
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
};

const runRes = await fetch(`https://api.github.com/repos/${REPO}/actions/runs/${RUN_ID}`, { headers });
const run = await runRes.json();
console.log(`Run #${run.run_number}: ${run.status}/${run.conclusion}`);
console.log(`Head: ${run.head_sha}`);
console.log(`Message: ${run.head_commit.message.split('\n')[0]}`);
console.log(`URL: ${run.html_url}\n`);

// run.jobs_url 是 "https://api.github.com/.../runs/{id}/jobs"，需要带 -X GET
const jobsRes = await fetch(run.jobs_url, { headers });
console.log(`Jobs endpoint status: ${jobsRes.status}`);
const jobsRaw = await jobsRes.text();
console.log(`Jobs response (first 800 chars):`);
console.log(jobsRaw.substring(0, 800));
console.log('---');

let jobs = null;
try {
  const parsed = JSON.parse(jobsRaw);
  jobs = parsed.jobs || parsed;
  console.log(`\nJobs count: ${Array.isArray(jobs) ? jobs.length : typeof jobs}`);
  if (Array.isArray(jobs)) {
    for (const job of jobs) {
      console.log(`\n  Job: ${job.name}  ${job.status}/${job.conclusion}`);
      for (const step of job.steps || []) {
        if (step.conclusion === 'failure' || (step.number === 1 && step.status === 'completed')) {
          console.log(`    Step ${step.number}: ${step.name}  ${step.status}/${step.conclusion || '(in progress)'}`);
        }
      }
    }
  }
} catch (e) {
  console.log(`JSON parse failed: ${e.message}`);
}

// 获取第一个失败 job 的日志
const logRes = await fetch(`https://api.github.com/repos/${REPO}/actions/runs/${RUN_ID}/logs`, { headers });
if (logRes.ok) {
  const logText = await logRes.text();
  const lines = logText.split('\n');
  const errLines = [];
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (/error|fail|exit code|✖|✗|process completed/i.test(l) && !/^202[56]-/.test(l)) {
      errLines.push(`L${i}: ${l.substring(0, 250)}`);
    }
  }
  console.log(`\nError log lines (${errLines.length} total, showing first 15):`);
  errLines.slice(0, 15).forEach(l => console.log(`  ${l}`));
}