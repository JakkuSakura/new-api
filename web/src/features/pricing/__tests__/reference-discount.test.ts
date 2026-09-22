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
import assert from 'node:assert/strict'

import { describe, test } from 'vitest'

import { getReferenceDiscountPercent } from '../lib/price'

describe('reference discount badge', () => {
  test('rounds a positive discount to a whole percent', () => {
    assert.equal(getReferenceDiscountPercent(0.2), 20)
    assert.equal(getReferenceDiscountPercent(0.205), 21)
  })

  test('hides missing, negligible, or non-positive discounts', () => {
    assert.equal(getReferenceDiscountPercent(null), null)
    assert.equal(getReferenceDiscountPercent(undefined), null)
    assert.equal(getReferenceDiscountPercent(0), null)
    assert.equal(getReferenceDiscountPercent(-0.1), null)
    assert.equal(getReferenceDiscountPercent(0.004), null)
    assert.equal(getReferenceDiscountPercent(Number.NaN), null)
  })
})
