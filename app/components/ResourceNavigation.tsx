'use client'

import { createContext, type ReactNode, useContext } from 'react'

import { type ResourceId } from '../db/resources'

const ResourceNavigation = createContext<((resourceId: ResourceId) => void) | undefined>(undefined)

export const ResourceNavigationProvider = ({ onInspectResource, children }: {
  onInspectResource: (resourceId: ResourceId) => void
  children: ReactNode
}) => <ResourceNavigation.Provider value={onInspectResource}>{children}</ResourceNavigation.Provider>

export const useResourceNavigation = () => useContext(ResourceNavigation)
