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
  viewport: any; // Add viewport for coordinate calculations
  annotations: any[];
}

export interface BasicHighlight {
  id: string;
  pageNumber: number;
  quadPoints: number[]; // [x1, y1, x2, y2, x3, y3, x4, y4]
}

export interface Highlight {
  id: string;
  pageNumber: number;
  rects: Array<{ x: number; y: number; width: number; height: number }>;
  color: string;
  text: string;
  timestamp: Date;
  opacity?: number;
  visible?: boolean;
}

export interface HighlightColor {
  name: string;
  value: string;
  displayName?: string;
}

export interface HighlightSettings {
  selectedColor: string;
  thickness: number;
  opacity: number;
  showAll: boolean;
  defaultColors: HighlightColor[];
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