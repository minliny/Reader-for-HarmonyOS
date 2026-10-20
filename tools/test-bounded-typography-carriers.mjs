import {selectContractCases, recordContractCasePass} from './lib/contract-case-selection.mjs';
const definitions = {"directory-witness": {"description": "显式当期漫画目录规范witness定义维护", "resources": []}, "message-witness": {"description": "显式当前reviewed message scope定义维护", "resources": []}};
for (const id of selectContractCases(definitions)) {
  await runSelectedCase(id);
  recordContractCasePass(id);
}
async function runSelectedCase(selectedCase) {
const {validateMangaDirectoryTypographySuccessor,mangaDirectoryTypographySuccessor,validateMessageTypographySuccessor} = await import('./lib/approved-manga-typography-carriers.mjs');

if(selectedCase==='directory-witness') validateMangaDirectoryTypographySuccessor(mangaDirectoryTypographySuccessor);
else validateMessageTypographySuccessor();

}
