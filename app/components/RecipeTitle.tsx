import { Tooltip } from '@carbonid1/design-system'

/** Keep descriptions available without repeating the resource flow below the title. */
export const RecipeTitle = ({ title, descriptions }: { title: string; descriptions: string[] }) => {
  const detail = [...new Set(descriptions)].filter(description => (
    description.trim().toLocaleLowerCase() !== title.trim().toLocaleLowerCase()
  )).join('\n')

  return detail ? (
    <Tooltip.Root>
      <Tooltip.Trigger delay={400} render={<span tabIndex={0}
        className="-mx-1.5 -my-0.5 inline-block cursor-text select-text rounded px-1.5 py-0.5 text-base font-semibold leading-normal outline-hidden focus-visible:ring-2 focus-visible:ring-ring" />}>
        {title}
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Positioner>
          <Tooltip.Popup className="max-w-[min(22rem,calc(100vw-1rem))] flex-col items-start gap-1 whitespace-normal [overflow-wrap:anywhere]">
            <span className="block font-medium">{title}</span>
            <span className="block whitespace-pre-line">{detail}</span>
          </Tooltip.Popup>
        </Tooltip.Positioner>
      </Tooltip.Portal>
    </Tooltip.Root>
  ) : <>{title}</>
}
