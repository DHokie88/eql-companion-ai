import { test } from 'node:test'
import assert from 'node:assert/strict'
import { defaultBuildStrategies, normalizeBuildStrategies, strategyWeights, strategyItemScore, strategyAllows } from '../src/shared/build/strategies'
import type { GearRow } from '../src/shared/planner/gear'
test('five named editable strategies have independent defaults and bounded overrides',()=>{
  const a=defaultBuildStrategies();a[0].weights.HP=9
  assert.deepEqual(defaultBuildStrategies()[0].weights,{})
  assert.equal(normalizeBuildStrategies([{id:'s1',name:'  Custom tank  ',weights:{HP:0,AC:Infinity,BOGUS:5}}])[0].name,'Custom tank')
  assert.deepEqual(normalizeBuildStrategies([{id:'s1',weights:{HP:0,AC:Infinity,BOGUS:5}}])[0].weights,{HP:0})
})
test('caps stop rewarding extra stats and zero disables the selected stat',()=>{
  const s=defaultBuildStrategies()[4];s.weights={HP:1,AC:0};s.caps={HP:20}
  assert.equal(strategyItemScore({HP:100,AC:99},s,['WAR']),20)
  assert.equal(strategyItemScore({HP:10,AC:99},s,['WAR']),10)
  s.weights.HP=0;assert.equal(strategyItemScore({HP:100,AC:99},s,['WAR']),0)
})
test('required unknown item facts fail minimums; weight edits do not change original defaults',()=>{
  const s=defaultBuildStrategies()[0];s.minimums={HP:5}
  assert.equal(strategyAllows({stats:{}} as GearRow,s),false)
  assert.equal(strategyAllows({stats:{HP:5}} as GearRow,s),true)
  const old=JSON.stringify(s);const weights=strategyWeights(s,['PAL','NEC','SHM']);weights.HP=999
  assert.equal(JSON.stringify(s),old)
})
