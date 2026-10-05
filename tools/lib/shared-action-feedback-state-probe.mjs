import assert from 'node:assert/strict';

// Exercise the modifier registered on the actual native hit target. This
// proves the source contract for press/cancel reset without inventing a touch
// dispatcher; HarmonyOS routing a physical Cancel into Normal remains a
// platform test, not a result of this SDK attribute probe.
export function sharedActionFeedbackReset(actor,native){
 const modifier=actor.attributeCalls.findLast(call=>call.id===native.id&&call.property==='attributeModifier')?.args[0];
 assert.ok(modifier&&typeof modifier.applyPressedAttribute==='function','real hit target registers pressed feedback');
 const values={},target=new Proxy({}, {get:(_target,key)=>(...args)=>{values[key]=args.length===1?args[0]:args;return target;}});
 modifier.applyNormalAttribute(target);const normal=structuredClone(values);
 modifier.applyPressedAttribute(target);modifier.applyNormalAttribute(target);
 assert.deepEqual(values,normal,'real modifier restores the original finite native tuple on cancel/normal reset');
 return normal;
}
