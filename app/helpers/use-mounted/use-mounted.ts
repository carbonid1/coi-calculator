'use client'

import { useSyncExternalStore } from 'react'

const emptySubscribe = () => () => {}
const getSnapshot = () => true
const getServerSnapshot = () => false

export const useMounted = () => useSyncExternalStore(emptySubscribe, getSnapshot, getServerSnapshot)
