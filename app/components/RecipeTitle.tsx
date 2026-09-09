import { ResourceTooltip } from './ResourceToken'

/** Keep descriptions available without repeating the resource flow below the title. */
export const RecipeTitle = ({ title, descriptions }: { title: string; descriptions: string[] }) => {
  const detail = [...new Set(descriptions)].filter(description => (
    description.trim().toLocaleLowerCase() !== title.trim().toLocaleLowerCase()
  )).join('\n')

  return detail ? (
    <ResourceTooltip label={title} detail={detail}
      className="min-h-0 p-0 text-left text-base font-semibold whitespace-normal leading-normal">
      {title}
    </ResourceTooltip>
  ) : <>{title}</>
}
