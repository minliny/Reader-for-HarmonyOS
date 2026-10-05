// Same actual production Gateway/Host fault matrix, with both complete Host
// classes emitted by the installed Harmony SDK. This proves emitted JS
// behavior; complete project ArkTS and Index/ArkUI consumption are separate.
process.env.READER_READING_OWNER_SDK='1';
await import('./test-reader-directory-host.mjs');
await import('./test-reading-offline-host.mjs');
console.log('PASS Harmony SDK complete TS owner emission + actual Gateway contracts; NOT full project ArkTS or ArkUI/device acceptance');
