/// <reference types="vite/client" />

import type { SpecApi } from '../../shared/ipc'

declare global {
  interface Window {
    spec: SpecApi
  }
}

declare module '*.ttf?inline' {
  const dataUri: string
  export default dataUri
}
