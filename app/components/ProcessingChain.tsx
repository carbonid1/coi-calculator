import { Button, cn, Popover, Tooltip } from '@carbonid1/design-system'
import { ArrowDown, Link2, Unlink } from 'lucide-react'
import { createContext, type ReactNode, useContext, useState } from 'react'

import { type Module } from '../db/modules/modules'
import { type Recipe } from '../db/recipes'
import { type RegularResult } from '../helpers/calculate/calculate'
import {
  canAddProcessingLink, endpointKey, getProcessingEndpoint, resolveProcessingEndpoint, resolveProcessingLinks,
  type ProcessingEndpoint, type ProcessingLink,
} from '../helpers/processing-links/processing-links'
import { getRecipeDisplayName } from '../helpers/recipe-display/recipe-display'
import { useResources } from './ResourceProducts'

interface ChainContext {
  modules: readonly Module[]
  links: readonly ProcessingLink[]
  results: readonly RegularResult[]
  onChange?: (change: (links: ProcessingLink[]) => ProcessingLink[]) => void
  onNavigate: (moduleId: string, recipe: Recipe) => void
}

const Context = createContext<ChainContext | null>(null)

export const ProcessingLinksProvider = ({ children, ...value }: ChainContext & { children: ReactNode }) => (
  <Context.Provider value={value}>{children}</Context.Provider>
)

const format = (value: number) => parseFloat(value.toFixed(2)).toLocaleString('en-US')

