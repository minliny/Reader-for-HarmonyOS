import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const plan = JSON.parse(readFileSync(new URL('fixture-plan.json', import.meta.url), 'utf8'));
const runIdPattern = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/u;

function pinnedBytes(input) {
  const body = readFileSync(new URL(input.path, import.meta.url));
  const sha256 = createHash('sha256').update(body).digest('hex');
  if (body.byteLength !== input.bytes || sha256 !== input.sha256) {
    throw new Error(`Retry fixture bytes changed for ${input.path}`);
  }
  return body;
}

const [source] = JSON.parse(pinnedBytes(plan.sourceTemplate).toString('utf8'));
const responses = Object.fromEntries(Object.entries(plan.responses).map(([name, entry]) =>
  [name, { status:entry.status, sha256:entry.sha256, body:pinnedBytes(entry) }]));

/** In-memory owner for one isolated run. Hosting and request logging are supplied by the caller. */
export function createRetryRecoveryFixture({ origin, runId }) {
  const parsed = new URL(origin);
  if (parsed.protocol !== 'https:' || parsed.origin !== origin || !parsed.hostname ||
      typeof runId !== 'string' || !runIdPattern.test(runId)) {
    throw new Error('Retry fixture requires a canonical HTTPS origin and one UUIDv4 run ID');
  }
  const basePath = `/reader-phase1/retry-recovery/${runId}/`;
  const sourceImport = JSON.stringify([{ ...source, bookSourceUrl:origin + basePath }], null, 2) + '\n';
  const page1 = basePath + source.searchUrl.replace('{{page}}', plan.responses.initialPage1.page);
  const page2 = basePath + source.searchUrl.replace('{{page}}', plan.responses.recoveredPage2.page);
  const counts = { initialPage1:0, recoveredPage1:0, recoveredPage2:0 };

  function respond(method, requestTarget) {
    if (method !== plan.method) return null;
    let name;
    if (requestTarget === page1) name = counts.initialPage1 === 0 ? 'initialPage1' : 'recoveredPage1';
    else if (requestTarget === page2 && counts.recoveredPage1 > 0) name = 'recoveredPage2';
    else return null;

    const response = responses[name];
    counts[name] += 1;
    return { status:response.status, headers:{...plan.headers}, body:Buffer.from(response.body), sha256:response.sha256 };
  }

  return { sourceImport, respond, snapshot:() => ({ ...counts }) };
}
