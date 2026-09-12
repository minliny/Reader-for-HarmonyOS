import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const source=readFileSync(new URL('../entry/src/main/cpp/bookturn/bookturn_napi.cpp',import.meta.url),'utf8');
const host=readFileSync(new URL('../entry/src/main/cpp/bookturn/bookturn_host.h',import.meta.url),'utf8');
function block(text,signature){const start=text.indexOf(signature);assert.ok(start>=0,signature);let end=text.indexOf('{',start)+1,depth=1;
  while(depth){if(text[end]==='{')depth++;if(text[end]==='}')depth--;end++;}return text.slice(start,end);}
const payload=block(source,'struct EventPayload');
const bridge=block(source,'struct CallbackBridge {');
const callback=block(source,'void CallJsEvent(');
// Compile the actual payload and JS dispatcher. Only NAPI/Host boundaries are mocked.
// Before the fix there is no stamp in the payload; the same delayed-delivery
// scenarios still execute and fail on the observable JS callback count.
const cpp=`
#include <atomic>
#include <cstdint>
#include <cstdio>
#include <memory>
using napi_env=void*; using napi_value=void*; using napi_threadsafe_function=void*;
constexpr int napi_tsfn_abort=0;
int calls=0, failures=0, checks=0;
void napi_release_threadsafe_function(void*,int){}
void napi_get_undefined(void*,void** value){*value=nullptr;}
void napi_create_int32(void*,int32_t,void**){}
void napi_create_double(void*,double,void**){}
void napi_call_function(void*,void*,void*,int,void**,void*){calls++;}
${block(host,'enum class HostEvent')};
struct BookTurnHost {uint64_t epoch=5;uint64_t SurfaceEpoch()const{return epoch;}};
${bridge};
${payload};
${callback}
void Check(const char* label,bool ok){checks++;if(!ok){failures++;std::printf("FAIL %s\\n",label);}}
EventPayload* Queue(const std::shared_ptr<BookTurnHost>& host,const std::shared_ptr<CallbackBridge>& bridge,HostEvent event){
  (void)host;(void)bridge;auto* p=new EventPayload();p->event=event;p->generation=7;p->detail=0;
  ${payload.includes('surfaceEpoch')?'p->surfaceEpoch=host->SurfaceEpoch();':''}
  ${payload.includes('std::weak_ptr<BookTurnHost>')?'p->host=host;':''}
  ${payload.includes('std::weak_ptr<CallbackBridge>')?'p->bridge=bridge;':''}
  return p;
}
void Dispatch(EventPayload* payload){CallJsEvent(reinterpret_cast<void*>(1),reinterpret_cast<void*>(2),nullptr,payload);}
int main(){
  auto h=std::make_shared<BookTurnHost>();auto b=std::make_shared<CallbackBridge>();
  for(int kind=1;kind<=9;kind++){
    const auto event=static_cast<HostEvent>(kind);calls=0;Dispatch(Queue(h,b,event));Check("current event delivered",calls==1);
    auto* stale=Queue(h,b,event);h->epoch++;calls=0;Dispatch(stale);Check("queued old surface event rejected",calls==0);
  }
  auto* replaced=Queue(h,b,HostEvent::RENDER_FAILURE);
  ${bridge.includes('std::atomic<bool> active')?'b->active.store(false,std::memory_order_release);':''}
  calls=0;Dispatch(replaced);Check("retired callback cannot deliver queued failure",calls==0);
  b=std::make_shared<CallbackBridge>();auto* expiredBridge=Queue(h,b,HostEvent::SURFACE_READY);b.reset();
  calls=0;Dispatch(expiredBridge);Check("expired callback discarded",calls==0);
  b=std::make_shared<CallbackBridge>();auto* expiredHost=Queue(h,b,HostEvent::TEXTURE_READY);h.reset();
  calls=0;Dispatch(expiredHost);Check("expired host discarded",calls==0);
  h=std::make_shared<BookTurnHost>();calls=0;CallJsEvent(nullptr,nullptr,nullptr,Queue(h,b,HostEvent::SURFACE_LOST));
  Check("closing NAPI environment only frees payload",calls==0);
  std::printf("event delivery: %d checks, %d failures\\n",checks,failures);return failures?1:0;
}`;
const scratch=mkdtempSync(path.join(tmpdir(),'reader-native-event-'));
try{
  writeFileSync(path.join(scratch,'dispatch.cpp'),cpp);
  const compile=spawnSync('c++',['-std=c++17','-O2','-Wall','-Wextra','-Werror',path.join(scratch,'dispatch.cpp'),'-o',path.join(scratch,'dispatch')],{encoding:'utf8',timeout:120000});
  assert.equal(compile.status,0,compile.stdout+compile.stderr);
  const run=spawnSync(path.join(scratch,'dispatch'),[],{encoding:'utf8',timeout:10000});
  assert.equal(run.status,0,run.stdout+run.stderr);process.stdout.write(run.stdout);
  assert.match(source,/previous->second->active\.store\(false, std::memory_order_release\)/,'replacement retires the old registration');
  assert.match(source,/EventPayload\s*\{\s*event, generation, detail, surfaceEpoch, weakHost, bridge\s*\}/,'enqueue uses the original Host epoch');
}finally{rmSync(scratch,{recursive:true,force:true});}
