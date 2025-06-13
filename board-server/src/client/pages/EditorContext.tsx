import React, { createContext, useContext } from 'react'
import { getUserPreferences, type Editor } from 'tldraw'

export const EditorContext = createContext<Editor | null>(null)

export const useSharedEditor = () => useContext(EditorContext)
