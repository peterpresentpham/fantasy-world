export type TFloatingPosition = { x: number; y: number };
export type TSize = { width: number; height: number };

/** Keeps a floating element fully inside its container. */
export function clampPosition(
  position: TFloatingPosition,
  element: TSize,
  container: TSize
): TFloatingPosition {
  const maxX = Math.max(0, container.width - element.width);
  const maxY = Math.max(0, container.height - element.height);
  return {
    x: Math.min(maxX, Math.max(0, position.x)),
    y: Math.min(maxY, Math.max(0, position.y)),
  };
}

export function isSamePosition(a: TFloatingPosition, b: TFloatingPosition) {
  return a.x === b.x && a.y === b.y;
}
