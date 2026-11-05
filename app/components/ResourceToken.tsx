'use client'

import { Button, cn, Tooltip } from '@carbonid1/design-system'
import { type ReactNode, useId, useState } from 'react'

import { type ResourceId } from '../db/resources'
import { getProductIconUrl } from '../helpers/products/products'
import { useResourceNavigation } from './ResourceNavigation'
import { useProductState } from './ResourceProducts'

/** The same reveal behavior for an icon or an authored recipe configuration. */
export const ResourceTooltip = ({ label, detail, className, children, onClick }: {
  label: string
  detail?: string
  className?: string
  children: ReactNode
  onClick?: () => void
}) => {
  const [open, setOpen] = useState(false)
  const triggerId = useId()

  return (
    <Tooltip.Root open={open} onOpenChange={setOpen} triggerId={triggerId}>
      <Tooltip.Trigger id={triggerId} delay={400} closeOnClick={false}
        onClick={() => {
          if (onClick) {
            setOpen(false)
            onClick()
          } else {
            setOpen(true)
          }
        }}
        render={<Button type="button" variant="ghost" size="small" aria-label={detail ? `${label} · ${detail}` : label}
          className={cn('h-auto min-h-7 w-fit justify-start gap-1 px-0.5 py-0 align-middle', className)} />}>
        {children}
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Positioner>
          <Tooltip.Popup className="max-w-[min(22rem,calc(100vw-1rem))] flex-col items-start gap-1 whitespace-normal [overflow-wrap:anywhere]">
            <span className="block font-medium">{label}</span>
            {detail && <span className="block whitespace-pre-line">{detail}</span>}
          </Tooltip.Popup>
        </Tooltip.Positioner>
      </Tooltip.Portal>
    </Tooltip.Root>
  )
}

/** Named tokens are inert by default for use inside links and menu items. */
export const ResourceToken = ({ resourceId, named = false, interactive = !named, detail, amount, layout = 'inline', className, onInspect }: {
  resourceId: ResourceId
  named?: boolean
  interactive?: boolean
  detail?: string
  amount?: ReactNode
  layout?: 'inline' | 'stacked'
  className?: string
  onInspect?: () => void
}) => {
  const inspectResource = useResourceNavigation()
  const { resources, products } = useProductState()
  const onClick = interactive ? onInspect ?? (inspectResource ? () => inspectResource(resourceId) : undefined) : undefined
  const [failedSource, setFailedSource] = useState<string>()
  const source = getProductIconUrl(resources[resourceId].productId, products?.sessionId)
  const name = resources[resourceId].name
  const showImage = source && source !== failedSource
  const stacked = layout === 'stacked' && named && amount != null
  const textColumn = showImage ? 'col-start-2' : 'col-start-1'
  const content = (
    <>
      {showImage && (
        // The game's icons have a fixed display size, including the loading state.
        <span className={cn('inline-flex shrink-0', amount != null && !stacked && 'px-1.5', stacked && 'row-span-2')}>
          <img src={source} alt="" width={28} height={28} className="size-7 shrink-0 object-contain"
            decoding="async" onError={() => setFailedSource(source)} />
        </span>
      )}
      {(named || !showImage) && <span className={stacked ? cn(textColumn, 'row-start-2 min-w-0 text-xs wrap-break-word') : undefined}>{name}</span>}
      {amount != null && <span className={cn('font-mono text-sm font-normal tabular-nums whitespace-nowrap text-foreground', stacked && cn(textColumn, 'row-start-1 font-semibold'))}>{amount}</span>}
    </>
  )

  if (!interactive || (!showImage && !detail && !onClick && amount == null)) {
    return <span className={cn('inline-flex min-w-0 items-center gap-1.5 align-middle', stacked && cn('grid gap-x-2 gap-y-0', showImage ? 'grid-cols-[1.75rem_minmax(0,1fr)]' : 'grid-cols-1'), className)}>{content}</span>
  }

  return (
    <ResourceTooltip label={name} detail={detail} onClick={onClick}
      className={cn('p-1.5', amount != null && 'min-w-10 flex-col justify-center gap-0.5 px-0', className)}>{content}</ResourceTooltip>
  )
}
