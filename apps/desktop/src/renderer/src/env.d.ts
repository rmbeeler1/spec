/// <reference types="vite/client" />

// Shape of the API the preload script exposes on window.
interface Window {
  spec: {
    platform: string
  }
}
