export const formatBuildingLoad = (value: number) => {
  if (value > 0 && value < 0.01) return 0.01;

  return parseFloat(value.toFixed(2));
};
