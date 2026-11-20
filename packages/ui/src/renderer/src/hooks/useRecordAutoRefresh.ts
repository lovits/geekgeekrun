import { onMounted, onActivated, onDeactivated, onBeforeUnmount, watch } from 'vue'
import { useTaskManagerStore } from '@renderer/store'

export function useRecordAutoRefresh(refresh: () => Promise<unknown>, localRunning = () => false) {
  const tasks = useTaskManagerStore()
  const running = () => tasks.runningTasks.length > 0 || localRunning()
  let timer: ReturnType<typeof setInterval> | undefined
  let active = false
  let pending = false
  const run = async () => {
    if (pending) return
    pending = true
    try { await refresh() }
    catch (error) { console.error(error) }
    finally { pending = false }
  }
  const syncTimer = () => {
    clearInterval(timer)
    timer = active && running() ? setInterval(run, 120_000) : undefined
  }
  const start = () => {
    if (active) return
    active = true
    void run()
    syncTimer()
  }
  const stop = () => { active = false; clearInterval(timer); timer = undefined }
  watch(running, () => { if (active) void run(); syncTimer() })
  onMounted(start)
  onActivated(start)
  onDeactivated(stop)
  onBeforeUnmount(stop)
}
