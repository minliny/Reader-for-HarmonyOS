use std::sync::{Arc, Mutex};
use reader_contract::{Command, Event};
use reader_runtime::{remote::{dispatch_remote, RemoteState}, sink::EventSink};
struct Sink;
impl EventSink for Sink { fn emit(&self, event: &Event) { println!("event: {event:?}"); } }
fn main() {
    for (label, rule) in [
        ("bookUrl context", "@js: typeof bookUrl !== 'undefined' && bookUrl === 'https://example.test/book/1' ? java.getElements('a') : []"),
        ("baseUrl positive control", "@js: baseUrl === 'https://example.test/toc/1' ? java.getElements('a') : []"),
    ] {
        let state=RemoteState::new();
        let cmd=Command::new(1,"book.toc",serde_json::json!({
            "sourceId":"probe", "bookId":"https://example.test/book/1", "tocUrl":"https://example.test/toc/1",
            "tocResponse":"<a href='/chapter/1'>Chapter one</a>",
            "source":{"sourceId":"probe","name":"Probe","baseUrl":"https://example.test","rules":{},
                "bookSource":{"bookSourceUrl":"https://example.test","bookSourceName":"Probe",
                    "ruleToc":{"chapterList":rule,"chapterName":"text","chapterUrl":"href"}}}
        }));
        let sink:Arc<dyn EventSink>=Arc::new(Sink);
        let active=Arc::new(Mutex::new(std::collections::HashSet::<u64>::new()));
        println!("{label}: {:?}",dispatch_remote("book.toc",&cmd,&sink,&active,&state));
    }
}
