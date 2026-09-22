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
import { describe, expect, test } from 'vitest'

import type { OpenRouterReferenceModel } from '../../types'
import {
  buildLocalModelPrices,
  buildModelPriceSyncRows,
  computeDiscount,
  matchOpenRouterModel,
  buildOpenRouterReferenceIndex,
  ratioToUSDPer1M,
  usdPer1MToRatio,
} from '../model-price-sync-helpers'

function reference(
  id: string,
  prompt: number,
  completion: number
): OpenRouterReferenceModel {
  return {
    id,
    name: id,
    prompt_usd_per_1m: prompt,
    completion_usd_per_1m: completion,
    cache_read_usd_per_1m: 0,
    cache_write_usd_per_1m: 0,
    model_ratio: 0,
    completion_ratio: 0,
    cache_ratio: 0,
    create_cache_ratio: 0,
    context_length: 0,
  }
}

describe('model price sync helpers', () => {
  test('ratio and USD per 1M convert round-trip with the live quota unit', () => {
    expect(ratioToUSDPer1M(1.25, 500000)).toBe(2.5)
    expect(usdPer1MToRatio(2.5, 500000)).toBe(1.25)
  })

  test('matches a local model by full id or bare slug', () => {
    const index = buildOpenRouterReferenceIndex([
      reference('openai/gpt-4o', 2.5, 10),
      reference('anthropic/claude-3.5-sonnet', 3, 15),
    ])

    expect(matchOpenRouterModel('openai/gpt-4o', index)?.id).toBe(
      'openai/gpt-4o'
    )
    expect(matchOpenRouterModel('gpt-4o', index)?.id).toBe('openai/gpt-4o')
    expect(matchOpenRouterModel('claude-3.5-sonnet', index)?.id).toBe(
      'anthropic/claude-3.5-sonnet'
    )
    expect(matchOpenRouterModel('unknown-model', index)).toBeNull()
  })

  test('prefers a configured manual mapping over name matching', () => {
    const index = buildOpenRouterReferenceIndex(
      [reference('deepseek/deepseek-v4.1-flash', 0.15, 0.6)],
      { 'deepseek-flash': 'deepseek/deepseek-v4.1-flash' }
    )

    expect(matchOpenRouterModel('deepseek-flash', index)?.id).toBe(
      'deepseek/deepseek-v4.1-flash'
    )
  })

  test('computes a positive discount when the local price is cheaper', () => {
    expect(computeDiscount(2, 2.5)).toBeCloseTo(0.2)
    expect(computeDiscount(3, 2.5)).toBeCloseTo(-0.2)
    expect(computeDiscount(null, 2.5)).toBeNull()
    expect(computeDiscount(2, 0)).toBeNull()
  })

  test('builds rows with discounts against the matched reference', () => {
    const locals = buildLocalModelPrices({
      modelRatio: { 'gpt-4o': 1, 'gpt-4o-mini': 0.075 },
      modelPrice: { 'dall-e-3': 0.04 },
      completionRatio: { 'gpt-4o': 4 },
      cacheRatio: {},
      createCacheRatio: {},
    })
    const rows = buildModelPriceSyncRows(
      locals,
      [reference('openai/gpt-4o', 2.5, 10)],
      500000
    )

    const gpt4o = rows.find((row) => row.name === 'gpt-4o')
    expect(gpt4o?.currentInputUSD).toBe(2)
    expect(gpt4o?.currentOutputUSD).toBe(8)
    expect(gpt4o?.inputDiscount).toBeCloseTo(0.2)
    expect(gpt4o?.outputDiscount).toBeCloseTo(0.2)

    const fixed = rows.find((row) => row.name === 'dall-e-3')
    expect(fixed?.mode).toBe('fixed')
    expect(fixed?.currentInputUSD).toBeNull()
  })
})
