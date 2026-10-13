import { appTasks, OhosPluginId, OhosAppContext } from '@ohos/hvigor-ohos-plugin';
import { hvigor } from '@ohos/hvigor';

const { configureIdeSigning, assertReaderHapInvocation, verifyIdeOutput } = require('./hvigor/reader-hap-guard.cjs');

type IdeSigningSession = {
  pipeline: {
    preflightIdeNative(): void;
  };
  session: unknown;
};

let ideSigning: IdeSigningSession | undefined;

// Hvigor evaluates the application node asynchronously.  On some DevEco
// invocations `taskGraphResolved` can run after the first node callback but
// before the application plugin context has been exposed to that callback.
// Keep the admission promise and retry from the resolved node list so a
// normal IDE assemble never races the private signer setup.
let ideSigningReady: Promise<IdeSigningSession | undefined> | undefined;

async function configureIdeSigningOnce(context: OhosAppContext): Promise<IdeSigningSession | undefined> {
  if (ideSigning) return ideSigning;
  if (!ideSigningReady) {
    ideSigningReady = configureIdeSigning(context).then((configured: IdeSigningSession | undefined) => {
      if (configured) ideSigning = configured;
      return configured;
    });
  }
  const ready = ideSigningReady;
  try {
    return await ready;
  } finally {
    if (ideSigningReady === ready) ideSigningReady = undefined;
  }
}

async function ensureIdeSigning(): Promise<IdeSigningSession | undefined> {
  if (ideSigning) return ideSigning;
  for (const node of hvigor.getAllNodes()) {
    const context = node.getContext(OhosPluginId.OHOS_APP_PLUGIN) as OhosAppContext;
    if (!context) continue;
    const configured = await configureIdeSigningOnce(context);
    if (configured) return configured;
  }
  return ideSigning;
}

hvigor.afterNodeEvaluate(async (node) => {
  const context = node.getContext(OhosPluginId.OHOS_APP_PLUGIN) as OhosAppContext;
  if (context && !ideSigning) await configureIdeSigningOnce(context);
});

hvigor.taskGraphResolved(async () => {
  await ensureIdeSigning();
  const tasks = hvigor.getCommandEntryTask() || [];
  assertReaderHapInvocation(tasks, ideSigning);
  if (ideSigning && tasks.some((name: string) => /(?:assemble|package|sign)Hap$/i.test(name))) {
    ideSigning.pipeline.preflightIdeNative();
  }
});

// Incremental SignHap can be UP-TO-DATE, which skips task.afterRun. Always
// verify the actual signed output after a successful package invocation.
hvigor.buildFinished((result) => {
  if (!result.getError() && (hvigor.getCommandEntryTask() || []).some(
    (name: string) => /(?:assemble|package|sign)Hap$/i.test(name))) verifyIdeOutput(ideSigning);
});

hvigor.nodesEvaluated(() => {
  for (const node of hvigor.getAllNodes()) {
    for (const task of node.getAllTasks()) {
      task.beforeRun(() => assertReaderHapInvocation([task.getName()], ideSigning));
      if (/(?:^|@)(?:SignHap|assembleHap)$/i.test(task.getName())) {
        task.afterRun(() => verifyIdeOutput(ideSigning));
      }
    }
  }
});

export default {
  system: appTasks,
  plugins: []
}
