/* Browser-local choice only. This never writes to the hosted JSON file. */
(() => {
  'use strict';
  class VotingStore {
    constructor(pollId, candidateIds, storage = window.localStorage, lockManager = window.navigator.locks) {
      this.key = `poll_vote_${pollId}`;
      this.allowed = new Set(candidateIds);
      this.storage = storage;
      this.locks = lockManager;
      this.busy = false;
    }
    read() {
      try {
        const raw = this.storage.getItem(this.key);
        if (raw === null) return { kind: 'new', vote: null };
        const vote = JSON.parse(raw);
        if (!vote || typeof vote.candidate_id !== 'string' || !vote.candidate_id || typeof vote.voted_at !== 'string' || !Number.isFinite(Date.parse(vote.voted_at))) {
          return { kind: 'invalid', vote: null };
        }
        // Keep the poll locked even if its chosen candidate was later removed.
        return { kind: 'saved', vote };
      } catch (error) {
        return { kind: error instanceof SyntaxError ? 'invalid' : 'unavailable', vote: null };
      }
    }
    async save(candidateId) {
      if (this.busy) return { kind: 'busy' };
      if (!this.allowed.has(candidateId)) return { kind: 'unknown' };
      this.busy = true;
      const write = () => {
        const existing = this.read();
        if (existing.kind !== 'new') return existing;
        const vote = { candidate_id: candidateId, voted_at: new Date().toISOString() };
        try {
          const serialized = JSON.stringify(vote);
          this.storage.setItem(this.key, serialized);
          if (this.storage.getItem(this.key) !== serialized) return { kind: 'unavailable', vote: null };
          return { kind: 'created', vote };
        } catch { return { kind: 'unavailable', vote: null }; }
      };
      try {
        // On supported secure origins, serialize writes across browser tabs.
        return this.locks && typeof this.locks.request === 'function'
          ? await this.locks.request(this.key, write)
          : write();
      } catch { return { kind: 'unavailable', vote: null }; }
      finally { this.busy = false; }
    }
  }
  window.VotingStore = VotingStore;
})();
