import type { JSX } from "react";
import { useNJStore } from "./njStore";

export default function DistanceMatrix(): JSX.Element {
  const { distanceMatrix, avgDistance } = useNJStore();

  if (!distanceMatrix) return <div />;

  const { names, matrix } = distanceMatrix;

  const maxValue = Math.max(...matrix.flatMap((row) => row));

  function cellStyle(i: number, j: number): React.CSSProperties {
    if (i === j) return {};
    const intensity = maxValue > 0 ? matrix[i][j] / maxValue : 0;
    const r = Math.round(255 * (1 - intensity * 0.6));
    const g = Math.round(255 * (1 - intensity));
    const b = Math.round(255 * (1 - intensity));
    return { backgroundColor: `rgb(${r},${g},${b})` };
  }

  return (
    <div className="flex flex-col h-full gap-3">
      {avgDistance !== null && (
        <div className="flex items-center gap-2 text-sm">
          <span className="font-medium">Average distance:</span>
          <span className="badge badge-neutral font-mono">{avgDistance.toFixed(4)}</span>
        </div>
      )}
      <div className="overflow-auto flex-1">
        <table className="text-xs border-collapse">
          <thead>
            <tr>
              <th className="sticky top-0 left-0 z-20 bg-base-100 p-1" />
              {names.map((name) => (
                <th
                  key={name}
                  className="sticky top-0 z-10 bg-base-100 p-1 font-mono whitespace-nowrap max-w-24 overflow-hidden text-ellipsis"
                  title={name}
                >
                  {name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {names.map((rowName, i) => (
              <tr key={rowName}>
                <td
                  className="sticky left-0 z-10 bg-base-100 p-1 font-mono whitespace-nowrap font-medium max-w-24 overflow-hidden text-ellipsis"
                  title={rowName}
                >
                  {rowName}
                </td>
                {names.map((_colName, j) => (
                  <td
                    key={j}
                    className="p-1 text-center font-mono tabular-nums border border-base-200"
                    style={cellStyle(i, j)}
                  >
                    {i === j ? "—" : matrix[i][j].toFixed(3)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
