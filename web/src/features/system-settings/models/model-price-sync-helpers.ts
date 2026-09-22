/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import type { OpenRouterReferenceModel } from '../types'

export type LocalModelPrice = {
  name: string
  mode: 'ratio' | 'fixed'
  ratio: number | null
  price: number | null
  completionRatio: number | null
  cacheRatio: number | null
  createCacheRatio: number | null
}

export type OpenRouterReferenceIndex = {
  byFullID: Map<string, OpenRouterReferenceModel>
  bySuffix: Map<string, OpenRouterReferenceModel>
  mapping: Map<string, string>
}

export function parseStringRecord(
  raw: string | undefined
): Record<string, string> {
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {}
    }
    const result: Record<string, string> = {}
    for (const [key, value] of Object.entries(
      parsed as Record<string, unknown>
    )) {
      if (typeof value === 'string' && value.trim()) result[key] = value
    }
    return result
  } catch {
    return {}
  }
}

export type ModelPriceSyncRow = LocalModelPrice & {
  reference: OpenRouterReferenceModel | null
  currentInputUSD: number | null
  currentOutputUSD: number | null
  inputDiscount: number | null
  outputDiscount: number | null
}

export function parseJSONNumberRecord(
  raw: string | undefined
): Record<string, number> {
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {}
    }
    const result: Record<string, number> = {}
    for (const [key, value] of Object.entries(
      parsed as Record<string, unknown>
    )) {
      const num = typeof value === 'number' ? value : Number(value)
      if (Number.isFinite(num)) result[key] = num
    }
    return result
  } catch {
    return {}
  }
}

/**
 * Indexes the OpenRouter catalog so a local model name can be matched either by
 * its full `vendor/model` id or by the bare model slug.
 */
export function buildOpenRouterReferenceIndex(
  models: OpenRouterReferenceModel[],
  mapping: Record<string, string> = {}
): OpenRouterReferenceIndex {
  const byFullID = new Map<string, OpenRouterReferenceModel>()
  const bySuffix = new Map<string, OpenRouterReferenceModel>()
  for (const model of models) {
    const id = model.id.trim().toLowerCase()
    if (!id) continue
    if (!byFullID.has(id)) byFullID.set(id, model)
    const slash = id.indexOf('/')
    const suffix = slash >= 0 ? id.slice(slash + 1) : id
    if (!suffix) continue
    if (!bySuffix.has(suffix)) bySuffix.set(suffix, model)
  }
  const mappingIndex = new Map<string, string>()
  for (const [local, target] of Object.entries(mapping)) {
    const name = local.trim().toLowerCase()
    const id = target.trim().toLowerCase()
    if (name && id) mappingIndex.set(name, id)
  }
  return { byFullID, bySuffix, mapping: mappingIndex }
}

export function matchOpenRouterModel(
  name: string,
  index: OpenRouterReferenceIndex
): OpenRouterReferenceModel | null {
  const normalized = name.trim().toLowerCase()
  if (!normalized) return null
  const mapped = index.mapping.get(normalized)
  if (mapped) {
    const mappedModel = index.byFullID.get(mapped)
    if (mappedModel) return mappedModel
  }
  const exact = index.byFullID.get(normalized)
  if (exact) return exact
  const slash = normalized.lastIndexOf('/')
  const suffix = slash >= 0 ? normalized.slice(slash + 1) : normalized
  return index.bySuffix.get(suffix) ?? null
}

export function ratioToUSDPer1M(
  ratio: number | null,
  quotaPerUnit: number
): number | null {
  if (ratio === null || quotaPerUnit <= 0) return null
  return (ratio * 1_000_000) / quotaPerUnit
}

export function usdPer1MToRatio(
  usdPer1M: number,
  quotaPerUnit: number
): number {
  if (quotaPerUnit <= 0) return 0
  return (usdPer1M * quotaPerUnit) / 1_000_000
}

/**
 * Relative discount of the local price against the reference price.
 * Positive means the local price is cheaper; negative means it is pricier.
 */
export function computeDiscount(
  currentUSD: number | null,
  referenceUSD: number | null
): number | null {
  if (currentUSD === null || referenceUSD === null || referenceUSD <= 0) {
    return null
  }
  return 1 - currentUSD / referenceUSD
}

export function buildLocalModelPrices(input: {
  modelRatio: Record<string, number>
  modelPrice: Record<string, number>
  completionRatio: Record<string, number>
  cacheRatio: Record<string, number>
  createCacheRatio: Record<string, number>
}): LocalModelPrice[] {
  const names = new Set<string>([
    ...Object.keys(input.modelRatio),
    ...Object.keys(input.modelPrice),
  ])
  return [...names]
    .sort((a, b) => a.localeCompare(b))
    .map((name) => {
      const price = input.modelPrice[name] ?? null
      const ratio = input.modelRatio[name] ?? null
      return {
        name,
        mode: price !== null ? 'fixed' : 'ratio',
        ratio,
        price,
        completionRatio: input.completionRatio[name] ?? null,
        cacheRatio: input.cacheRatio[name] ?? null,
        createCacheRatio: input.createCacheRatio[name] ?? null,
      }
    })
}

export function buildModelPriceSyncRows(
  locals: LocalModelPrice[],
  models: OpenRouterReferenceModel[],
  quotaPerUnit: number,
  mapping: Record<string, string> = {}
): ModelPriceSyncRow[] {
  const index = buildOpenRouterReferenceIndex(models, mapping)
  return locals.map((local) => {
    const reference = matchOpenRouterModel(local.name, index)
    let currentInputUSD: number | null = null
    let currentOutputUSD: number | null = null
    if (local.mode === 'ratio') {
      currentInputUSD = ratioToUSDPer1M(local.ratio, quotaPerUnit)
      const completion = local.completionRatio ?? 1
      currentOutputUSD =
        currentInputUSD === null ? null : currentInputUSD * completion
    }
    return {
      ...local,
      reference,
      currentInputUSD,
      currentOutputUSD,
      inputDiscount: computeDiscount(
        currentInputUSD,
        reference?.prompt_usd_per_1m ?? null
      ),
      outputDiscount: computeDiscount(
        currentOutputUSD,
        reference?.completion_usd_per_1m ?? null
      ),
    }
  })
}

export function roundRatio(value: number): number {
  return Math.round(value * 1e6) / 1e6
}
