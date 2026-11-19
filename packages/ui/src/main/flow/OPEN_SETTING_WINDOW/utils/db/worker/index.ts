import 'reflect-metadata'
import { filterApplicationRecords } from '@geekgeekrun/utils/application-outcome.mjs'
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
import { PageReq, PagedRes, JobLibraryReq } from '../../../../../../common/types/pagination'
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
  async getJobLibrary({ pageNo, pageSize, companyName, companyId, companyOrder }: Partial<JobLibraryReq> = {}): Promise<PagedRes<VJobLibrary>> {
    if (!pageNo) {
      pageNo = 1
    }
    if (!pageSize) {
      pageSize = 10
    }

    const query = dataSource!.getRepository(VJobLibrary).createQueryBuilder('job')
    if (companyId) query.andWhere('job.encryptCompanyId = :companyId', { companyId })
    if (companyName?.trim()) query.andWhere('instr(lower(job.companyName), lower(:companyName)) > 0', { companyName: companyName.trim() })
    let companySortedIds: string[] | undefined
    let companySortedCount: number | undefined
    if (companyOrder) {
      const rows = await query.clone().select('job.encryptJobId', 'jobId')
        .addSelect('job.companyName', 'company')
        .addSelect('COALESCE((SELECT MAX(history.updateTime) FROM job_info_change_log history WHERE history.encryptJobId = job.encryptJobId), job.publishDate)', 'recordedAt')
        .orderBy('job.encryptJobId', 'ASC').getRawMany()
      const sorted = filterApplicationRecords(rows, { sortBy: 'company', sortOrder: companyOrder })
      companySortedCount = sorted.length
      const pageIds: string[] = sorted.slice((pageNo - 1) * pageSize, pageNo * pageSize).map(row => row.jobId)
      if (!pageIds.length) return { data: [], pageNo, totalItemCount: sorted.length }
      companySortedIds = pageIds
      query.andWhere('job.encryptJobId IN (:...companySortedIds)', { companySortedIds })
    }
    query.addSelect('(SELECT history.dataAsJson FROM job_info_change_log history WHERE history.encryptJobId = job.encryptJobId ORDER BY history.updateTime DESC, history.id DESC LIMIT 1)', 'rawJobInfo')
      .orderBy('job.publishDate', 'DESC').addOrderBy('job.encryptJobId', 'ASC')
      .skip(companySortedIds ? 0 : (pageNo - 1) * pageSize).take(pageSize)
    const [{ entities, raw }, totalItemCount] = await measureExecutionTime(
      Promise.all([query.getRawAndEntities(), companySortedCount ?? query.getCount()])
    )
    const data: (VJobLibrary & { salaryDesc?: string })[] = entities.map((job, index) => {
      let salaryDesc: string | undefined
      try {
        const source = JSON.parse(raw[index].rawJobInfo || '{}')
        if (typeof source.salaryDesc === 'string') salaryDesc = source.salaryDesc
      } catch {}
      return { ...job, salaryDesc }
    })
    if (companySortedIds) {
      const rank = new Map(companySortedIds.map((id, index) => [id, index]))
      data.sort((a, b) => rank.get(String(a.encryptJobId))! - rank.get(String(b.encryptJobId))!)
    }
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
