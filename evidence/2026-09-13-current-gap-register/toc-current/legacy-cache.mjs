import { registerHooks } from 'node:module';
registerHooks({resolve(s,c,n){try{return n(s,c)}catch(e){if(s.startsWith('.')&&!s.endsWith('.ts'))return n(s+'.ts',c);throw e}}});
const { BookAcquisitionCoordinator } = await import('/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/app/BookAcquisitionCoordinator.ts');
const calls=[];
const runtime=new BookAcquisitionCoordinator(async(method,p)=>{calls.push(method);switch(method){
case 'source.list':return {data:{sources:[{sourceId:'s',enabled:true,sourceVersion:'v1'}]}};
case 'search-book.get':return {data:{book:{origin:'s',bookUrl:'b',name:'Book',author:'A'}}};
case 'cache.book.status':return {data:{sourceId:'s',bookId:'b',tocAvailable:true,chapters:[{chapterIndex:0,title:'Saved',url:'https://example.test/chapter',variables:{}}]}};
case 'book.detail':return {data:{sourceId:'s',book:{bookId:'b',title:'Book',author:'A'},tocUrl:'https://example.test/toc',sourceVersion:'v1'}};
case 'book.toc':return {data:{sourceId:'s',bookId:'b',toc:[]}};
default:throw new Error(method)}});
try{await runtime.acquireBook({sourceId:'s',bookId:'b',detailUrl:'https://example.test/book',title:'Book',author:'A'});throw new Error('unexpected success')}catch(e){process.stdout.write(JSON.stringify({probe:'durable_toc_without_acquisition_facts',code:e.code,calls,diagnostic:e.diagnostic})+'\n')};runtime.close();
