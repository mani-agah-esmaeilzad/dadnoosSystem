import fs from 'node:fs'
import path from 'node:path'

let cachedPrompt: string | null = null

export function getSystemPrompt() {
  if (cachedPrompt) return cachedPrompt
  const promptPath = path.join(process.cwd(), 'prompts', 'system.md')
  cachedPrompt = fs.readFileSync(promptPath, 'utf-8')
  return cachedPrompt
}

export const SYSTEM_PROMPT = getSystemPrompt()
