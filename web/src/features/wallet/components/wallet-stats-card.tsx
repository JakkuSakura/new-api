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
import { Activity, BarChart3, Plus, Receipt, WalletCards } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { formatQuota } from '@/lib/format'

import type { UserWalletData } from '../types'

interface WalletStatsCardProps {
  user: UserWalletData | null
  loading?: boolean
  onAddFunds?: () => void
  onOpenHistory?: () => void
}

export function WalletStatsCard(props: WalletStatsCardProps) {
  const { t } = useTranslation()

  if (props.loading) {
    return (
      <div className='bg-card relative overflow-hidden rounded-3xl border p-6 sm:p-8'>
        <Skeleton className='h-3 w-28' />
        <Skeleton className='mt-4 h-12 w-56' />
        <Skeleton className='mt-6 h-10 w-44' />
        <div className='mt-8 grid grid-cols-2 gap-3 sm:max-w-md'>
          {['usage', 'requests'].map((key) => (
            <div key={key} className='bg-muted/40 rounded-2xl p-4'>
              <Skeleton className='h-3.5 w-16' />
              <Skeleton className='mt-2 h-6 w-20' />
            </div>
          ))}
        </div>
      </div>
    )
  }

  const stats: {
    label: string
    value: string
    icon: typeof BarChart3
  }[] = [
    {
      label: t('Total Usage'),
      value: formatQuota(props.user?.used_quota ?? 0),
      icon: BarChart3,
    },
    {
      label: t('API Requests'),
      value: (props.user?.request_count ?? 0).toLocaleString(),
      icon: Activity,
    },
  ]

  return (
    <div
      data-wallet-dashboard='true'
      data-testid='wallet-dashboard'
      className='from-primary/10 via-card to-card relative overflow-hidden rounded-3xl border bg-gradient-to-br p-6 sm:p-8'
    >
      <div
        aria-hidden='true'
        className='bg-primary/15 pointer-events-none absolute -top-24 -right-20 size-64 rounded-full blur-3xl'
      />
      <div
        aria-hidden='true'
        className='bg-chart-4/10 pointer-events-none absolute -bottom-28 -left-16 size-56 rounded-full blur-3xl'
      />

      <div className='relative flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between'>
        <div className='min-w-0'>
          <div className='text-muted-foreground flex items-center gap-2 text-xs font-medium tracking-[0.18em] uppercase'>
            <span className='bg-primary/15 text-primary inline-flex size-6 items-center justify-center rounded-full'>
              <WalletCards className='size-3.5' />
            </span>
            {t('Available Balance')}
          </div>
          <div
            data-wallet-balance='true'
            data-testid='wallet-balance'
            className='mt-3 font-mono text-4xl leading-none font-bold tracking-tight tabular-nums sm:text-6xl'
          >
            {formatQuota(props.user?.quota ?? 0)}
          </div>
          <p className='text-muted-foreground mt-3 text-sm'>
            {t('Ready to use across your account')}
          </p>
          <div className='mt-6 flex flex-wrap gap-2'>
            {props.onAddFunds && (
              <Button size='lg' onClick={props.onAddFunds}>
                <Plus data-icon='inline-start' />
                {t('Add Funds')}
              </Button>
            )}
            {props.onOpenHistory && (
              <Button size='lg' variant='outline' onClick={props.onOpenHistory}>
                <Receipt data-icon='inline-start' />
                {t('Billing history')}
              </Button>
            )}
          </div>
        </div>

        <div className='grid w-full grid-cols-2 gap-3 sm:max-w-sm lg:w-80'>
          {stats.map((item) => (
            <div
              key={item.label}
              className='bg-background/70 min-w-0 rounded-2xl border p-4 backdrop-blur'
            >
              <div className='text-muted-foreground flex items-center gap-2 text-[11px] font-medium tracking-wider uppercase'>
                <item.icon className='size-3.5' />
                <span className='truncate'>{item.label}</span>
              </div>
              <div className='mt-2 font-mono text-lg font-bold tracking-tight break-all tabular-nums sm:text-2xl'>
                {item.value}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
