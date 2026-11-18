// Integrator import support: buildAudition echoes validated sourceId with its result.
import { buildAudition } from './audition-core.mjs';
// Worker-only side effect; safe to import in Node.
if (typeof self !== 'undefined' && typeof self.postMessage === 'function' && typeof document === 'undefined') {
 self.onmessage = event => {
  const id = event?.data?.id;
  try {
   if (!Number.isSafeInteger(id) || id < 1) throw new Error('Invalid request id');
   const result=buildAudition(event.data.settings);
   self.postMessage({id,result},[result.wavBytes.buffer]);
  } catch(error) { self.postMessage({id,error:error instanceof Error ? error.message : String(error)}); }
 };
}
