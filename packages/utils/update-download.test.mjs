import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { downloadReleaseAsset } from './update-download.mjs'
import { updateCheckDue } from './update-schedule.mjs'
const release={assetName:'GeekGeekRun_x64_setup.exe',assetUrl:'https://github.com/lovits/geekgeekrun-pro/releases/download/ui-v0.19.0/app.exe',releaseVersion:'0.19.0'}
test('automatic checks happen at most every 24 hours while manual checks remain available',()=>{
 const now=Date.parse('2026-11-19T06:00:00Z')
 assert.equal(updateCheckDue('2026-11-19T05:00:00Z',now),false)
 assert.equal(updateCheckDue('2026-11-18T06:00:00Z',now),true)
 assert.equal(updateCheckDue('2026-11-19T05:00:00Z',now,true),true)
 assert.equal(updateCheckDue('',now),true)
})
test('downloads only own release package, verifies digest and cleans up interrupted files', async t=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'ggr-update-'));t.after(()=>fs.rm(dir,{recursive:true,force:true}))
 const bytes=Buffer.from('test installer bytes'), digest='sha256:'+createHash('sha256').update(bytes).digest('hex')
 const request=async()=>new Response(bytes,{headers:{'Content-Length':String(bytes.length)}})
 const downloaded=await downloadReleaseAsset({...release,assetDigest:digest},dir,{request})
 assert.deepEqual(await fs.readFile(downloaded.path),bytes)
 await assert.rejects(downloadReleaseAsset({...release,assetDigest:'sha256:bad'},dir,{request}),/校验失败/)
 await assert.rejects(downloadReleaseAsset(release,dir,{request:async()=>new Response('',{status:503})}),/503/)
 await assert.rejects(downloadReleaseAsset({...release,assetName:'../bad.exe'},dir,{request}),/文件名/)
 await assert.rejects(downloadReleaseAsset({...release,assetUrl:'https://example.com/x.exe'},dir,{request}),/个人仓库/)
 assert.deepEqual(await fs.readdir(dir),[release.assetName])
})
