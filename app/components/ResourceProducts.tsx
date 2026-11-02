'use client'

import { createContext, type ReactNode, useContext, useMemo } from 'react'

import { resources, type ResourceId } from '../db/resources'
import { getResourceProducts, type ResourceProduct } from '../helpers/products/products'
import { type NativeProducts } from '../product-state'

interface ProductContext {
  resources: Record<ResourceId, ResourceProduct>
  products?: NativeProducts
  current: boolean
}

const ResourceProducts = createContext<ProductContext>({ resources, current: false })

export const ResourceProductsProvider = ({ products, current, children }: {
  products?: NativeProducts
  current: boolean
  children: ReactNode
}) => {
  const value = useMemo(() => ({ resources: getResourceProducts(products), products, current }), [products, current])

  return <ResourceProducts.Provider value={value}>{children}</ResourceProducts.Provider>
}

export const useResources = () => useContext(ResourceProducts).resources
export const useProductState = () => useContext(ResourceProducts)
