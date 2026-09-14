#[path="/Users/minliny/Documents/Reader/Reader-Core-Native/crates/reader-runtime/src/remote/text_position_anchors.rs"]
mod anchor;
fn main() {
    let first = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
    let second = "正文第一段结束接下来是独特的另一段落字符用于测试位置保护不应该因格式改变猜测旧坐标请完整保留未证明的阅读信息";
    let old = format!("[\"{first}\",\"{second}\"]");
    let new = format!("{first}\n{second}");
    let chars = old.chars().collect::<Vec<_>>();
    for offset in [0, 30, 50, chars.len() as u64] {
        let mut positions = vec![anchor::Position{chapter:0,offset,resolved:None,anchors:vec![]}];
        let mut anchors = vec![];
        let result = anchor::add_anchor(&mut positions[0],&mut anchors,&chars)
            .and_then(|_|anchor::resolve(&mut positions,&mut anchors,[(0,new.clone())]));
        println!("offset={offset};result={result:?};resolved={:?}", positions[0].resolved);
    }
}
