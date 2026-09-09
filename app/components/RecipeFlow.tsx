import { type ResourceId } from '../db/resources'
import { ResourceToken } from './ResourceToken'

interface FlowAmount {
  resourceId: ResourceId
  quantity: number
  detail?: string
}

const roundedQuantity = (quantity: number) => parseFloat(quantity.toFixed(2))

/** Operators stay with their following resource when a long recipe wraps. */
export const RecipeFlow = ({ name, inputs, outputs, formatQuantity = roundedQuantity }: {
  name: string
  inputs: readonly FlowAmount[]
  outputs: readonly FlowAmount[]
  formatQuantity?: (quantity: number) => number | string
}) => (
  <div role="group" aria-label={name} className="flex flex-wrap items-start gap-x-1 gap-y-2">
    {(['inputs', 'outputs'] as const).map(side => (
      <span key={side} role="group" aria-label={side === 'inputs' ? 'Inputs' : 'Outputs'}
        className="inline-flex max-w-full flex-wrap items-start gap-x-1 gap-y-2 empty:hidden">
        {(side === 'inputs' ? inputs : outputs).map((flow, index) => {
          const amount = formatQuantity(flow.quantity)
          const startsOutputs = side === 'outputs' && inputs.length > 0
          const operator = index > 0 ? '+' : startsOutputs && '→'

          return (
            <span key={`${side}:${flow.resourceId}`} className="inline-flex items-start gap-1">
              {operator && <span aria-hidden="true" className="flex h-10 w-4 shrink-0 items-center justify-center text-lg text-muted-foreground">{operator}</span>}
              <ResourceToken resourceId={flow.resourceId} amount={amount}
                detail={flow.detail ?? `${side === 'inputs' ? 'Input' : 'Output'} · ${amount}`} />
            </span>
          )
        })}
      </span>
    ))}
  </div>
)
