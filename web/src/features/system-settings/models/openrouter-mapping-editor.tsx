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
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Link2, Loader2, Plus, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Combobox } from '@/components/ui/combobox'

import { updateSystemOption } from '../api'
import type { OpenRouterReferenceModel } from '../types'
import { parseStringRecord } from './model-price-sync-helpers'

type MappingRow = { id: string; local: string; target: string }

function newRowId(): string {
  return Math.random().toString(36).slice(2)
}

interface OpenRouterMappingEditorProps {
  mapping: string
  localModels: string[]
  catalog: OpenRouterReferenceModel[]
}

export function OpenRouterMappingEditor(props: OpenRouterMappingEditorProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [rows, setRows] = useState<MappingRow[]>([])

  useEffect(() => {
    const parsed = parseStringRecord(props.mapping)
    setRows(
      Object.entries(parsed).map(([local, target]) => ({
        id: newRowId(),
        local,
        target,
      }))
    )
  }, [props.mapping])

  const localOptions = useMemo(
    () => props.localModels.map((name) => ({ value: name, label: name })),
    [props.localModels]
  )
  const catalogOptions = useMemo(
    () => props.catalog.map((model) => ({ value: model.id, label: model.id })),
    [props.catalog]
  )

  const saveMutation = useMutation({
    mutationFn: async (next: MappingRow[]) => {
      const mapping: Record<string, string> = {}
      for (const row of next) {
        const local = row.local.trim()
        const target = row.target.trim()
        if (local && target) mapping[local] = target
      }
      await updateSystemOption({
        key: 'OpenRouterModelMapping',
        value: JSON.stringify(mapping),
      })
    },
    onSuccess: () => {
      toast.success(t('Model mapping saved'))
      queryClient.invalidateQueries({ queryKey: ['system-options'] })
    },
    onError: (error: Error) => {
      toast.error(error.message || t('Failed to save model mapping'))
    },
  })

  const updateRow = (index: number, patch: Partial<MappingRow>) => {
    setRows((prev) =>
      prev.map((row, i) => (i === index ? { ...row, ...patch } : row))
    )
  }

  const addRow = () => {
    setRows((prev) => [...prev, { id: newRowId(), local: '', target: '' }])
  }

  const removeRow = (index: number) => {
    setRows((prev) => prev.filter((_, i) => i !== index))
  }

  return (
    <div className='space-y-3 rounded-md border p-4'>
      <div className='flex items-center gap-2'>
        <Link2 className='text-muted-foreground h-4 w-4' />
        <div>
          <p className='text-sm font-medium'>{t('Model mapping')}</p>
          <p className='text-muted-foreground text-xs'>
            {t(
              'Map local model names to OpenRouter model ids for reference pricing'
            )}
          </p>
        </div>
      </div>

      <div className='space-y-2'>
        {rows.map((row, index) => (
          <div
            key={row.id}
            className='grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_auto] items-center gap-2'
          >
            <Combobox
              options={localOptions}
              value={row.local}
              onValueChange={(value) =>
                updateRow(index, { local: value ?? '' })
              }
              placeholder={t('Local model')}
              searchPlaceholder={t('Search model name...')}
              allowCustomValue
            />
            <Combobox
              options={catalogOptions}
              value={row.target}
              onValueChange={(value) =>
                updateRow(index, { target: value ?? '' })
              }
              placeholder={t('OpenRouter model id')}
              searchPlaceholder={t('Search OpenRouter model...')}
              allowCustomValue
            />
            <Button
              type='button'
              variant='ghost'
              size='icon'
              onClick={() => removeRow(index)}
              aria-label={t('Remove mapping')}
            >
              <Trash2 className='h-4 w-4' />
            </Button>
          </div>
        ))}
      </div>

      <div className='flex items-center gap-2'>
        <Button type='button' variant='outline' size='sm' onClick={addRow}>
          <Plus className='mr-1 h-4 w-4' />
          {t('Add mapping')}
        </Button>
        <Button
          type='button'
          size='sm'
          onClick={() => saveMutation.mutate(rows)}
          disabled={saveMutation.isPending}
        >
          {saveMutation.isPending && (
            <Loader2 className='mr-1 h-4 w-4 animate-spin' />
          )}
          {t('Save mapping')}
        </Button>
      </div>
    </div>
  )
}
