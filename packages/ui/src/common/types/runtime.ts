export interface RuntimeStep { step?: { status: string }; runRecordId?: number }
export interface RunningTask { workerId: string; args?: string[]; runtimeStorage?: { stepStatusMapByStepId?: Record<string, RuntimeStep> } }
export interface JobSourceConfig { type: string; enabled: boolean; label?: string; children?: { type: string; enabled: boolean; keyword?: string }[] }
