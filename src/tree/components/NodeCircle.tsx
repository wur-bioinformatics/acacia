import type { JSX } from "react";

type NodeCircleProps = {
  cx: number;
  cy: number;
  r: number;
  isSelected: boolean;
  color: string;
  didDragRef: React.RefObject<boolean>;
  onClick: (e: React.MouseEvent<SVGCircleElement>) => void;
};

export default function NodeCircle({
  cx,
  cy,
  r,
  isSelected,
  color,
  didDragRef,
  onClick,
}: NodeCircleProps): JSX.Element {
  return (
    <circle
      cx={cx}
      cy={cy}
      r={r}
      fill={isSelected ? "#3b82f6" : color}
      stroke={isSelected ? "#1d4ed8" : "none"}
      strokeWidth={2}
      style={{ cursor: "pointer" }}
      onClick={(e) => {
        if (didDragRef.current) return;
        e.stopPropagation();
        onClick(e);
      }}
    />
  );
}
