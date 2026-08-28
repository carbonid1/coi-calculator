export const formatBuildingLoad = (value: number) => {
  const rounded = parseFloat(value.toFixed(2));

  // Do not let rounding hide that the load crossed a whole-building boundary.
  // For example, 2.005 still needs a third building, so present it as 2.01.
  if (Number.isInteger(rounded) && value - rounded > 0.000001) {
    return rounded + 0.01;
  }

  return rounded;
};
