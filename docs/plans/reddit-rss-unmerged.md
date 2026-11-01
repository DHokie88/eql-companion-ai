# Preserved Reddit RSS release-note draft

Status: unmerged work, not a delivered Oracle feature. Preserved on 2026-11-01
while finishing the independent wiki-data and timer-audio integration.

The prior working tree contained the proposed entry below without its matching
Reddit implementation. It is kept here so a future authorized Reddit task can
recover it, rather than showing it as an available feature in What's New.
The separate app worktree is `C:/Users/andrew/EQL/worktrees/reddit-rss-community`;
backend work was recorded under `/home/andrew/eql-reddit-rss-20261025`.
This upgrade does not resume those workers or publish their unfinished changes.

```typescript
  {
    version: '0.15.0',
    date: '2026-10-25',
    entries: [
      { kind: 'new', text: 'New in EQL includes recent r/EQLegends posts through its public RSS feed. Filter by Reddit, see when it was checked, or search saved post text with Ask EQ Oracle. Replies are not collected.' },
      { kind: 'changed', text: 'Highlights can combine Discord and Reddit evidence into one must-read story. Reddit posts remain unverified player reports; ordinary questions and chatter do not qualify automatically.' },
      { kind: 'new', text: 'Reddit refreshes alongside the existing scheduled and startup checks without waiting for a long Discord harvest. Failed checks keep the last usable Reddit snapshot and show its freshness separately.' }
    ]
  },
```
