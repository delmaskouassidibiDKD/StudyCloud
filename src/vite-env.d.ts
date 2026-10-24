/// <reference types="vite/client" />

declare const __STUDYCLOUD_BUILD_ID__: string;

declare module 'html2canvas' {
  interface Html2CanvasOptions {
    scale?: number;
    useCORS?: boolean;
    allowTaint?: boolean;
    backgroundColor?: string | null;
    logging?: boolean;
    scrollX?: number;
    scrollY?: number;
    windowWidth?: number;
    windowHeight?: number;
    width?: number;
    height?: number;
    x?: number;
    y?: number;
    foreignObjectRendering?: boolean;
    removeContainer?: boolean;
    onclone?: (document: Document, element: HTMLElement) => void;
    ignoreElements?: (element: Element) => boolean;
    [key: string]: any;
  }
  const html2canvas: (element: HTMLElement, options?: Html2CanvasOptions) => Promise<HTMLCanvasElement>;
  export default html2canvas;
}
