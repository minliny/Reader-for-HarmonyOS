// Coverage was consolidated into existing semantic contracts. No test is imported or silently executed.
export const coverageAdoption = {
  "kind": "reader-contract-coverage-adoption",
  "status": "NOT_RUN",
  "defaultExecution": "OFF",
  "adopted": [
    {
      "id": "H-bookshelf-management-shared-owner",
      "file": "tools/test-bookshelf-management-shared-owner.mjs",
      "coverage": "actual Index→Host→single management owner captured presentation"
    },
    {
      "id": "H-bookshelf-removal-index-consumers",
      "file": "tools/test-bookshelf-removal-index-consumers.mjs",
      "coverage": "actual captured Runtime/Host consumption、retired callback admission"
    }
  ],
  "reason": "删除重复Host/import/私有方法字符串验收；真实owner与captured runtime边界已有独立actual Index/Host语义覆盖，旧名拼写不再阻断等价重构。"
};
if (process.argv.length > 2 && !(process.argv.length === 3 && process.argv[2] === '--list')) throw new Error('This duplicate source gate has no executable case; select an adopted gate ID explicitly: ' + coverageAdoption.adopted.map(item => item.id).join(', '));
console.log(JSON.stringify(coverageAdoption));
