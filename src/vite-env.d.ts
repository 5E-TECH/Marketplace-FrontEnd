/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  /** `true` — dev rejimi backendsiz, MSW mock'lari bilan (`.env.development`). */
  readonly VITE_API_MOCKS?: string;
  readonly VITE_SITE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
