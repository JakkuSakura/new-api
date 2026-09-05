/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.
*/
import { render, screen } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'

vi.mock('@/lib/format', () => ({
  formatQuota: (value: number) => `${value} credits`,
}))

const { WalletStatsCard } = await import('../wallet-stats-card')

describe('wallet balance dashboard', () => {
  test('prioritizes balance and exposes an add-funds action', () => {
    const onAddFunds = vi.fn()
    render(
      <WalletStatsCard
        user={{ quota: 1250, used_quota: 300, request_count: 12 } as never}
        onAddFunds={onAddFunds}
      />
    )

    expect(screen.getByTestId('wallet-dashboard')).toBeInTheDocument()
    expect(screen.getByTestId('wallet-balance')).toHaveTextContent(
      '1250 credits'
    )
    screen.getByRole('button', { name: 'Add Funds' }).click()
    expect(onAddFunds).toHaveBeenCalledOnce()
  })
})
