import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it, vi } from 'vitest'

import { createCacheTestModel } from '../test-fixtures/factory-calculation-cache'
import { useFactoryCalculation } from './use-factory-calculation'

const calculate = vi.hoisted(() => vi.fn(() => { throw new Error('Synchronous solve') }))

vi.mock('../helpers/factory-calculation/factory-calculation', () => ({ calculateFactoryCalculation: calculate }))

it('renders a stable startup state without solving or opening browser storage during SSR', () => {
  const Probe = () => {
    const { settled, failed } = useFactoryCalculation(createCacheTestModel(), 'code-a')

    expect(failed).toBe(false)
    return createElement('p', null, settled ? 'ready' : 'loading')
  }

  expect(renderToStaticMarkup(createElement(Probe))).toBe('<p>loading</p>')
  expect(calculate).not.toHaveBeenCalled()
})
