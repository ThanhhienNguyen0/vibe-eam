import { useEffect, useRef, useState } from "react";
import { useReactFlow, useStore, useViewport } from "reactflow";
import { rulerTicks } from "./diagramLayout";

const RULER = 22;

/**
 * Coordinate system for the diagram canvas (BUG-02): rulers along the top and left edge, dashed axes through the
 * origin and a live readout of the cursor position in diagram coordinates. Render inside <ReactFlow>.
 */
export default function DiagramCoordinates({ showRulers }: { showRulers: boolean }) {
  const { x, y, zoom } = useViewport();
  const width = useStore((state) => state.width);
  const height = useStore((state) => state.height);
  const { screenToFlowPosition } = useReactFlow();
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const frame = useRef<number>();

  // Pointer tracking lives here so that moving the mouse never re-renders the whole editor.
  useEffect(() => {
    const surface = overlayRef.current?.closest(".react-flow");
    if (!surface) return;
    const onMove = (event: Event) => {
      const { clientX, clientY } = event as MouseEvent;
      if (frame.current) cancelAnimationFrame(frame.current);
      frame.current = requestAnimationFrame(() => {
        const point = screenToFlowPosition({ x: clientX, y: clientY });
        setCursor({ x: Math.round(point.x), y: Math.round(point.y) });
      });
    };
    const onLeave = () => setCursor(null);
    surface.addEventListener("mousemove", onMove);
    surface.addEventListener("mouseleave", onLeave);
    return () => {
      surface.removeEventListener("mousemove", onMove);
      surface.removeEventListener("mouseleave", onLeave);
      if (frame.current) cancelAnimationFrame(frame.current);
    };
  }, [screenToFlowPosition]);

  const horizontal = showRulers ? rulerTicks(x, width, zoom) : [];
  const vertical = showRulers ? rulerTicks(y, height, zoom) : [];
  const originVisible = { x: x >= 0 && x <= width, y: y >= 0 && y <= height };

  return (
    <div ref={overlayRef} className="diagram-coordinates" aria-hidden="true">
      {showRulers && (
        <svg className="diagram-coordinates-svg" width={width} height={height}>
          {originVisible.x && <line className="diagram-axis" x1={x} x2={x} y1={0} y2={height} />}
          {originVisible.y && <line className="diagram-axis" x1={0} x2={width} y1={y} y2={y} />}
          <rect className="diagram-ruler-bg" x={0} y={0} width={width} height={RULER} />
          <rect className="diagram-ruler-bg" x={0} y={0} width={RULER} height={height} />
          {horizontal.map((tick) => (
            <g key={`h${tick.value}`}>
              <line className="diagram-ruler-tick" x1={tick.screen} x2={tick.screen} y1={RULER - 6} y2={RULER} />
              {tick.screen > RULER + 8 && <text className="diagram-ruler-label" x={tick.screen + 3} y={12}>{tick.value}</text>}
            </g>
          ))}
          {vertical.map((tick) => (
            <g key={`v${tick.value}`}>
              <line className="diagram-ruler-tick" x1={RULER - 6} x2={RULER} y1={tick.screen} y2={tick.screen} />
              {tick.screen > RULER + 8 && (
                <text className="diagram-ruler-label" transform={`translate(11 ${tick.screen - 3}) rotate(-90)`}>{tick.value}</text>
              )}
            </g>
          ))}
          <rect className="diagram-ruler-corner" x={0} y={0} width={RULER} height={RULER} />
        </svg>
      )}
      <div className="diagram-readout" title="Position des Mauszeigers im Diagramm">
        {cursor ? `x ${cursor.x} · y ${cursor.y}` : "x – · y –"} · {Math.round(zoom * 100)} %
      </div>
    </div>
  );
}
