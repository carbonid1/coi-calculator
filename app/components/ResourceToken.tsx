'use client'

import { Button, cn, Tooltip } from '@carbonid1/design-system'
import { type ReactNode, useId, useState } from 'react'

import { resourceIcons } from '../db/resource-icons'
import { resources, type ResourceId } from '../db/resources'
import { useResourceNavigation } from './ResourceNavigation'

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
export const ResourceToken = ({ resourceId, named = false, interactive = !named, detail, amount, className, onInspect }: {
  resourceId: ResourceId
  named?: boolean
  interactive?: boolean
  detail?: string
  amount?: ReactNode
  className?: string
  onInspect?: () => void
}) => {
  const inspectResource = useResourceNavigation()
  const onClick = interactive ? onInspect ?? (inspectResource ? () => inspectResource(resourceId) : undefined) : undefined
  const [failedSource, setFailedSource] = useState<string>()
  const icon = resourceIcons[resourceId]
  const source = icon ? `/resource-icons/${resourceId}.png` : undefined
  const name = resources[resourceId].name
  const showImage = source && source !== failedSource
  const content = (
    <>
      {showImage && (
        // These small, local game assets already have a fixed display size.
        <span className={cn('inline-flex shrink-0', amount != null && 'px-1.5')}>
          <img src={source} alt="" width={28} height={28} className="size-7 shrink-0 object-contain"
            decoding="async" onError={() => setFailedSource(source)} />
        </span>
      )}
      {(named || !showImage) && <span>{name}</span>}
      {amount != null && <span className="font-mono text-sm font-normal tabular-nums whitespace-nowrap text-foreground">{amount}</span>}
    </>
  )

  if (!interactive || (!showImage && !detail && !onClick && amount == null)) {
    return <span className={cn('inline-flex min-w-0 items-center gap-1.5 align-middle', className)}>{content}</span>
  }

  return (
    <ResourceTooltip label={name} detail={detail} onClick={onClick}
      className={cn('p-1.5', amount != null && 'min-w-10 flex-col justify-center gap-0.5 px-0', className)}>{content}</ResourceTooltip>
  )
}
