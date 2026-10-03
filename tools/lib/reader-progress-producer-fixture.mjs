import { ReadingSessionProgressOwner } from '../../entry/src/main/ets/features/reading/ReadingSessionProgressOwner.ts';

/** Older method probes provide a storage writer plus a serial I/O gate. This
 * explicit fixture adds the real durable owner/CAS-admission contract around
 * that controlled storage, without copying its production drain algorithm. */
export function withReaderProgressProducerFixture(Probe) {
  return class ProgressProbe extends Probe {
    fixtureOwners = new Map();
    progressProducerIntent(...args) {
      const intent = super.progressProducerIntent(...args);
      if (typeof intent.gateway.persistPresentedProgress === 'function') return intent;
      const gateway = intent.gateway, key = JSON.stringify([intent.sourceId,intent.bookId]);
      let state = this.fixtureOwners.get(key);
      if (!state) {
        state = { row: undefined, revision: 0 };
        state.owner = new ReadingSessionProgressOwner({ supportsCoreCapability:()=>true,
          captureReadingContentValidity:()=>()=>true }, intent.sourceId,intent.bookId,
          operation=>gateway.runProgressCommitSerial(operation));
        this.fixtureOwners.set(key,state);
      }
      const read = async current => {
        if (!current()) throw Error('fixture content retired');
        const value = gateway.loadProgress ? await gateway.loadProgress(intent.bookId,current) :
          state.row ? {kind:'restored',progress:state.row} : {kind:'missing'};
        return {...value,progressRevision:value.progressRevision ?? `fixture-op:${state.revision}`};
      };
      const write = async (title,anchor,layout,current) => {
        const stored=await gateway.resolveAndUpdateProgress(intent.bookId,title,anchor,layout,current);
        state.revision++;
        state.row={...stored,updatedAt:stored.updatedAt ?? state.revision};
        return state.row;
      };
      return {...intent,gateway:{...gateway,
        loadProgress:(_book,current)=>read(current),
        runProgressCommitSerial:operation=>state.owner.runSerial(operation),
        persistPresentedProgress:(_book,title,anchor,layout,admitted)=>
          state.owner.persistPresented(title,anchor,layout,{read,write},admitted),
      }};
    }
  };
}
