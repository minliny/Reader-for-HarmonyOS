use reader_content::{BookSourceRequestContext, RemoteContentPipeline};
use reader_domain::Source;
use reader_js::{HostCallbackRegistry, JsRuntimeConfig, QuickJsSandbox};
use std::sync::{atomic::{AtomicUsize, Ordering}, Arc};
fn source(path: &str) -> Source {
 let raw:serde_json::Value=serde_json::from_str(&std::fs::read_to_string(path).unwrap()).unwrap();
 Source { source_id:"controlled-fixture".into(), name:raw["bookSourceName"].as_str().unwrap().into(), base_url:raw["bookSourceUrl"].as_str().unwrap().into(), rules:Default::default(), book_source:raw }
}
fn main() {
 let root="/Users/minliny/Documents/Reader/Reader-Core-Native/tests/fixtures/corpus/sources";
 let source66=source(&format!("{root}/src-669-d510a10eb1ba.json"));
 let semantics=source66.book_source_semantics().unwrap();
 let initial=r#"{"bookId":123456,"id":234567,"v":0}"#.as_bytes().iter().map(|b|format!("{b:02x}")).collect::<String>();
 for (case,response) in [
  ("content_string",r#"{"data":{"content":"第一段\r\n第二段"}}"#),
  ("message_only",r#"{"code":1,"message":"synthetic upstream unavailable"}"#),
  ("empty_content_message",r#"{"data":{"content":""},"message":"synthetic rate limit"}"#),
  ("content_array",r#"{"data":{"content":["第一段","第二段"]}}"#),
  ("content_object",r#"{"data":{"content":{"unexpected":"object"}}}"#),
  ("invalid_json",r#"<html>synthetic challenge</html>"#),
  ("missing_data_and_message",r#"{"code":1}"#),
 ] {
  let calls=Arc::new(AtomicUsize::new(0)); let capture=calls.clone();
  let mut registry=HostCallbackRegistry::new();
  registry.register("java.ajax",move |_| {capture.fetch_add(1,Ordering::SeqCst); Ok(serde_json::json!(response))});
  let pipeline=RemoteContentPipeline::with_js_sandbox(QuickJsSandbox::with_host_callbacks(JsRuntimeConfig::default(),registry));
  let mut context=BookSourceRequestContext::for_semantics(&semantics); context.book_url="https://m.qidian.com/book/123456/".into(); context.current_url="data:;base64,synthetic".into();
  match pipeline.content_book_source(&semantics,&initial,&context) {
   Ok(page)=>println!("{}",serde_json::json!({"source":"66-exact","stage":"content","case":case,"synthetic":true,"output":page.content,"empty":page.content.trim().is_empty(),"hostCalls":calls.load(Ordering::SeqCst)})),
   Err(e)=>println!("{}",serde_json::json!({"source":"66-exact","stage":"content","case":case,"synthetic":true,"error":e.to_string(),"hostCalls":calls.load(Ordering::SeqCst)}))
  }
 }
 for (case,response) in [
  ("valid",r#"{"data":{"vs":[{"cs":[{"id":123,"cN":"第一章","sS":0,"uT":"2026","cnt":100}]}]}}"#),
  ("empty",r#"{"data":{"vs":[]}}"#),
  ("missing_data",r#"{"code":1,"message":"synthetic unavailable"}"#),
  ("invalid_json",r#"<html>synthetic challenge</html>"#),
 ] {
  let calls=Arc::new(AtomicUsize::new(0)); let capture=calls.clone(); let mut registry=HostCallbackRegistry::new();
  registry.register("java.ajax",move |_| {capture.fetch_add(1,Ordering::SeqCst); Ok(serde_json::json!(response))});
  let pipeline=RemoteContentPipeline::with_js_sandbox(QuickJsSandbox::with_host_callbacks(JsRuntimeConfig::default(),registry));
  let mut context=BookSourceRequestContext::for_semantics(&semantics); context.book_url="https://m.qidian.com/book/123456/".into(); context.current_url=context.book_url.clone();
  match pipeline.toc_book_source(&semantics,"<html>synthetic</html>",&context) {
   Ok(toc)=>println!("{}",serde_json::json!({"source":"66-exact","stage":"toc","case":case,"synthetic":true,"chapters":toc.chapters.len(),"hostCalls":calls.load(Ordering::SeqCst)})),
   Err(e)=>println!("{}",serde_json::json!({"source":"66-exact","stage":"toc","case":case,"synthetic":true,"error":e.to_string(),"hostCalls":calls.load(Ordering::SeqCst)}))
  }
 }
 let songhe=source(&format!("{root}/src-2869-9f23ceb11a82.json")).book_source_semantics().unwrap();
 for (case,value) in [
  ("actual_crlf_array",serde_json::json!(["第一段\r\n第二行","第三段"])),
  ("literal_code_array",serde_json::json!(["代码：\\r\\n","第二段"])),
  ("html_array",serde_json::json!(["<p>第一段</p>","<p>第二段</p>"])),
  ("string",serde_json::json!("第一段\r\n第二段")),
  ("number",serde_json::json!(42)),("null",serde_json::Value::Null),("empty_array",serde_json::json!([])),
  ("nested",serde_json::json!([{"name":"object"},["nested","array"]])),
 ] {
  let input=serde_json::json!({"data":{"Content":[{"Content":value}]}}).to_string();
  let context=BookSourceRequestContext::for_semantics(&songhe);
  let result=RemoteContentPipeline::new().content_book_source(&songhe,&input,&context).unwrap();
  println!("{}",serde_json::json!({"source":"songhe-exact","stage":"content","case":case,"synthetic":true,"output":result.content,"empty":result.content.trim().is_empty()}));
 }
}
