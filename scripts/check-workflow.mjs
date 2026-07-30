#!/usr/bin/env node
// check-workflow.mjs - 检查最新 workflow 状态
// 令牌从环境变量读取，避免硬编码泄露到版本控制
const TOKEN = process.env.GITHUB_TOKEN || 'ghp_REPLACE_ME';
const REPO = '2645756121/yaoyi-map';

const workflows = {
  321472268: 'Deploy to GitHub Pages',
  321472269: '.github/workflows/deploy.yml (Docker)',
};

async function listAll() {
  const runs = [];
  for (const [wfId, name] of Object.entries(workflows)) {
    const r = await fetch(
      `https://api.github.com/repos/${REPO}/actions/runs?per_page=3&workflow_id=${wfId}`,
      {
        headers: {
          Authorization: `Bearer ${TOKEN}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
      }
    );
    if (!r.ok) {
      console.log(`ERROR ${wfId}: ${r.status}`);
      continue;
    }
    const j = await r.json();
    console.log(`\n========== ${name} (id=${wfId}) ==========`);
    for (const run of j.workflow_runs.slice(0, 3)) {
      console.log(`  #${run.run_number}  ${run.status}/${run.conclusion}  ${run.created_at}`);
      console.log(`    ${run.head_commit.message.split('\n')[0]}`);
      console.log(`    head: ${run.head_sha.slice(0, 10)}  url: ${run.html_url}`);
    }
    runs.push(...j.workflow_runs);
  }
  return runs;
}

listAll();