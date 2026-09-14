use reader_content::{BookSourceRequestContext, RemoteContentPipeline};
use reader_domain::{BookSourceContentSemantics, BookSourcePipelineRules, BookSourceSemantics};
fn extract(rule:&str,input:&str)->String { extract_with_replacement(rule,input,None,None) }
fn extract_with_replacement(rule:&str,input:&str,source_regex:Option<&str>,replace_regex:Option<&str>)->String {
 let semantics=BookSourceSemantics{source_id:"fixture".into(),name:"fixture".into(),base_url:"https://fixture.invalid".into(),rules:BookSourcePipelineRules{content:BookSourceContentSemantics{content:Some(rule.into()),source_regex:source_regex.map(String::from),replace_regex:replace_regex.map(String::from),..Default::default()},..Default::default()},..Default::default()};
 RemoteContentPipeline::new().content_book_source(&semantics,input,&BookSourceRequestContext::for_semantics(&semantics)).expect("extract").content
}
fn main(){
 let cases=[
 ("json_path_actual_crlf", "$.data.content", r#"{"data":{"content":"甲\r\n乙\n丙"}}"#,"甲\n乙\n丙"),
 ("json_js_actual_crlf", "<js>JSON.parse(result).data.content</js>",r#"{"data":{"content":"甲\r\n乙\n丙"}}"#,"甲\n乙\n丙"),
 ("json_literal_code_preserved", "$.data.content", r#"{"data":{"content":"代码字符串：\\r\\n，路径 C:\\reader\\novel"}}"#,r#"代码字符串：\r\n，路径 C:\reader\novel"#),
 ("json_double_encoded_stays_literal", "$.data.content", r#"{"data":{"content":"甲\\r\\n乙\\r\\n丙"}}"#,r#"甲\r\n乙\r\n丙"#),
 ("explicit_nested_json_decode", "<js>JSON.parse(JSON.parse(result).data.content)</js>",r#"{"data":{"content":"\"甲\\r\\n乙\""}}"#,"甲\n乙"),
 ("html_literal_code_preserved", "<js>result</js>", r#"<pre>代码字符串：\r\n，路径 C:\reader\novel</pre>"#,r#"代码字符串：\r\n，路径 C:\reader\novel"#),
 ("html_attribute_gt", "<js>result</js>", r#"<p title=">">甲</p><p>乙</p>"#,"甲\n乙"),
 ("html_script_excluded", "<js>result</js>", "<p>甲</p><script>bad()</script><style>bad{}</style><p>乙</p>","甲\n乙"),
 ("html_named_entity", "<js>result</js>", "<p>甲&copy;&lrm;&eacute;</p>","甲©\u{200e}é")];
 let mut mismatch=0;
 for (id,rule,input,expected) in cases {
  let actual=extract(rule,input);
  let matched=actual==expected;
  if !matched {mismatch+=1;}
  println!("{}",serde_json::json!({"id":id,"match":matched,"actual":actual,"expected":expected}));
 }
 let replacement_cases=[
 ("standalone_replace_rule_is_skipped", "正文广告",None,Some("##广告"),"正文"),
 ("standalone_escape_decode_rule_is_skipped", r#"甲\r\n乙"#,None,Some(r#"<js>result.split(String.fromCharCode(92)+'r'+String.fromCharCode(92)+'n').join('\n')</js>"#),"甲\n乙"),
 ("source_regex_must_not_mutate_body", "正文",Some("正文"),None,"正文")];
 for (id,input,source,replace,expected) in replacement_cases {
  let actual=extract_with_replacement("<js>result</js>",input,source,replace);
  let matched=actual==expected;if !matched {mismatch+=1;}
  println!("{}",serde_json::json!({"id":id,"match":matched,"actual":actual,"expected":expected}));
 }
 println!("{}",serde_json::json!({"mismatch":mismatch,"cases":cases.len()+replacement_cases.len()}));
}
