import 'reflect-metadata'
import { parentPort } from 'node:worker_threads'
import { initDb } from '@geekgeekrun/sqlite-plugin'
import { type DataSource } from 'typeorm'
import { getPublicDbFilePath } from '@geekgeekrun/geek-auto-start-chat-with-boss/runtime-file-utils.mjs'
import { VChatStartupLog } from '@geekgeekrun/sqlite-plugin/dist/entity/VChatStartupLog'
import { VJobLibrary } from '@geekgeekrun/sqlite-plugin/dist/entity/VJobLibrary'
import { VCompanyLibrary } from '@geekgeekrun/sqlite-plugin/dist/entity/VCompanyLibrary'
import { VBossLibrary } from '@geekgeekrun/sqlite-plugin/dist/entity/VBossLibrary'
import { VMarkAsNotSuitLog } from '@geekgeekrun/sqlite-plugin/dist/entity/VMarkAsNotSuitLog'
import { measureExecutionTime } from '../../../../../../common/utils/performance'
import { PageReq, PagedRes } from '../../../../../../common/types/pagination'
import { JobInfoChangeLog } from '@geekgeekrun/sqlite-plugin/dist/entity/JobInfoChangeLog'
import { AutoStartChatRunRecord } from '@geekgeekrun/sqlite-plugin/dist/entity/AutoStartChatRunRecord'

const dbInitPromise = initDb(getPublicDbFilePath())
let dataSource: DataSource | null = null

dbInitPromise.then(
  (_dataSource) => {
    dataSource = _dataSource
    attachMessageHandler()
    parentPort?.postMessage({
      type: 'DB_INIT_SUCCESS'
    })
  },
  (error) => {
    parentPort?.postMessage({
      type: 'DB_INIT_FAIL',
      error
    })
    process.exit(1)
  }
)

const payloadHandler = {
  async getSimulationJobs() {
    return dataSource!.query(`SELECT j.*,
      (SELECT dataAsJson FROM job_info_change_log h WHERE h.encryptJobId=j.encryptJobId ORDER BY updateTime DESC,id DESC LIMIT 1) rawJobInfo,
      (SELECT MAX(updateTime) FROM job_info_change_log h WHERE h.encryptJobId=j.encryptJobId) sourceUpdatedAt
      FROM v_job_library j WHERE trim(coalesce(j.description,''))<>''
      AND NOT EXISTS (SELECT 1 FROM chat_startup_log c WHERE c.encryptJobId=j.encryptJobId)
      ORDER BY sourceUpdatedAt DESC,j.encryptJobId`).then(rows => rows.map(row => {
        let raw: any = {}
        try { raw = JSON.parse(row.rawJobInfo || '{}') } catch {}
        const { rawJobInfo, ...job } = row
        return { ...job, jobType: raw.jobType, invalidStatus: raw.invalidStatus, salaryDesc: raw.salaryDesc }
      })).catch(() => ({ simulationError: true }))
  },
  async exportRuntimeData() {
    return dataSource!.transaction(async manager => {
      const tables = await manager.query("SELECT name FROM sqlite_master WHERE type IN ('table', 'view') AND name NOT LIKE 'sqlite_%' AND name NOT IN ('migrations', 'typeorm_metadata') ORDER BY name")
      const output = {}
      for (const { name } of tables) output[name] = await manager.query(`SELECT * FROM "${name.replaceAll('"', '""')}"`)
      return output
    }).catch(error => ({ exportError: String(error) }))
  },
  async getAutoStartChatRecord({ pageNo, pageSize }: Partial<PageReq> = {}): Promise<
    PagedRes<VChatStartupLog>
  > {
    if (!pageNo) {
      pageNo = 1
    }
    if (!pageSize) {
      pageSize = 10
    }

    const userRepository = dataSource!.getRepository(VChatStartupLog)!
    const [data, totalItemCount] = await measureExecutionTime(
      userRepository.findAndCount({
        skip: (pageNo - 1) * pageSize,
        take: pageSize,
        order: {
          date: 'DESC'
        }
      })
    )
    return {
      data,
      pageNo,
      totalItemCount
    }
  },
  async getMarkAsNotSuitRecord({ pageNo, pageSize }: Partial<PageReq> = {}): Promise<
    PagedRes<VMarkAsNotSuitLog>
  > {
    if (!pageNo) {
      pageNo = 1
    }
    if (!pageSize) {
      pageSize = 10
    }
    const recordRepository = dataSource!.getRepository(VMarkAsNotSuitLog)!
    const [data, totalItemCount] = await measureExecutionTime(
      recordRepository.findAndCount({
        skip: (pageNo - 1) * pageSize,
        take: pageSize,
        order: {
          date: 'DESC'
        }
      })
    )
    return {
      data,
      pageNo,
      totalItemCount
    }
  },
  async getJobLibrary({ pageNo, pageSize }: Partial<PageReq> = {}): Promise<PagedRes<VJobLibrary>> {
    if (!pageNo) {
      pageNo = 1
    }
    if (!pageSize) {
      pageSize = 10
    }

    const userRepository = dataSource!.getRepository(VJobLibrary)!
    const [data, totalItemCount] = await measureExecutionTime(
      userRepository.findAndCount({
        skip: (pageNo - 1) * pageSize,
        take: pageSize
      })
    )
    return {
      data,
      pageNo,
      totalItemCount
    }
  },
  async getCompanyLibrary({ pageNo, pageSize }: Partial<PageReq> = {}): Promise<
    PagedRes<VCompanyLibrary>
  > {
    if (!pageNo) {
      pageNo = 1
    }
    if (!pageSize) {
      pageSize = 10
    }

    const userRepository = dataSource!.getRepository(VCompanyLibrary)!
    const [data, totalItemCount] = await measureExecutionTime(
      userRepository.findAndCount({
        skip: (pageNo - 1) * pageSize,
        take: pageSize
      })
    )
    return {
      data,
      pageNo,
      totalItemCount
    }
  },
  async getBossLibrary({ pageNo, pageSize }: Partial<PageReq> = {}): Promise<
    PagedRes<VBossLibrary>
  > {
    if (!pageNo) {
      pageNo = 1
    }
    if (!pageSize) {
      pageSize = 10
    }

    const userRepository = dataSource!.getRepository(VBossLibrary)!
    const [data, totalItemCount] = await measureExecutionTime(
      userRepository.findAndCount({
        skip: (pageNo - 1) * pageSize,
        take: pageSize
      })
    )
    return {
      data,
      pageNo,
      totalItemCount
    }
  },
  async getJobHistoryByEncryptId({ encryptJobId }): Promise<JobInfoChangeLog[]> {
    const jobInfoChangeLogRepository = dataSource!.getRepository(JobInfoChangeLog)!
    const data = await measureExecutionTime(
      jobInfoChangeLogRepository.find({
        where: {
          encryptJobId
        }
      })
    )
    return data
  },
  async saveAndGetCurrentRunRecord() {
    const autoStartChatRunRecord = new AutoStartChatRunRecord()
    autoStartChatRunRecord.date = new Date()
    const autoStartChatRunRecordRepository = dataSource!.getRepository(AutoStartChatRunRecord)
    const result = await autoStartChatRunRecordRepository.save(autoStartChatRunRecord)
    return result
  }
}

async function attachMessageHandler() {
  parentPort?.on('message', async (event) => {
    const { _uuid, ...restObj } = event
    const { type } = event

    if (!dataSource) {
      await dbInitPromise
    }
    const result = await payloadHandler[type](restObj)
    parentPort?.postMessage({
      _uuid,
      data: result
    })
  })
}
