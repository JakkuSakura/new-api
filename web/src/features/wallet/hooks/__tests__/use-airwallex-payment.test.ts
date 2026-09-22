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
import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, test, vi } from 'vitest'

import type { AirwallexPaymentResponse } from '../../types'

const toastError = vi.fn()
const toastSuccess = vi.fn()

vi.mock('sonner', () => ({
  toast: { error: toastError, success: toastSuccess },
}))

vi.mock('@/features/wallet/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/wallet/api')>()
  return {
    ...actual,
    requestAirwallexPayment: vi.fn(),
    requestPayment: vi.fn(),
    requestStripePayment: vi.fn(),
  }
})

const { requestAirwallexPayment } = await import('@/features/wallet/api')
const { usePayment, requestPaymentAmount } = await import('../use-payment')

describe('Airwallex payment dispatch', () => {
  beforeEach(() => {
    vi.mocked(requestAirwallexPayment).mockReset()
  })

  test('opens the payment link returned for the Airwallex hosted checkout', async () => {
    vi.mocked(requestAirwallexPayment).mockResolvedValue({
      message: 'success',
      data: { pay_link: 'https://pay.airwallex.com/hkdab0d955b5' },
    })
    const open = vi.spyOn(window, 'open').mockReturnValue(null)

    const { result } = renderHook(() => usePayment())
    let succeeded = false
    await act(async () => {
      succeeded = await result.current.processPayment(100, 'airwallex')
    })

    expect(succeeded).toBe(true)
    expect(open).toHaveBeenCalledWith(
      'https://pay.airwallex.com/hkdab0d955b5',
      '_blank'
    )
  })

  test('exposes the QR code and trade number for WeChat Pay', async () => {
    vi.mocked(requestAirwallexPayment).mockResolvedValue({
      message: 'success',
      data: { qr_code: 'weixin://wxpay/bizpayurl?pr=abc', trade_no: 'AWX1' },
    })

    const { result } = renderHook(() => usePayment())
    await act(async () => {
      await result.current.processPayment(100, 'airwallex_wechat')
    })

    expect(result.current.qrCode).toBe('weixin://wxpay/bizpayurl?pr=abc')
    expect(result.current.paymentTradeNo).toBe('AWX1')
  })

  test('exposes the QR code and trade number for Alipay', async () => {
    vi.mocked(requestAirwallexPayment).mockResolvedValue({
      message: 'success',
      data: {
        qr_code: 'https://qr.alipay.com/bavh4wjlxf12tper3a',
        trade_no: 'AWX2',
      },
    })

    const { result } = renderHook(() => usePayment())
    await act(async () => {
      await result.current.processPayment(100, 'airwallex_alipay')
    })

    expect(result.current.qrCode).toBe(
      'https://qr.alipay.com/bavh4wjlxf12tper3a'
    )
    expect(result.current.paymentTradeNo).toBe('AWX2')
  })

  test('routes Alipay QR amount calculation through the Airwallex calculator', async () => {
    const calls: string[] = []
    const amount = await requestPaymentAmount(120, 'airwallex_alipay', {
      regular: async () => {
        calls.push('regular')
        return { success: true, data: '1' }
      },
      stripe: async () => {
        calls.push('stripe')
        return { success: true, data: '2' }
      },
      waffo: async () => {
        calls.push('waffo')
        return { success: true, data: '3' }
      },
      waffoPancake: async () => {
        calls.push('pancake')
        return { success: true, data: '4' }
      },
      airwallex: async (request) => {
        calls.push(`airwallex:${request.amount}`)
        return { success: true, data: '5' }
      },
    })

    expect(amount).toBe(5)
    expect(calls).toEqual(['airwallex:120'])
  })

  test('surfaces the backend error message instead of the literal "error"', async () => {
    vi.mocked(requestAirwallexPayment).mockResolvedValue({
      message: 'error',
      data: "'title' is required.",
    } as unknown as AirwallexPaymentResponse)

    const { result } = renderHook(() => usePayment())
    await act(async () => {
      await result.current.processPayment(100, 'airwallex')
    })

    expect(toastError).toHaveBeenCalledWith("'title' is required.")
  })
})
