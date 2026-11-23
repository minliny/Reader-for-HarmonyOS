/** Closed original rule methods. Pure metadata: no Runtime, state or platform IO. */
export const RULES_MUTATION_METHODS: string[] = ['replace.persist', 'txt-toc-rule.create', 'txt-toc-rule.update',
  'txt-toc-rule.delete', 'dict-rule.put', 'dict-rule.delete', 'rule-sub.put', 'rule-sub.delete', 'rule-bundle.import', 'source.import', 'rss-source.import', 'reader.chinese-conversion.put', 'source.update', 'source.delete',
  'rss-source.put', 'rss.subscription.persist', 'rss.subscription.remove', 'rss.entry.read', 'rss.favorite.persist', 'rss.favorite.remove',
  'reading.directory.rules.apply.v2'];
