// Reader demo session identity and shape mapping, separate from outcome samples.
export const readingModules=['reader-controls','reader-directory','reader-tts','reader-appearance','reader-settings','reader-search','reader-autopage','reader-replace'];
export const bookSurfaces=['detail','directory','reader',...readingModules,'reader-tts-config','reader-tts-manager','reader-more','book-actions','book-removal','group-select','manga-mode','manga-settings','manga-more','manga-downloads'];
export function setDemoBook(choices,book) {
  if(!book)return false;
  const changed=choices['selected-book']?.id!==book.id;
  choices['selected-book']={...book};choices['book-kind']=book.kind;
  choices['directory-fixture']=book.content;
  if(changed){
    delete choices['reader-chapter-index'];
    for(const key of Object.keys(choices))if(key.startsWith('directory-group-')||key.startsWith('directory-query-')||key.startsWith('directory-node-'))delete choices[key];
  }
  return changed;
}
export function bookFromNode(node,books,currentBook) {
  if(!node?.dataset.bookId)return;
  const found=books.find(b=>b.id===node.dataset.bookId);
  if(found){const book=currentBook?.id===found.id?currentBook:found;return node.dataset.bookPosition==='none'?{...book,mangaPosition:undefined}:book;}
  return {id:node.dataset.bookId,kind:node.dataset.bookKind||'online',content:node.dataset.bookContent||'novel',
    title:node.dataset.bookTitle,author:node.dataset.bookAuthor,source:node.dataset.bookSource,chapter:node.dataset.bookChapter};
}
export function bookForSample(books,variant='') {
  const kind=variant.startsWith('local')||variant==='local'?'local':'online';
  const content=variant.includes('manga')?'manga':'novel';
  const book=books.find(b=>b.kind===kind&&b.content===content)||books[0];
  return variant.includes('unread')?{...book,mangaPosition:undefined}:book;
}
export function readingFormVariant(screen,variant,form) {
  if(form==='quick')return screen.quickVariantByFull?.[variant]||variant;
  return Object.entries(screen.quickVariantByFull||{}).find(([,quick])=>quick===variant)?.[0]||
    (screen.variants.some(v=>v.id==='full')?'full':variant);
}
export function readingIsFull(screen,variant) {return Boolean(screen.quickVariantByFull?.[variant]);}
export function localChoiceValue(value) {return value==='true'?true:value==='false'?false:value;}
// SourceToolsOrchestrator.open preserves an in-flight/unknown/failed-refresh
// session. Preview choices project those existing guards without Core writes.
export function sourceToolsSessionProtected(choices) {
  const recovery=choices['source-recovery-snapshot']||{};
  return Boolean(choices['source-tools-busy']||choices['source-editor-save-unknown']||recovery.unknown||choices['source-recovery-state']==='receipt-refresh-failed');
}
