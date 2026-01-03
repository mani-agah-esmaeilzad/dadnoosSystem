import fs from 'node:fs'
import path from 'node:path'

import { z } from 'zod'

const promptEntrySchema = z.object({
  id: z.string(),
  name: z.string(),
  content: z.string(),
})

const registrySchema = z.object({
  core: promptEntrySchema,
  modules: z.array(promptEntrySchema),
  router: promptEntrySchema,
})

export type PromptEntry = z.infer<typeof promptEntrySchema>
export type ModuleRegistryEntry = PromptEntry

interface PromptRegistry {
  core: PromptEntry
  modules: ModuleRegistryEntry[]
  router: PromptEntry
}

let cachedRegistry: PromptRegistry | null = null

function loadRegistry(): PromptRegistry {
  if (cachedRegistry) return cachedRegistry
  const registryPath = path.join(process.cwd(), 'prompts', 'registry.json')
  const raw = fs.readFileSync(registryPath, 'utf-8')
  const parsed = registrySchema.parse(JSON.parse(raw))
  cachedRegistry = parsed
  return parsed
}

export function getCorePromptEntry() {
  return loadRegistry().core
}

export function getRouterPromptEntry() {
  return loadRegistry().router
}

export function getModuleEntries(): ModuleRegistryEntry[] {
  return loadRegistry().modules
}

export function getModuleById(id: string): ModuleRegistryEntry | undefined {
  return getModuleEntries().find((entry) => entry.id === id)
}
