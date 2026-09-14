use reader_content::{BookSourceRequestContext, RemoteContentPipeline};
use reader_domain::{BookSourceContentSemantics, BookSourcePipelineRules, BookSourceSemantics};
fn extract(rule:&str,input:&str)->String { extract_with_replacement(rule,input,None,None) }
fn extract_with_replacement(rule:&str,input:&str,source_regex:Option<&str>,replace_regex:Option<&str>)->String {
 let semantics=BookSourceSemantics{source_id:"fixture".into(),name:"fixture".into(),base_url:"https://fixture.invalid".into(),rules:BookSourcePipelineRules{content:BookSourceContentSemantics{content:Some(rule.into()),source_regex:source_regex.map(String::from),replace_regex:replace_regex.map(String::from),..Default::default()},..Default::default()},..Default::default()};
 RemoteContentPipeline::new().content_book_source(&semantics,input,&BookSourceRequestContext::for_semantics(&semantics)).expect("extract").content
}
fn main(){
 let rule="<p>{{$.data.Content[0].Content}}</p>";
 for (name,body) in [
 ("array_strings_crlf", serde_json::json!({"data":{"Content":[{"Content":["第一段\r\n第二行","第三段"]}]}})),
 ("single_string_crlf", serde_json::json!({"data":{"Content":[{"Content":"第一段\r\n第二行"}]}})),
 ("array_literal_code", serde_json::json!({"data":{"Content":[{"Content":["代码字符：\\r\\n","另一段"]}]}})),
 ("array_html", serde_json::json!({"data":{"Content":[{"Content":["<p>第一段</p>","<p>第二段</p>"]}]}}))
 ] { println!("{}",serde_json::json!({"case":name,"input":body,"output":extract(rule,&body.to_string())})); }
}