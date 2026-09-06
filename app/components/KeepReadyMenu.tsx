import { ContextMenu } from '@carbonid1/design-system'
import { type ReactElement, useState } from 'react'

import { type BuildingDiagnostic } from '../helpers/building-diagnostics/building-diagnostics'

export type KeepReadyChange = (diagnostic: BuildingDiagnostic, enabled: boolean) => void

interface Props {
  children: ReactElement | ((open: boolean) => ReactElement)
  diagnostic?: BuildingDiagnostic
  onChange?: KeepReadyChange
}

export const KeepReadyMenu = ({ children, diagnostic, onChange }: Props) => {
  const [open, setOpen] = useState(false)
  const trigger = typeof children === 'function' ? children(open) : children

  if (!diagnostic || !onChange || (!diagnostic.keepReady && diagnostic.attention !== 'can-pause'))
    return trigger

  return (
    <ContextMenu.Root open={open} onOpenChange={setOpen}>
      <ContextMenu.Trigger
        render={trigger}
        tabIndex={0}
        className="outline-none focus-visible:ring-2 focus-visible:ring-ring"
        onKeyDown={event => {
          if (event.key !== 'ContextMenu' && !(event.shiftKey && event.key === 'F10')) return

          event.preventDefault()
          const bounds = event.currentTarget.getBoundingClientRect()

          event.currentTarget.dispatchEvent(
            new MouseEvent('contextmenu', {
              bubbles: true,
              cancelable: true,
              clientX: bounds.left + 8,
              clientY: Math.min(bounds.bottom, window.innerHeight) - 8,
            }),
          )
        }}
      />
      <ContextMenu.Portal>
        <ContextMenu.Positioner>
          <ContextMenu.Popup>
            <ContextMenu.CheckboxItem
              checked={diagnostic.keepReady === true}
              closeOnClick
              onCheckedChange={enabled => onChange(diagnostic, enabled)}
            >
              Keep ready
            </ContextMenu.CheckboxItem>
          </ContextMenu.Popup>
        </ContextMenu.Positioner>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  )
}

export const KeepReadyNote = ({ enabled }: { enabled?: boolean }) =>
  enabled ? (
    <p className="my-1 text-xs text-muted-foreground">Keep ready · No pause suggestions</p>
  ) : null
