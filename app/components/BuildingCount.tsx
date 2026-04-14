type Props = {
  effective: number;
  total: number;
};

export const BuildingCount: React.FC<Props> = ({ effective, total }) => {
  const full = effective === total;
  const inactive = effective === 0 && total > 0;

  return (
    <span
      className={`text-sm font-medium ${
        inactive
          ? "text-gray-400"
          : full
            ? "text-green-600 dark:text-green-400"
            : "text-yellow-600 dark:text-yellow-400"
      }`}
    >
      {effective}/{total}
    </span>
  );
};
