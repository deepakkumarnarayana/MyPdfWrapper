export interface PageRenderInfo {
  pageNumber: number;
  canvas: HTMLCanvasElement;
  textLayer: HTMLDivElement;
  annotationLayer: HTMLDivElement;
  container: HTMLDivElement;
  scale: number | string;
  rotation: number;
  rendered: boolean;
  rendering: boolean;
  textContent: any;
  annotations: any[];
}

export interface Highlight {
  id: string;
  pageNumber: number;
  rects: { x: number; y: number; width: number; height: number }[];
  color: string;
  text: string;
  timestamp: Date;
}

export interface ContextMenuState {
  mouseX: number;
  mouseY: number;
  text: string;
  highlightId?: string;
}

export interface ZoomOption {
  value: string;
  label: string;
}

export interface PdfRenderConfig {
  scale: number;
  rotation: number;
  zoomSelect: string;
  maxConcurrentRenders: number;
}