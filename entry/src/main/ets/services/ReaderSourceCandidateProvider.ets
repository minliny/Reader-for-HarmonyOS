// ReaderSourceCandidateProvider — converts BookSource[] from
// BookSourceRepository.getCandidateSourcesForBook into the UI-facing
// ReaderSourceCandidate[] consumed by ReaderControlLayer.
//
// Evidence-bound:
// - `speed` is '未测' (no faked latency). Real per-source HTTP timing is
//   Task #3b (requires a book.search round-trip per source).
// - `latestChapter` is '未加载' (no faked chapter title). Real per-source
//   chapter title comes from book.toc after the user confirms a switch.
// - `state` is '当前' for the active sourceId, '可切换' for the rest.
//   '落后' is CONTRACT_ONLY until cross-source chapter-offset comparison
//   is implemented.
//
// No network access here — this is a pure local projection over
// BookSourceRepository state.
import { BookSource } from '../models/BookSource';
import { BookSourceRepository } from '../repository/BookSourceRepository';
import { ReaderSourceCandidate } from '../ui/ReaderUiState';

export class ReaderSourceCandidateProvider {
  private repository: BookSourceRepository;

  constructor(repository: BookSourceRepository) {
    this.repository = repository;
  }

  provide(currentSourceId: string): ReaderSourceCandidate[] {
    const sources: BookSource[] = this.repository.getCandidateSourcesForBook(currentSourceId);
    const candidates: ReaderSourceCandidate[] = [];
    for (let i = 0; i < sources.length; i++) {
      const s = sources[i];
      const isCurrent = s.bookSourceUrl === currentSourceId;
      const candidate = new ReaderSourceCandidate();
      candidate.source = s.bookSourceUrl;
      candidate.displayName = s.bookSourceName;
      candidate.speed = '未测';
      candidate.latestChapter = isCurrent ? '' : '未加载';
      candidate.state = isCurrent ? '当前' : '可切换';
      candidates.push(candidate);
    }
    return candidates;
  }
}
