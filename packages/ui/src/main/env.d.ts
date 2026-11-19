declare module '*?nodeWorker&url' {
  import type { Worker } from 'node:worker_threads'
  const createWorker: (options?: import('node:worker_threads').WorkerOptions) => Worker
  export default createWorker
}
interface Element { __vue__: any }

interface PromiseWithResolvers<T> { promise: Promise<T>; resolve: (value: T | PromiseLike<T>) => void; reject: (reason?: unknown) => void }
interface PromiseConstructor { withResolvers<T = void>(): PromiseWithResolvers<T> }
