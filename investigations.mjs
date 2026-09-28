import { hydrateDataset, scopeOf, metricIds, descriptor, answer } from './engine.mjs';
const fail = (status, message) => Object.assign(Error(message), { status });
export function investigationDraft(input, snapshot) {
  if (input.sourceVersion !== snapshot.sourceVersion) throw fail(409, 'Refresh the source and repin evidence before saving this investigation.');
  hydrateDataset(snapshot);
  const freeze = ref => {
    if (!ref || !metricIds.includes(ref.metricId)) throw fail(400, 'Invalid investigation metric.');
    if (ref.sourceVersion && ref.sourceVersion !== snapshot.sourceVersion) throw fail(409, 'Pinned evidence is stale. Reopen and repin it before saving.');
    let scope; try { scope = scopeOf(ref.scope); } catch (e) { throw fail(400, e.message); }
    const d = descriptor(ref.metricId, scope);
    const formatted = answer({question:'Explain '+d.id,scope}, {intent:'metric',metricId:d.id,caseId:null,overrides:{}}, 'demo').facts[0].value;
    return {key:[d.id,scope.function,scope.region,scope.period].join('|'),metricId:d.id,metricLabel:d.label,scope,scopeLabel:[scope.function,scope.region,scope.period].join(' · '),value:d.value,formatted,unit:d.unit,numerator:d.numerator??null,denominator:d.denominator??null,definition:d.definition,period:d.period,source:d.source,snapshot:snapshot.asOf,sourceVersion:snapshot.sourceVersion};
  };
  const observation=freeze(input), fields={};
  for (const [key,max] of [['question',500],['notes',4000]]) {
    const value=input[key]??'';
    if (typeof value!=='string'||value.length>max) throw fail(400, key+' exceeds its text limit.');
    fields[key]=value.trim();
  }
  if (!Array.isArray(input.evidenceLedger??[])||(input.evidenceLedger||[]).length>50) throw fail(400,'An investigation allows up to 50 pinned observations.');
  if (!['facts','alternatives','decision'].includes(input.challenge??'facts')) throw fail(400,'Invalid investigation challenge.');
  return {...fields,metricId:observation.metricId,scope:observation.scope,challenge:input.challenge??'facts',observation,evidenceLedger:(input.evidenceLedger||[]).map(freeze),sourceVersion:snapshot.sourceVersion};
}
