import { appTasks } from '@ohos/hvigor-ohos-plugin';
import { hvigor } from '@ohos/hvigor';

const { assertCanonicalHapInvocation } = require('./hvigor/reader-hap-guard.cjs');

hvigor.taskGraphResolved(() => {
  assertCanonicalHapInvocation(hvigor.getCommandEntryTask() || []);
});

hvigor.nodesEvaluated(() => {
  for (const node of hvigor.getAllNodes()) {
    for (const task of node.getAllTasks()) {
      task.beforeRun(() => assertCanonicalHapInvocation([task.getName()]));
    }
  }
});

export default {
  system: appTasks,
  plugins: []
}
