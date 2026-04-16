declare global {
  type Metadata = any;
}

declare module 'next' {
  export type Metadata = any;
}

declare module 'next/font/google' {
  export function Geist(options: any): any;
  export function Geist_Mono(options: any): any;
}

declare module '*.css' {
  const content: Record<string, string>;
  export default content;
}
