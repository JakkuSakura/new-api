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
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, RefreshCcw, Search, Tag } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { IconBadge } from '@/components/ui/icon-badge'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { TitledCard } from '@/components/ui/titled-card'
import { cn } from '@/lib/utils'

import { getOpenRouterReferencePrices, updateSystemOption } from '../api'
import {
  buildLocalModelPrices,
  buildModelPriceSyncRows,
  parseJSONNumberRecord,
  roundRatio,
  usdPer1MToRatio,
  type ModelPriceSyncRow,
} from './model-price-sync-helpers'

type ModelPriceSyncSectionProps = {
  modelDefaults: {
    ModelPrice: string
    ModelRatio: string
    CompletionRatio: string
    CacheRatio: string
    CreateCacheRatio: string
  }
}

const DEFAULT_QUOTA_PER_UNIT = 500000

function formatUSD(value: number | null): string {
  if (value === null) return '-'
  if (value === 0) return '0'
  if (Math.abs(value) < 1) return value.toFixed(4)
  return value.toFixed(2)
}

function formatDiscount(value: number | null) {
  if (value === null) return { label: '-', tone: 'muted' as const }
  const percent = value * 100
  if (Math.abs(percent) < 0.05) return { label: '0%', tone: 'muted' as const }
  if (percent > 0) {
    return { label: `-${percent.toFixed(1)}%`, tone: 'discount' as const }
  }
  return { label: `+${Math.abs(percent).toFixed(1)}%`, tone: 'markup' as const }
}

function DiscountCell({ value }: { value: number | null }) {
  const { label, tone } = formatDiscount(value)
  if (tone === 'muted') {
    return <span className='text-muted-foreground text-sm'>{label}</span>
  }
  return (
    <Badge
      variant='outline'
      className={cn(
        'font-medium tabular-nums',
        tone === 'discount'
          ? 'border-green-600/30 text-green-600'
          : 'border-red-600/30 text-red-600'
      )}
    >
      {label}
    </Badge>
  )
}

