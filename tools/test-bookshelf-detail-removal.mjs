// Coverage was consolidated into existing semantic contracts. No test is imported or silently executed.
export const coverageAdoption = {
  "kind": "reader-contract-coverage-adoption",
  "status": "NOT_RUN",
  "defaultExecution": "OFF",
  "adopted": [
    {
      "id": "H-bookshelf-removal-durable-intent",
      "file": "tools/test-bookshelf-removal-durable-intent.mjs",
      "coverage": "exact Core receipt、lost ACK/cold recover、original continuation、asset cleanup only after confirmed"
    },
    {
      "id": "H-bookshelf-removal-index-consumers",
      "file": "tools/test-bookshelf-removal-index-consumers.mjs",
      "coverage": "actual Index/Host exact-book/presentation/retired consumption"
    }
  ],
  "reason": "原source regex没有独有可观察行为；删除/确认/unknown/资产归属已有真实durable+Index行为入口，统一显式选择后者避免重复静态字形门禁。"
};
if (process.argv.length > 2 && !(process.argv.length === 3 && process.argv[2] === '--list')) throw new Error('This duplicate source gate has no executable case; select an adopted gate ID explicitly: ' + coverageAdoption.adopted.map(item => item.id).join(', '));
console.log(JSON.stringify(coverageAdoption));
