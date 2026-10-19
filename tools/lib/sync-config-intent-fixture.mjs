import {createSyncOwnerFixture} from '../fixtures/sync/receipt-owner-fixture.mjs';
// Cold class graph, shared controlled Asset port, same actual disk directory.
export function configIntentFixture(previous){
 const f=createSyncOwnerFixture({sharedAsset:previous?.asset});
 if(previous)f.setDirectory(previous.directory());
 return f;
}
