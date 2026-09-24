'use client';

import useThreeMap from 'src/hooks/useThreeMap';

export default function ThreeMapView() {
  const containerRef = useThreeMap();

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 h-full w-full cursor-grab active:cursor-grabbing"
    />
  );
}
