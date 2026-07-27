/**
 * 详细检查 first feature 的 bbox 计算
 */

import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import WebSocket from 'ws';
import http from 'node:http';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const REPORT_DIR = resolve(ROOT, 'audit-reports');
mkdirSync(REPORT_DIR, { recursive: true });

const EDGE_PROFILE = mkdtempSync(join(tmpdir(), 'edge-debug2-'));
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const URL = process.env.AUDIT_URL || 'http://127.0.0.1:5186/';

function getJSON(url) {
  return new Promise((resolveP, rejectP) => {
    http.get(url, (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => {
        try { resolveP(JSON.parse(body)); } catch (e) { rejectP(e); }
      });
    }).on('error', rejectP);
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const nextCmdId = { v: 1 };
async function sendCmd(ws, method, params = {}) {
  const id = nextCmdId.v++;
  return new Promise((resolveP, rejectP) => {
    const handler = (data) => {
      try {
        const obj = JSON.parse(data.toString());
        if (obj.id === id) {
          ws.off('message', handler);
          if (obj.error) rejectP(new Error(obj.error.message));
          else resolveP(obj.result);
        }
      } catch {}
    };
    ws.on('message', handler);
    ws.send(JSON.stringify({ id, method, params }));
  });
}

async function evalJS(ws, expr) {
  const r = await sendCmd(ws, 'Runtime.evaluate', {
    expression: expr, awaitPromise: true, returnByValue: true,
  });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.text || 'eval error');
  return r.result.value;
}

async function main() {
  const PORT = 9991;
  const proc = spawn(EDGE, [
    '--headless=new', '--disable-gpu', '--no-sandbox',
    '--remote-debugging-port=' + PORT,
    '--window-size=1920,1080',
    '--user-data-dir=' + EDGE_PROFILE,
    'about:blank',
  ], { stdio: ['ignore', 'pipe', 'pipe'] });

  for (let i = 0; i < 30; i++) {
    await sleep(500);
    try {
      await getJSON('http://127.0.0.1:' + PORT + '/json/version');
      break;
    } catch {}
  }

  const tabs = await getJSON('http://127.0.0.1:' + PORT + '/json');
  const target = tabs.find((t) => t.type === 'page');
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r) => ws.on('open', r));

  await sendCmd(ws, 'Page.enable');
  await sendCmd(ws, 'Runtime.enable');
  await sendCmd(ws, 'Page.navigate', { url: URL });
  await sleep(10000);

  // 检查 processCountyGeoJson 的实际行为 - 通过 React fiber
  const r = await evalJS(ws, [
    '(async function() {',
    '  const data = await fetch("/map/county_yao.json").then(function(r) { return r.json(); });',
    '  const first = data.features[0];',
    '  const MAP_PROJECTION = { padding: 20, viewBoxWidth: 900, viewBoxHeight: 600, minLon: 73, maxLon: 135, minLat: 18, maxLat: 54 };',
    '  const lonRange = 62, latRange = 36;',
    '  const scale = Math.min((900 - 40) / lonRange, (600 - 40) / latRange);',
    '  const project = function(lng, lat) { return [20 + (lng - 73) * scale, 20 + (54 - lat) * scale]; };',
    '',
    '  // 应用实际 ChinaMap.processCountyGeoJson 的逻辑',
    '  const rings = [];',
    '  if (first.geometry.type === "Polygon") rings.push.apply(rings, first.geometry.coordinates);',
    '  else if (first.geometry.type === "MultiPolygon") first.geometry.coordinates.forEach(function(p) { rings.push.apply(rings, p); });',
    '',
    '  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;',
    '  let coordCount = 0;',
    '  let sampleCoords = [];',
    '  rings.forEach(function(polygon) {',
    '    polygon.forEach(function(ring) {',
    '      ring.forEach(function(coord) {',
    '        const xy = project(coord[0], coord[1]);',
    '        if (xy[0] < minX) minX = xy[0];',
    '        if (xy[0] > maxX) maxX = xy[0];',
    '        if (xy[1] < minY) minY = xy[1];',
    '        if (xy[1] > maxY) maxY = xy[1];',
    '        coordCount++;',
    '        if (sampleCoords.length < 3) sampleCoords.push({ raw: coord, projected: xy });',
    '      });',
    '    });',
    '  });',
    '',
    '  return JSON.stringify({',
    '    featureName: first.properties.name,',
    '    geometryType: first.geometry.type,',
    '    ringsCount: rings.length,',
    '    firstRingLength: rings[0] ? rings[0].length : 0,',
    '    firstFirstRingLength: rings[0] && rings[0][0] ? rings[0][0].length : 0,',
    '    firstCoord: rings[0] && rings[0][0] && rings[0][0][0],',
    '    coordCount: coordCount,',
    '    sampleCoords: sampleCoords,',
    '    bbox: { minX: minX, maxX: maxX, minY: minY, maxY: maxY },',
    '    isFiniteMinX: isFinite(minX),',
    '  });',
    '})();'
  ].join('\n'));
  console.log('实际数据特征:', r);

  ws.close();
  proc.kill();
}

main().catch((e) => {
  console.error('FATAL:', e);
  process.exit(2);
});