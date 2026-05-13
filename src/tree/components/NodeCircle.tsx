import type { JSX } from "react";

type NodeCircleProps = {
  cx: number;
  cy: number;
  r: number;
  isSelected: boolean;
  color: string;
  onClick: (e: React.MouseEvent<SVGCircleElement>) => void;
  dataNodeId?: string;
};

export default function NodeCircle({
  cx,
  cy,
  r,
  isSelected,
  color,
  onClick,
  dataNodeId,
}: NodeCircleProps): JSX.Element {
  return (
    <circle
      cx={cx}
      cy={cy}
      r={r}
      fill={isSelected ? "#3b82f6" : color}
      stroke={isSelected ? "#1d4ed8" : "none"}
      strokeWidth={2}
      style={{ cursor: dataNodeId ? "grab" : "pointer" }}
      data-nodeid={dataNodeId}
      onClick={(e) => {
        e.stopPropagation();
        onClick(e);
      }}
    />
  );
}
