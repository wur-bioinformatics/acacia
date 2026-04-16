/// <reference types="vite/client" />
/// <reference types="vite-plugin-svgr/client" />

export {};
declare module "react" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface InputHTMLAttributes<T> {
    // browser-supported attribute for <input type="color"> (not yet in TS lib types)
    colorspace?: string;
  }
}