export const ProcessingChainButton = ({ moduleId, recipe }: { moduleId?: string; recipe: Recipe }) => {
  const context = useContext(Context)
  const resources = useResources()
  const [open, setOpen] = useState(false)
  const [choosing, setChoosing] = useState<'input' | 'output' | null>(null)

  if (!context || !moduleId || recipe.group !== 'production') return null
  const { modules, links, results, onChange, onNavigate } = context
  const endpoint = getProcessingEndpoint(moduleId, recipe)
  const currentKey = endpointKey(endpoint)
  const moduleLinks = links.filter(link => link.source.moduleId === moduleId)
  const linked = moduleLinks.some(link => endpointKey(link.source) === currentKey || endpointKey(link.target) === currentKey)
  const activeIds = new Set(resolveProcessingLinks(moduleLinks, modules).map(link => link.id))
  const missing = moduleLinks.filter(link => !activeIds.has(link.id))
  const candidates: { link: ProcessingLink; recipe: Recipe; direction: 'input' | 'output' }[] = []
  const owner = modules.find(module => module.id === moduleId)

  for (const other of owner?.recipes ?? []) {
    if (other.group !== 'production' || other.id === recipe.id || !Object.hasOwn(owner?.builtBuildings ?? {}, other.id)) continue
    const otherEndpoint = getProcessingEndpoint(moduleId, other)

    for (const direction of ['input', 'output'] as const) {
      const source = direction === 'output' ? recipe : other
      const target = direction === 'output' ? other : recipe

      for (const output of source.outputs) {
        if (output.quantity <= 0 || !target.inputs.some(input => input.resourceId === output.resourceId && input.quantity > 0)) continue
        const link: ProcessingLink = {
          id: `candidate:${direction}:${other.id}:${output.resourceId}`,
          source: direction === 'output' ? endpoint : otherEndpoint,
          target: direction === 'output' ? otherEndpoint : endpoint,
          resourceId: output.resourceId,
        }

        if (canAddProcessingLink(links, link)) candidates.push({ link, recipe: other, direction })
      }
    }
  }
  if (!linked && !candidates.length && !missing.length) return null

  const traversal: { first: ProcessingEndpoint; previous?: ProcessingLink; next?: ProcessingLink } = { first: endpoint }
  const seen = new Set([currentKey])

  traversal.previous = moduleLinks.find(link => endpointKey(link.target) === endpointKey(traversal.first))

  while (traversal.previous && !seen.has(endpointKey(traversal.previous.source))) {
    traversal.first = traversal.previous.source
    seen.add(endpointKey(traversal.first))
    traversal.previous = moduleLinks.find(link => endpointKey(link.target) === endpointKey(traversal.first))
  }
  const nodes: ProcessingEndpoint[] = [traversal.first]
  const edges: ProcessingLink[] = []
  const forwardSeen = new Set([endpointKey(traversal.first)])

  traversal.next = moduleLinks.find(link => endpointKey(link.source) === endpointKey(traversal.first))

  while (traversal.next && !forwardSeen.has(endpointKey(traversal.next.target))) {
    edges.push(traversal.next)
    nodes.push(traversal.next.target)
    forwardSeen.add(endpointKey(traversal.next.target))
    const targetKey = endpointKey(traversal.next.target)

    traversal.next = moduleLinks.find(link => endpointKey(link.source) === targetKey)
  }
  const unlink = (id: string) => onChange?.(current => current.filter(link => link.id !== id))

  return (
    <Popover.Root open={open} onOpenChange={value => { setOpen(value); if (!value) setChoosing(null) }}>
      <Tooltip label={linked ? 'Processing chain · Planned' : 'Link processing'} disabled={open}>
        <Popover.Trigger render={
          <Button variant="ghost" size="smallIcon" selected={open}
            aria-label={`Processing chain · ${recipe.building} · ${getRecipeDisplayName(recipe)}`}
            data-processing-recipe={`${recipe.gameBuildingId ?? recipe.building}:${recipe.gameRecipeId ?? recipe.id}`}
            className={cn('shrink-0 p-1.5', linked ? 'text-highlight-foreground' : 'opacity-0 group-hover/recipe:opacity-100 group-focus-within/recipe:opacity-100 focus-visible:opacity-100 max-sm:opacity-100')}
          ><Link2 aria-hidden="true" className="size-4" /></Button>
        } />
      </Tooltip>
      <Popover.Portal>
        <Popover.Positioner side="bottom" align="end">
          <Popover.Popup className="w-80 space-y-2 p-2" aria-label="Processing chain">
            <div className="flex items-center justify-between px-2 text-xs">
              <Popover.Title className="font-medium text-foreground">Processing chain</Popover.Title>
              {linked && <span className="text-muted-foreground">Planned</span>}
            </div>
            <div className="space-y-1">
              {nodes.map((node, index) => {
                const nodeRecipe = resolveProcessingEndpoint(node, modules)
                const edge = edges[index]
                const targetRecipe = edge ? resolveProcessingEndpoint(edge.target, modules) : undefined
                const result = targetRecipe ? results.find(result => result.moduleId === moduleId && result.recipe.id === targetRecipe.id) : undefined
                const blocker = result?.processingBlockedBy
                const blocked = blocker && (blocker === 'capacity' ? 'Capacity' : resources[blocker].name)
                const remaining = Math.max(0, (result?.processingRequestedQuantity ?? 0) - (result?.processingQuantity ?? 0))

                return (
                  <div key={endpointKey(node)}>
                    <Button variant="ghost" size="small" fullWidth selected={endpointKey(node) === currentKey}
                      data-processing-node={`${node.buildingId}:${node.recipeId}`}
                      aria-current={endpointKey(node) === currentKey ? 'step' : undefined}
                      disabled={!nodeRecipe} className="h-auto justify-start px-2 py-1.5 text-left"
                      onClick={() => { if (nodeRecipe) { setOpen(false); onNavigate(node.moduleId, nodeRecipe) } }}>
                      <span className="min-w-0">
                        <span className="block truncate text-sm">{nodeRecipe?.building ?? node.buildingId}</span>
                        <span className="block truncate text-xs text-muted-foreground">{nodeRecipe ? getRecipeDisplayName(nodeRecipe) : 'Unavailable'}</span>
                      </span>
                    </Button>
                    {edge && <div className="flex items-center gap-2 pl-3 text-xs text-muted-foreground">
                      <ArrowDown aria-hidden="true" className="size-4 shrink-0" />
                      <span className="min-w-0 flex-1">
                        {resources[edge.resourceId].name}
                        {result?.processingQuantity != null && <span className="ml-2 font-mono tabular-nums text-foreground">{format(result.processingQuantity)}/mo</span>}
                        {remaining > 0.005 && <span> · {format(remaining)} left</span>}
                        {!activeIds.has(edge.id) && <span> · Unavailable</span>}
                        {blocked && <span className="block text-attention-foreground">Blocked · {blocked}</span>}
                      </span>
                      <Tooltip label="Remove link">
                        <Button variant="ghost" size="smallIcon" className="p-1.5" disabled={!onChange}
                          aria-label={`Remove ${resources[edge.resourceId].name} link`} onClick={() => unlink(edge.id)}>
                          <Unlink aria-hidden="true" className="size-4" />
                        </Button>
                      </Tooltip>
                    </div>}
                  </div>
                )
              })}
            </div>
            {onChange && <div className="flex gap-1">
              {(['input', 'output'] as const).filter(direction => candidates.some(candidate => candidate.direction === direction)).map(direction => (
                <Button key={direction} variant="ghost" size="small" selected={choosing === direction}
                  aria-expanded={choosing === direction} onClick={() => setChoosing(choosing === direction ? null : direction)}>
                  Link {direction}
                </Button>
              ))}
            </div>}
            {choosing && <div className="space-y-1">
              {candidates.filter(candidate => candidate.direction === choosing).map(candidate => (
                <Button key={candidate.link.id} variant="ghost" size="small" fullWidth className="h-auto justify-start px-2 py-1.5 text-left"
                  aria-label={`Link ${resources[candidate.link.resourceId].name} ${choosing === 'input' ? 'from' : 'to'} ${candidate.recipe.building}`}
                  onClick={() => {
                    const link = { ...candidate.link, id: crypto.randomUUID() }

                    onChange?.(current => canAddProcessingLink(current, link) ? [...current, link] : current)
                    setChoosing(null)
                  }}>
                  <span className="min-w-0">
                    <span className="block truncate text-sm">{candidate.recipe.building}</span>
                    <span className="block truncate text-xs text-muted-foreground">{resources[candidate.link.resourceId].name} · {getRecipeDisplayName(candidate.recipe)}</span>
                  </span>
                </Button>
              ))}
            </div>}
            {missing.filter(link => !edges.some(edge => edge.id === link.id)).map(link => (
              <div key={link.id} className="flex items-center justify-between px-2 text-xs text-muted-foreground">
                Unavailable · {resources[link.resourceId].name}
                <Tooltip label="Remove link"><Button variant="ghost" size="smallIcon" className="p-1.5"
                  aria-label={`Remove unavailable ${resources[link.resourceId].name} link`} disabled={!onChange} onClick={() => unlink(link.id)}>
                  <Unlink aria-hidden="true" className="size-4" />
                </Button></Tooltip>
              </div>
            ))}
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  )
}
