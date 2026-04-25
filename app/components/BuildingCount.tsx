import { cn } from "@carbonid1/design-system";

interface Props {
  effective: number;
  total: number;
}

export const BuildingCount: React.FC<Props> = ({ effective, total }) => {
  const full = effective === total;
  const inactive = effective === 0 && total > 0;

  return (
    <span
      className={cn("text-sm font-medium", {
        "text-gray-400": inactive,
        "text-green-600 dark:text-green-400": !inactive && full,
        "text-yellow-600 dark:text-yellow-400": !inactive && !full,
      })}
    >
      {effective}/{total}
    </span>
  );
};
