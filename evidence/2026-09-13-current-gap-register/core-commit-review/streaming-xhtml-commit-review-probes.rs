#[cfg(test)]
mod commit_review_probes {
    use super::*;
    fn large_fragment(fragment: &str) -> String {
        format!("{fragment}<!--{}-->", "padding".repeat(20000))
    }
    #[test]
    fn threshold_preserves_html_void_br() {
        let short = "<p>first<br>second</p>";
        assert_eq!(extract_xhtml_dom_content_with_anchors(&large_fragment(short), None), extract_xhtml_dom_content_with_anchors(short, None));
    }
    #[test]
    fn threshold_preserves_script_raw_text_semantics() {
        let short = "<script>var sample = '<style>';</script><p id='kept'>visible</p>";
        assert_eq!(extract_xhtml_dom_content_with_anchors(&large_fragment(short), None), extract_xhtml_dom_content_with_anchors(short, None));
    }
    #[test]
    fn threshold_preserves_navigation_anchor_after_4096() {
        let short = (0..4100).map(|i| format!("<span id='a{i}'>x</span>")).collect::<String>();
        assert_eq!(extract_xhtml_dom_content_with_anchors(&large_fragment(&short), None).1.get("a4099"), extract_xhtml_dom_content_with_anchors(&short, None).1.get("a4099"));
    }
    #[test]
    fn threshold_preserves_html_raw_text() {
        let short = "<p>before</p><textarea>A &amp; <p>literal</textarea><p>after</p>";
        assert_eq!(extract_xhtml_dom_content_with_anchors(&large_fragment(short), None), extract_xhtml_dom_content_with_anchors(short, None));
    }
}
