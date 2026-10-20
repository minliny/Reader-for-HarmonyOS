// Coverage was consolidated into existing semantic contracts. No test is imported or silently executed.
export const coverageAdoption = {
  "kind": "reader-contract-coverage-adoption",
  "status": "NOT_RUN",
  "defaultExecution": "OFF",
  "adopted": [
    {
      "id": "H-bookshelf-management-shared-owner",
      "file": "tools/test-bookshelf-management-shared-owner.mjs",
      "coverage": "real shared Management owner/Host、serialized mutations、captured current identity和unknown receipt重开恢复"
    }
  ],
  "reason": "原CRUD协议/operationTail/旧分组入口regex归并实际shared-owner语义；旧文案/已移除入口不再作为发布阻断，保原owner行为覆盖。"
};
if (process.argv.length > 2 && !(process.argv.length === 3 && process.argv[2] === '--list')) throw new Error('This duplicate source gate has no executable case; select an adopted gate ID explicitly: ' + coverageAdoption.adopted.map(item => item.id).join(', '));
console.log(JSON.stringify(coverageAdoption));
