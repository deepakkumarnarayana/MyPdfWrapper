import { PageRenderInfo } from '../types';

/**
 * Applies a 2D affine transform to a point.
 * @param point - The [x, y] point to transform.
 * @param transform - The 6-element affine transform matrix.
 * @returns The transformed [x, y] point.
 */
const applyTransform = (point: [number, number], transform: number[]): [number, number] => {
  const [x, y] = point;
  const [a = 1, b = 0, c = 0, d = 1, e = 0, f = 0] = transform;
  return [a * x + c * y + e, b * x + d * y + f];
};

/**
 * Inverts a 2D affine transform matrix.
 * @param transform - The 6-element affine transform matrix to invert.
 * @returns The inverted 6-element matrix.
 */
const invertTransform = (transform: number[]): number[] => {
  const [a = 1, b = 0, c = 0, d = 1, e = 0, f = 0] = transform;
  const det = a * d - b * c;
  if (!det) {
    console.error("Cannot invert a singular matrix.");
    return [1, 0, 0, 1, 0, 0];
  }
  const invDet = 1 / det;
  return [
    d * invDet, -b * invDet, -c * invDet, a * invDet,
    (c * f - d * e) * invDet, (b * e - a * f) * invDet,
  ];
};

/**
 * Converts viewport client coordinates to PDF page coordinates.
 * @param x - The client x-coordinate.
 * @param y - The client y-coordinate.
 * @param page - The PageRenderInfo object.
 * @returns The coordinates in PDF page space { x, y }.
 */
export const clientToPagePoint = (page: PageRenderInfo, x: number, y: number) => {
  const { canvas, viewport } = page;
  if (!canvas || !viewport) return { x: 0, y: 0 };

  const canvasRect = canvas.getBoundingClientRect();
  const canvasX = x - canvasRect.left;
  const canvasY = y - canvasRect.top;

  const inverseTransform = invertTransform(viewport.transform);
  const [pageX, pageY] = applyTransform([canvasX, canvasY], inverseTransform);

  return { x: pageX, y: pageY };
};