import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { listCodexModels } from './codex-models.mjs'
test('reads paginated model metadata and supported reasoning efforts from CLI', async () => {
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'models-test-'))
 try {
  const exe=path.join(dir,'codex');await fs.writeFile(exe,`#!/usr/bin/env node\nconst rl=require('readline').createInterface({input:process.stdin});rl.on('line',l=>{const m=JSON.parse(l);if(m.id===1)console.log(JSON.stringify({id:1,result:{}}));if(m.id===2)console.log(JSON.stringify({id:2,result:{data:[{model:m.params.cursor?'model-b':'model-a',displayName:'Model',supportedReasoningEfforts:[{reasoningEffort:'high',description:'High'}]}],nextCursor:m.params.cursor?null:'next'}}))});`,{mode:0o700})
  const models=await listCodexModels({binary:exe});assert.equal(models.length,2);assert.equal(models[1].id,'model-b');assert.equal(models[0].supportedReasoningEfforts[0].reasoningEffort,'high')
 }finally{await fs.rm(dir,{recursive:true,force:true})}
})
