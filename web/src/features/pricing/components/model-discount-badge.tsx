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
import { ArrowDown } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/utils'

import { getReferenceDiscountPercent } from '../lib/price'
import type { PricingModel } from '../types'

interface ModelDiscountBadgeProps {
  model: PricingModel
  className?: string
}

/**
 * Shows how much cheaper the model is compared to the OpenRouter reference
 * price. Only renders when there is a meaningful discount.
 */
export function ModelDiscountBadge(props: ModelDiscountBadgeProps) {
  const { t } = useTranslation()
  const percent = getReferenceDiscountPercent(props.model.discount_input)
  if (percent == null) return null

  return (
    <span
      title={t('Cheaper than the OpenRouter reference price')}
      className={cn(
        'inline-flex items-center gap-0.5 rounded-md border border-green-600/30 bg-green-600/10 px-1.5 py-0.5 text-[11px] font-medium text-green-600 tabular-nums',
        props.className
      )}
    >
      <ArrowDown className='size-3' aria-hidden='true' />
      {percent}% {t('vs OpenRouter')}
    </span>
  )
}
