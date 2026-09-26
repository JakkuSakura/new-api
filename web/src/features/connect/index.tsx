/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

For commercial licensing, please contact support@quantumnous.com
*/
import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { CopyButton } from '@/components/copy-button'
import { SectionPageLayout } from '@/components/layout'
import { ComboboxInput } from '@/components/ui/combobox-input'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { TitledCard } from '@/components/ui/titled-card'
import { getUserModels } from '@/lib/api'

function getServerAddress(): string {
  try {
    const raw = localStorage.getItem('status')
    if (raw) {
      const status = JSON.parse(raw)
      if (status.server_address) {
        return String(status.server_address).replace(/\/+$/, '')
      }
    }
  } catch {
    /* ignore malformed status */
  }
  return window.location.origin
}

function opencodeConfig(baseUrl: string, model: string, apiKey: string): string {
  return JSON.stringify(
    {
      $schema: 'https://opencode.ai/config.json',
      provider: {
        'new-api': {
          npm: '@ai-sdk/openai-compatible',
          name: 'New API',
          options: { baseURL: `${baseUrl}/v1`, apiKey },
          models: { [model]: { name: model } },
        },
      },
    },
    null,
    2
  )
}

function codexConfig(baseUrl: string, model: string, apiKey: string): string {
  return [
    `model = "${model}"`,
    'model_provider = "new-api"',
    '',
    '[model_providers.new-api]',
    'name = "New API"',
    `base_url = "${baseUrl}/v1"`,
    'env_key = "NEW_API_KEY"',
    'wire_api = "chat"',
    '',
    `# then: export NEW_API_KEY=${apiKey}`,
  ].join('\n')
}

function claudeConfig(baseUrl: string, model: string, apiKey: string): string {
  return JSON.stringify(
    {
      env: {
        ANTHROPIC_BASE_URL: baseUrl,
        ANTHROPIC_AUTH_TOKEN: apiKey,
        ANTHROPIC_MODEL: model,
      },
    },
    null,
    2
  )
}

function CodeBlock(props: { value: string }) {
  return (
    <div className='relative'>
      <div className='absolute right-2 top-2'>
        <CopyButton value={props.value} variant='outline' />
      </div>
      <pre className='bg-muted/50 overflow-x-auto rounded-lg p-3 pr-12 text-xs leading-relaxed'>
        <code>{props.value}</code>
      </pre>
    </div>
  )
}

export function Connect() {
  const { t } = useTranslation()
  const [apiKey, setApiKey] = useState('sk-...')
  const [model, setModel] = useState('')
  const baseUrl = useMemo(getServerAddress, [])

  const { data } = useQuery({
    queryKey: ['user-models-connect'],
    queryFn: getUserModels,
    staleTime: 5 * 60 * 1000,
  })

  const modelOptions = useMemo(
    () => (data?.data ?? []).map((m) => ({ value: m, label: m })),
    [data?.data]
  )
  const effectiveModel = model || modelOptions[0]?.value || 'gpt-4o-mini'

  return (
    <SectionPageLayout>
      <SectionPageLayout.Title>{t('Connect')}</SectionPageLayout.Title>
      <SectionPageLayout.Content>
        <div className='grid gap-4 sm:grid-cols-2'>
          <div className='space-y-2'>
            <Label>{t('Server Address')}</Label>
            <Input value={baseUrl} readOnly />
          </div>
          <div className='space-y-2'>
            <Label>{t('API Key')}</Label>
            <Input
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder='sk-...'
            />
          </div>
          <div className='space-y-2 sm:col-span-2'>
            <Label>{t('Model')}</Label>
            <ComboboxInput
              options={modelOptions}
              value={model}
              onValueChange={setModel}
              placeholder={effectiveModel}
              emptyText={t('No models found')}
              allowCustomValue={true}
            />
          </div>
        </div>

        <Tabs defaultValue='opencode' className='mt-6'>
          <TabsList>
            <TabsTrigger value='opencode'>OpenCode</TabsTrigger>
            <TabsTrigger value='codex'>Codex CLI</TabsTrigger>
            <TabsTrigger value='claude'>Claude Code</TabsTrigger>
          </TabsList>

          <TabsContent value='opencode'>
            <TitledCard
              title={t('OpenCode')}
              description='~/.config/opencode/opencode.jsonc'
            >
              <CodeBlock
                value={opencodeConfig(baseUrl, effectiveModel, apiKey)}
              />
            </TitledCard>
          </TabsContent>

          <TabsContent value='codex'>
            <TitledCard title={t('Codex CLI')} description='~/.codex/config.toml'>
              <CodeBlock value={codexConfig(baseUrl, effectiveModel, apiKey)} />
            </TitledCard>
          </TabsContent>

          <TabsContent value='claude'>
            <TitledCard title={t('Claude Code')} description='~/.claude/settings.json'>
              <CodeBlock value={claudeConfig(baseUrl, effectiveModel, apiKey)} />
            </TitledCard>
          </TabsContent>
        </Tabs>
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}
