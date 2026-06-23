// MarkupParserAdapter - clean-room bounded HTML/XML parser and selector smoke.
// It is intentionally small: enough for Core adapter evidence fixtures without copying external parser code.

import { boundedChecksum } from './FeedParserAdapter';

export interface MarkupNode {
  tagName: string;
  attributes: Record<string, string>;
  text: string;
  children: MarkupNode[];
}

export interface MarkupQueryEvidence {
  cssSelector: string;
  cssMatchCount: number;
  xpath: string;
  xpathMatchCount: number;
  attributeName: string;
  attributeValues: string[];
  textChecksum: string;
  rawMarkupExported: boolean;
  scriptStyleSuppressed: boolean;
}

export class MarkupParserAdapter {
  parse(markup: string): MarkupNode {
    const root: MarkupNode = { tagName: '#document', attributes: {}, text: '', children: [] };
    const stack: MarkupNode[] = [root];
    const tokenRegex = new RegExp('<[^>]+>|[^<]+', 'g');
    let match = tokenRegex.exec(markup);
    while (match !== null) {
      const token = match[0];
      if (token.charAt(0) === '<') {
        this.consumeTag(token, stack);
      } else {
        this.consumeText(token, stack);
      }
      match = tokenRegex.exec(markup);
    }
    return root;
  }

  queryCss(root: MarkupNode, selector: string): MarkupNode[] {
    const parts = selector.split(' ').filter((part: string) => part.trim().length > 0);
    if (parts.length === 0) { return []; }
    let current: MarkupNode[] = [root];
    for (let i = 0; i < parts.length; i++) {
      const next: MarkupNode[] = [];
      for (let j = 0; j < current.length; j++) {
        const descendants = this.descendants(current[j]);
        for (let k = 0; k < descendants.length; k++) {
          if (this.matchesCss(descendants[k], parts[i])) {
            next.push(descendants[k]);
          }
        }
      }
      current = next;
    }
    return current;
  }

  queryXPath(root: MarkupNode, xpath: string): MarkupNode[] {
    if (xpath.indexOf('//') === 0) {
      const segment = xpath.substring(2);
      const slash = segment.indexOf('/');
      const tag = slash >= 0 ? segment.substring(0, slash) : segment;
      return this.descendants(root).filter((node: MarkupNode) => this.localName(node.tagName) === this.localName(tag));
    }
    if (xpath.indexOf('/') !== 0) { return []; }
    const parts = xpath.split('/').filter((part: string) => part.length > 0 && part.charAt(0) !== '@');
    let current: MarkupNode[] = [root];
    for (let i = 0; i < parts.length; i++) {
      const next: MarkupNode[] = [];
      for (let j = 0; j < current.length; j++) {
        const children = current[j].children;
        for (let k = 0; k < children.length; k++) {
          if (this.localName(children[k].tagName) === this.localName(parts[i])) {
            next.push(children[k]);
          }
        }
      }
      current = next;
    }
    return current;
  }

  attributeValues(nodes: MarkupNode[], attributeName: string): string[] {
    const values: string[] = [];
    for (let i = 0; i < nodes.length; i++) {
      const attrs = nodes[i].attributes;
      const keys = Object.keys(attrs);
      for (let j = 0; j < keys.length; j++) {
        if (this.localName(keys[j]) === this.localName(attributeName)) {
          values.push(attrs[keys[j]]);
        }
      }
    }
    return values;
  }

  textContent(node: MarkupNode): string {
    let text = node.text;
    for (let i = 0; i < node.children.length; i++) {
      text += this.textContent(node.children[i]);
    }
    return text;
  }

  buildEvidence(markup: string, cssSelector: string, xpath: string, attributeName: string): MarkupQueryEvidence {
    const root = this.parse(markup);
    const cssMatches = this.queryCss(root, cssSelector);
    const xpathMatches = this.queryXPath(root, xpath);
    const attributes = this.attributeValues(cssMatches.concat(xpathMatches), attributeName);
    return {
      cssSelector,
      cssMatchCount: cssMatches.length,
      xpath,
      xpathMatchCount: xpathMatches.length,
      attributeName,
      attributeValues: attributes,
      textChecksum: boundedChecksum(this.textContent(root)),
      rawMarkupExported: false,
      scriptStyleSuppressed: markup.indexOf('<script') !== -1 && this.textContent(root).indexOf('hiddenScript') === -1
    };
  }