export function ModelPriceSyncSection({
  modelDefaults,
}: ModelPriceSyncSectionProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [markup, setMarkup] = useState(100)

  const modelPrice = modelDefaults.ModelPrice
  const modelRatio = modelDefaults.ModelRatio
  const completionRatio = modelDefaults.CompletionRatio
  const cacheRatio = modelDefaults.CacheRatio
  const createCacheRatio = modelDefaults.CreateCacheRatio

  const referenceQuery = useQuery({
    queryKey: ['openrouter-reference'],
    queryFn: () => getOpenRouterReferencePrices(false),
    staleTime: 10 * 60 * 1000,
  })

  const refreshMutation = useMutation({
    mutationFn: () => getOpenRouterReferencePrices(true),
    onSuccess: (data) => {
      if (!data.success) {
        toast.error(data.message || t('Failed to fetch reference prices'))
        return
      }
      queryClient.setQueryData(['openrouter-reference'], data)
      toast.success(t('Reference prices updated'))
    },
    onError: (error: Error) => {
      toast.error(error.message || t('Failed to fetch reference prices'))
    },
  })

  const quotaPerUnit =
    referenceQuery.data?.data.quota_per_unit || DEFAULT_QUOTA_PER_UNIT
  const referenceModels = useMemo(
    () => referenceQuery.data?.data.models ?? [],
    [referenceQuery.data?.data.models]
  )

  const rows = useMemo(
    () =>
      buildModelPriceSyncRows(
        buildLocalModelPrices({
          modelRatio: parseJSONNumberRecord(modelRatio),
          modelPrice: parseJSONNumberRecord(modelPrice),
          completionRatio: parseJSONNumberRecord(completionRatio),
          cacheRatio: parseJSONNumberRecord(cacheRatio),
          createCacheRatio: parseJSONNumberRecord(createCacheRatio),
        }),
        referenceModels,
        quotaPerUnit
      ),
    [
      modelPrice,
      modelRatio,
      completionRatio,
      cacheRatio,
      createCacheRatio,
      referenceModels,
      quotaPerUnit,
    ]
  )

  const filteredRows = useMemo(() => {
    const keyword = search.trim().toLowerCase()
    if (!keyword) return rows
    return rows.filter((row) => row.name.toLowerCase().includes(keyword))
  }, [rows, search])

  const matchedRows = useMemo(
    () => filteredRows.filter((row) => row.reference && row.mode === 'ratio'),
    [filteredRows]
  )
  const selectedRows = useMemo(
    () => rows.filter((row) => selected.has(row.name)),
    [rows, selected]
  )

  const applyMutation = useMutation({
    mutationFn: async (targets: ModelPriceSyncRow[]) => {
      const nextModelRatio = parseJSONNumberRecord(modelRatio)
      const nextCompletionRatio = parseJSONNumberRecord(completionRatio)
      const nextCacheRatio = parseJSONNumberRecord(cacheRatio)
      const nextCreateCacheRatio = parseJSONNumberRecord(createCacheRatio)
      const factor = markup / 100
      let applied = 0

      for (const row of targets) {
        const reference = row.reference
        if (!reference || row.mode !== 'ratio') continue
        if (reference.prompt_usd_per_1m <= 0) continue
        nextModelRatio[row.name] = roundRatio(
          usdPer1MToRatio(reference.prompt_usd_per_1m * factor, quotaPerUnit)
        )
        nextCompletionRatio[row.name] = roundRatio(
          reference.completion_usd_per_1m / reference.prompt_usd_per_1m
        )
        if (reference.cache_ratio > 0) {
          nextCacheRatio[row.name] = reference.cache_ratio
        }
        if (reference.create_cache_ratio > 0) {
          nextCreateCacheRatio[row.name] = reference.create_cache_ratio
        }
        applied += 1
      }

      if (applied === 0) return applied

      const updates: Array<{ key: string; value: string }> = []
      const pushIfChanged = (key: string, original: string, next: object) => {
        const nextValue = JSON.stringify(next)
        if (nextValue !== JSON.stringify(parseJSONNumberRecord(original))) {
          updates.push({ key, value: nextValue })
        }
      }
      pushIfChanged('ModelRatio', modelRatio, nextModelRatio)
      pushIfChanged('CompletionRatio', completionRatio, nextCompletionRatio)
      pushIfChanged('CacheRatio', cacheRatio, nextCacheRatio)
      pushIfChanged('CreateCacheRatio', createCacheRatio, nextCreateCacheRatio)

      for (const update of updates) {
        await updateSystemOption(update)
      }
      return applied
    },
    onSuccess: (applied) => {
      if (applied === 0) return
      toast.success(
        t('Applied reference prices to {{count}} models', { count: applied })
      )
      queryClient.invalidateQueries({ queryKey: ['system-options'] })
      setSelected(new Set())
    },
    onError: (error: Error) => {
      toast.error(error.message || t('Failed to apply prices'))
    },
  })

  const toggleRow = (name: string, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (checked) next.add(name)
      else next.delete(name)
      return next
    })
  }

  const selectMatched = () => {
    setSelected(new Set(matchedRows.map((row) => row.name)))
  }

  const allMatchedSelected =
    matchedRows.length > 0 && matchedRows.every((row) => selected.has(row.name))

  const loading = referenceQuery.isLoading
  const fetchedAt = referenceQuery.data?.data.fetched_at
  let referenceError = ''
  if (referenceQuery.data && !referenceQuery.data.success) {
    referenceError = referenceQuery.data.message
  } else if (referenceQuery.isError) {
    referenceError = (referenceQuery.error as Error).message
  }

  const modelRows = filteredRows.map((row) => {
    const selectable = Boolean(row.reference) && row.mode === 'ratio'
    return (
      <TableRow key={row.name}>
        <TableCell>
          <Checkbox
            checked={selected.has(row.name)}
            disabled={!selectable}
            onCheckedChange={(value) => toggleRow(row.name, Boolean(value))}
            aria-label={t('Select row')}
          />
        </TableCell>
        <TableCell className='font-medium'>
          <div className='flex flex-col'>
            <span>{row.name}</span>
            {row.reference ? (
              <span className='text-muted-foreground text-xs'>
                {row.reference.id}
              </span>
            ) : (
              <span className='text-muted-foreground text-xs'>
                {t('No reference price')}
              </span>
            )}
          </div>
        </TableCell>
        <TableCell>
          <Badge variant='outline'>
            {row.mode === 'fixed' ? t('Fixed price') : t('Token ratio')}
          </Badge>
        </TableCell>
        <TableCell className='text-right tabular-nums'>
          {formatUSD(row.currentInputUSD)}
        </TableCell>
        <TableCell className='text-right tabular-nums'>
          {formatUSD(row.reference?.prompt_usd_per_1m ?? null)}
        </TableCell>
        <TableCell className='text-right'>
          <DiscountCell value={row.inputDiscount} />
        </TableCell>
        <TableCell className='text-right tabular-nums'>
          {formatUSD(row.currentOutputUSD)}
        </TableCell>
        <TableCell className='text-right tabular-nums'>
          {formatUSD(row.reference?.completion_usd_per_1m ?? null)}
        </TableCell>
        <TableCell className='text-right'>
          <DiscountCell value={row.outputDiscount} />
        </TableCell>
      </TableRow>
    )
  })

  let tableContent: ReactNode
  if (loading) {
    tableContent = (
      <TableRow>
        <TableCell colSpan={9} className='h-24 text-center'>
          <Loader2 className='text-muted-foreground mx-auto h-5 w-5 animate-spin' />
        </TableCell>
      </TableRow>
    )
  } else if (filteredRows.length === 0) {
    tableContent = (
      <TableRow>
        <TableCell
          colSpan={9}
          className='text-muted-foreground h-24 text-center'
        >
          {t('No models found')}
        </TableCell>
      </TableRow>
    )
  } else {
    tableContent = modelRows
  }

  return (
    <TitledCard
      title={t('Model Price Sync')}
      description={t(
        'Batch update model prices using OpenRouter reference prices'
      )}
      icon={<Tag className='h-4 w-4' />}
      iconTone='info'
      disableHoverEffect
      action={
        <Button
          variant='outline'
          size='sm'
          onClick={() => refreshMutation.mutate()}
          disabled={refreshMutation.isPending}
          className='gap-2'
        >
          {refreshMutation.isPending ? (
            <Loader2 className='h-4 w-4 animate-spin' />
          ) : (
            <RefreshCcw className='h-4 w-4' />
          )}
          {t('Refresh reference')}
        </Button>
      }
      contentClassName='space-y-4'
    >
      <div className='flex flex-col gap-3'>
        <div className='flex flex-col gap-2 sm:flex-row sm:items-center'>
          <div className='relative flex-1'>
            <Search className='text-muted-foreground absolute top-1/2 left-2 h-4 w-4 -translate-y-1/2' />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t('Search model name...')}
              className='ps-8'
            />
          </div>
          <div className='flex items-center gap-2'>
            <label
              htmlFor='model-price-sync-markup'
              className='text-muted-foreground text-sm whitespace-nowrap'
            >
              {t('Markup vs reference (%)')}
            </label>
            <Input
              id='model-price-sync-markup'
              type='number'
              min={0}
              value={markup}
              onChange={(event) => {
                const value = Number(event.target.value)
                if (Number.isFinite(value) && value >= 0) setMarkup(value)
              }}
              className='w-24'
            />
          </div>
        </div>

        <div className='flex flex-wrap items-center gap-2'>
          <Button
            variant='outline'
            size='sm'
            onClick={selectMatched}
            disabled={matchedRows.length === 0}
          >
            {t('Select matched')}
          </Button>
          <Button
            variant='ghost'
            size='sm'
            onClick={() => setSelected(new Set())}
            disabled={selected.size === 0}
          >
            {t('Clear')}
          </Button>
          <div className='text-muted-foreground ml-auto text-xs'>
            {t('{{selected}} selected, {{matched}} matched', {
              selected: selectedRows.length,
              matched: rows.filter(
                (row) => row.reference && row.mode === 'ratio'
              ).length,
            })}
            {fetchedAt
              ? ` · ${t('Reference updated: {{time}}', {
                  time: new Date(fetchedAt * 1000).toLocaleString(),
                })}`
              : ''}
          </div>
          <Button
            size='sm'
            onClick={() => applyMutation.mutate(selectedRows)}
            disabled={selectedRows.length === 0 || applyMutation.isPending}
            className='gap-2'
          >
            {applyMutation.isPending && (
              <Loader2 className='h-4 w-4 animate-spin' />
            )}
            {t('Apply to selected')}
          </Button>
        </div>
      </div>

      {referenceError ? (
        <p className='text-destructive text-xs'>{referenceError}</p>
      ) : null}

      <div className='rounded-md border'>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className='w-10'>
                <Checkbox
                  checked={allMatchedSelected}
                  indeterminate={
                    !allMatchedSelected &&
                    matchedRows.some((row) => selected.has(row.name))
                  }
                  onCheckedChange={(value) => {
                    if (value) selectMatched()
                    else setSelected(new Set())
                  }}
                  aria-label={t('Select matched')}
                />
              </TableHead>
              <TableHead>{t('Model')}</TableHead>
              <TableHead>{t('Mode')}</TableHead>
              <TableHead className='text-right'>
                {t('Current ($/1M)')}
              </TableHead>
              <TableHead className='text-right'>
                {t('Reference ($/1M)')}
              </TableHead>
              <TableHead className='text-right'>{t('Discount')}</TableHead>
              <TableHead className='text-right'>
                {t('Output current ($/1M)')}
              </TableHead>
              <TableHead className='text-right'>
                {t('Output reference ($/1M)')}
              </TableHead>
              <TableHead className='text-right'>
                {t('Output discount')}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>{tableContent}</TableBody>
        </Table>
      </div>

      <div className='text-muted-foreground flex items-center gap-2 text-xs'>
        <IconBadge tone='info' size='xs'>
          <Tag />
        </IconBadge>
        {t(
          'Applying sets the model input and output token ratios from the OpenRouter reference, scaled by the markup. Fixed-price models are skipped.'
        )}
      </div>
    </TitledCard>
  )
}
