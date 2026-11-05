/** Calculator time is measured in in-game months; display one useful unit. */
export const formatInGameDuration = (months: number) => {
  const inYears = months >= 12
  const value = inYears ? months / 12 : months
  const rounded = Math.round(value * 10) / 10
  const quantity = value > 0 && rounded === 0 ? '<0.1' : rounded.toLocaleString('en-US')
  const unit = inYears ? 'year' : 'month'

  return `${quantity} in-game ${unit}${rounded === 1 ? '' : 's'}`
}
