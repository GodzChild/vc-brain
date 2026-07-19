/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Backend origin for API calls in production (unset in dev — Vite proxies /api). */
  readonly VITE_API_BASE?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
