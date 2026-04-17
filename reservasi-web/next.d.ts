declare module 'next' {
  export interface Metadata {
    title?: string;
    description?: string;
    [key: string]: any;
  }
  export * from 'next/dist/types';
}

declare module 'next/font/google' {
  export function Geist(options: any): any;
  export function Geist_Mono(options: any): any;
}
