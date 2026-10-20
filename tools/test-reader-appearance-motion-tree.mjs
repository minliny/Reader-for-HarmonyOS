// Coverage was consolidated into existing semantic contracts. No test is imported or silently executed.
export const coverageAdoption = {
  "kind": "reader-contract-coverage-adoption",
  "status": "NOT_RUN",
  "defaultExecution": "OFF",
  "adopted": [
    {
      "id": "H-reader-control-appearance-geometry",
      "file": "tools/test-reader-control-appearance-geometry.mjs",
      "coverage": "actual shared motion sampling/current geometry endpoints and intermediate frames"
    },
    {
      "id": "H-reader-appearance-page-publication",
      "file": "tools/test-reader-appearance-page-publication.mjs",
      "coverage": "actual SDK appearance Props/font publication/current presentation guards"
    }
  ],
  "reason": "删除整套private方法名/Link字形/禁止animateTo等source结构门禁；共享motion行为与真实SDK页面发布已有合格语义入口，原源码regex不构成独立actor/指针/像素证明，不再重复执行。"
};
if (process.argv.length > 2 && !(process.argv.length === 3 && process.argv[2] === '--list')) throw new Error('This duplicate source gate has no executable case; select an adopted gate ID explicitly: ' + coverageAdoption.adopted.map(item => item.id).join(', '));
console.log(JSON.stringify(coverageAdoption));
