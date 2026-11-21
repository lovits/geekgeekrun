export interface PageReq {
  pageNo: number
  pageSize: number
}
export interface PagedRes<T = unknown> {
  data: T[]
  pageNo: number
  totalItemCount: number
}

export interface JobLibraryReq extends PageReq {
  companyName?: string
  companyId?: string
  companyOrder?: 'ascending' | 'descending' | null
}

export interface CompanyLibraryReq extends PageReq {
  scale?: string | string[]
  industry?: string | string[]
}