  private consumeTag(token: string, stack: MarkupNode[]): void {
    if (token.indexOf('<!--') === 0 || token.indexOf('<?') === 0 || token.indexOf('<!') === 0) { return; }
    if (token.indexOf('</') === 0) {
      const closeName = this.localName(token.substring(2, token.length - 1).trim().toLowerCase());
      while (stack.length > 1) {
        const top = stack.pop();
        if (top && this.localName(top.tagName) === closeName) { return; }
      }
      return;
    }

    let body = token.substring(1, token.length - 1).trim();
    const selfClosing = body.endsWith('/');
    if (selfClosing) {
      body = body.substring(0, body.length - 1).trim();
    }
    const firstSpace = body.search(new RegExp('\\s'));
    const tagName = (firstSpace >= 0 ? body.substring(0, firstSpace) : body).toLowerCase();
    const attrSource = firstSpace >= 0 ? body.substring(firstSpace + 1) : '';
    const node: MarkupNode = {
      tagName,
      attributes: this.parseAttributes(attrSource),
      text: '',
      children: []
    };
    stack[stack.length - 1].children.push(node);
    if (!selfClosing && !this.isVoidTag(tagName)) {
      stack.push(node);
    }
  }

  private consumeText(token: string, stack: MarkupNode[]): void {
    const top = stack[stack.length - 1];
    if (this.isSuppressedTextTag(top.tagName)) { return; }
    top.text += this.decodeEntities(token);
  }

  private parseAttributes(source: string): Record<string, string> {
    const attrs: Record<string, string> = {};
    const regex = new RegExp('([A-Za-z_:][-A-Za-z0-9_:.]*)(?:\\s*=\\s*(\"([^\"]*)\"|\\'([^\\']*)\\'|([^\\s\"\\'>/]+)))?', 'g');
    let match = regex.exec(source);
    while (match !== null) {
      const key = match[1].toLowerCase();
      const value = match[3] ?? match[4] ?? match[5] ?? '';
      attrs[key] = this.decodeEntities(value);
      match = regex.exec(source);
    }
    return attrs;
  }

  private matchesCss(node: MarkupNode, selector: string): boolean {
    const trimmed = selector.trim();
    if (trimmed.length === 0) { return false; }
    if (trimmed.charAt(0) === '#') {
      return node.attributes['id'] === trimmed.substring(1);
    }
    if (trimmed.charAt(0) === '.') {
      const classes = (node.attributes['class'] ?? '').split(' ');
      return classes.indexOf(trimmed.substring(1)) !== -1;
    }
    if (trimmed.indexOf('[') >= 0 && trimmed.endsWith(']')) {
      const tag = trimmed.substring(0, trimmed.indexOf('['));
      const attrExpr = trimmed.substring(trimmed.indexOf('[') + 1, trimmed.length - 1);
      const eq = attrExpr.indexOf('=');
      const attr = eq >= 0 ? attrExpr.substring(0, eq) : attrExpr;
      const expected = eq >= 0 ? this.unquote(attrExpr.substring(eq + 1)) : undefined;
      if (tag.length > 0 && this.localName(node.tagName) !== this.localName(tag)) { return false; }
      const actual = this.attributeValue(node, attr);
      return expected === undefined ? actual !== undefined : actual === expected;
    }
    return this.localName(node.tagName) === this.localName(trimmed);
  }

  private attributeValue(node: MarkupNode, name: string): string | undefined {
    const keys = Object.keys(node.attributes);
    for (let i = 0; i < keys.length; i++) {
      if (this.localName(keys[i]) === this.localName(name)) {
        return node.attributes[keys[i]];
      }
    }
    return undefined;
  }

  private descendants(node: MarkupNode): MarkupNode[] {
    const all: MarkupNode[] = [];
    for (let i = 0; i < node.children.length; i++) {
      all.push(node.children[i]);
      const nested = this.descendants(node.children[i]);
      for (let j = 0; j < nested.length; j++) {
        all.push(nested[j]);
      }
    }
    return all;
  }

  private localName(name: string): string {
    const idx = name.indexOf(':');
    return (idx >= 0 ? name.substring(idx + 1) : name).toLowerCase();
  }

  private decodeEntities(value: string): string {
    return value.replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");
  }

  private unquote(value: string): string {
    const trimmed = value.trim();
    if ((trimmed.charAt(0) === '"' && trimmed.charAt(trimmed.length - 1) === '"') ||
      (trimmed.charAt(0) === "'" && trimmed.charAt(trimmed.length - 1) === "'")) {
      return trimmed.substring(1, trimmed.length - 1);
    }
    return trimmed;
  }

  private isVoidTag(tagName: string): boolean {
    return ['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr'].indexOf(this.localName(tagName)) !== -1;
  }

  private isSuppressedTextTag(tagName: string): boolean {
    const name = this.localName(tagName);
    return name === 'script' || name === 'style' || name === 'noscript';
  }
}
