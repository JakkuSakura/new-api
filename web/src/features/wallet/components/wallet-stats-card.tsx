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
import { Activity, BarChart3, Plus, WalletCards } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { IconBadge, type IconBadgeTone } from '@/components/ui/icon-badge'
import { Skeleton } from '@/components/ui/skeleton'
import { formatQuota } from '@/lib/format'

import type { UserWalletData } from '../types'

interface WalletStatsCardProps {
  user: UserWalletData | null
  loading?: boolean
  onAddFunds?: () => void
}

export function WalletStatsCard(props: WalletStatsCardProps) {
  const { t } = useTranslation()
  if (props.loading) {
    return (
      <div className='bg-card rounded-2xl border p-5 sm:p-7'>
        <Skeleton className='h-4 w-32' />
        <Skeleton className='mt-3 h-10 w-48' />
        <div className='mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3'>
          {['balance', 'usage', 'requests'].map((key) => (
            <div key={key} className='bg-muted/50 rounded-xl p-3'>
              <Skeleton className='h-3.5 w-20' />
              <Skeleton className='mt-2 h-6 w-24' />
            </div>
          ))}
        </div>
      </div>
    )
  }

  const stats: {
    label: string
    value: string
    description: string
    icon: typeof WalletCards
    tone: IconBadgeTone
  }[] = [
    {
      label: t('Current Balance'),
      value: formatQuota(props.user?.quota ?? 0),
      description: t('Remaining quota'),
      icon: WalletCards,
      tone: 'success',
    },
    {
      label: t('Total Usage'),
      value: formatQuota(props.user?.used_quota ?? 0),
      description: t('Total consumed quota'),
      icon: BarChart3,
      tone: 'info',
    },
    {
      label: t('API Requests'),
      value: (props.user?.request_count ?? 0).toLocaleString(),
      description: t('Total requests made'),
      icon: Activity,
      tone: 'chart-4',
    },
  ]

  return (
    <div
      data-wallet-dashboard='true'
      data-testid='wallet-dashboard'
      className='from-card via-card to-primary/5 relative overflow-hidden rounded-2xl border bg-gradient-to-br p-5 sm:p-7'
    >
      <div className='relative flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between'>
        <div>
          <div className='text-muted-foreground flex items-center gap-2 text-sm font-medium'>
            <IconBadge tone='success' size='xs'>
              <WalletCards />
            </IconBadge>
            {t('Available Balance')}
          </div>
          <div
            data-wallet-balance='true'
            data-testid='wallet-balance'
            className='mt-2 font-mono text-3xl font-bold tracking-tight tabular-nums sm:text-5xl'
          >
            {stats[0].value}
          </div>
          <p className='text-muted-foreground mt-1 text-sm'>
            {t('Ready to use across your account')}
          </p>
        </div>
        {props.onAddFunds && (
          <Button size='lg' onClick={props.onAddFunds}>
            <Plus data-icon='inline-start' />
            {t('Add Funds')}
          </Button>
        )}
      </div>
      <div className='relative mt-7 grid grid-cols-2 gap-3 sm:grid-cols-3'>
        {stats.slice(1).map((item) => (
          <div
            key={item.label}
            className='bg-background/70 min-w-0 rounded-xl border p-3 sm:p-4'
          >
            <div className='flex items-center gap-1.5 sm:gap-2.5'>
              <IconBadge tone={item.tone} size='stat'>
                <item.icon />
              </IconBadge>
              <div className='text-muted-foreground truncate text-[11px] font-medium tracking-wider uppercase sm:text-xs'>
                {item.label}
              </div>
            </div>

            <div className='text-foreground mt-1.5 font-mono text-sm font-bold tracking-tight break-all tabular-nums sm:mt-2.5 sm:text-2xl'>
              {item.value}
            </div>
            <div className='text-muted-foreground/60 mt-1 hidden text-xs md:block'>
              {item.description}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
