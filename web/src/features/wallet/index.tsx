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
import { Loader2, ShieldCheck } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { useState, useEffect, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { SectionPageLayout } from '@/components/layout'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useStatus } from '@/hooks/use-status'
import { getSelf } from '@/lib/api'

import { getAirwallexPaymentStatus, isApiSuccess } from './api'
import { AffiliateRewardsCard } from './components/affiliate-rewards-card'
import { BillingHistoryDialog } from './components/dialogs/billing-history-dialog'
import { CreemConfirmDialog } from './components/dialogs/creem-confirm-dialog'
import { PaymentConfirmDialog } from './components/dialogs/payment-confirm-dialog'
import { TransferDialog } from './components/dialogs/transfer-dialog'
import { RechargeFormCard } from './components/recharge-form-card'
import { SubscriptionPlansCard } from './components/subscription-plans-card'
import { WalletStatsCard } from './components/wallet-stats-card'
import { DEFAULT_DISCOUNT_RATE, PAYMENT_TYPES } from './constants'
import {
  useTopupInfo,
  usePayment,
  useAffiliate,
  useRedemption,
  useCreemPayment,
  useWaffoPayment,
  useWaffoPancakePayment,
} from './hooks'
import {
  getDefaultPaymentType,
  getMinTopupAmount,
  dispatchSelectedPayment,
} from './lib'
import type {
  UserWalletData,
  PaymentMethod,
  PresetAmount,
  CreemProduct,
  WaffoPayMethod,
} from './types'

interface WalletProps {
  initialShowHistory?: boolean
}

export function Wallet(props: WalletProps) {
  const { t } = useTranslation()
  const [user, setUser] = useState<UserWalletData | null>(null)
  const [userLoading, setUserLoading] = useState(true)
  const [topupAmount, setTopupAmount] = useState(0)
  const [selectedPreset, setSelectedPreset] = useState<number | null>(null)
  const [selectedPaymentMethod, setSelectedPaymentMethod] =
    useState<PaymentMethod>()
  const [selectedWaffoMethodIndex, setSelectedWaffoMethodIndex] = useState<
    number | null
  >(null)
  const [paymentLoading, setPaymentLoading] = useState<string | null>(null)
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false)
  const [transferDialogOpen, setTransferDialogOpen] = useState(false)
  const [billingDialogOpen, setBillingDialogOpen] = useState(false)
  const [redemptionCode, setRedemptionCode] = useState('')
  const [creemDialogOpen, setCreemDialogOpen] = useState(false)
  const [selectedCreemProduct, setSelectedCreemProduct] =
    useState<CreemProduct | null>(null)
  const [showSubscriptionPanel, setShowSubscriptionPanel] = useState(true)
  const [paymentStatus, setPaymentStatus] = useState<
    'pending' | 'succeeded' | 'failed'
  >('pending')

  const { status } = useStatus()
  const { topupInfo, presetAmounts, loading: topupLoading } = useTopupInfo()

  const {
    amount: paymentAmount,
    calculating,
    processing,
    calculatePaymentAmount,
    processPayment,
    qrCode: paymentQrCode,
    setQrCode: setPaymentQrCode,
    paymentTradeNo,
    setPaymentTradeNo,
  } = usePayment()
  const {
    affiliateLink,
    loading: affiliateLoading,
    transferQuota,
    transferring,
  } = useAffiliate()
  const { redeeming, redeemCode } = useRedemption()
  const { processing: creemProcessing, processCreemPayment } = useCreemPayment()
  const { processing: waffoProcessing, processWaffoPayment } = useWaffoPayment()
  const { processing: pancakeProcessing, processWaffoPancakePayment } =
    useWaffoPancakePayment()

  // Fetch and refresh user data
  const fetchUser = useCallback(async () => {
    try {
      setUserLoading(true)
      const response = await getSelf()
      if (response.success && response.data) {
        setUser(response.data as UserWalletData)
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to fetch user data:', error)
    } finally {
      setUserLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchUser()
  }, [fetchUser])

  useEffect(() => {
    if (props.initialShowHistory) {
      setBillingDialogOpen(true)
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [props.initialShowHistory])

  useEffect(() => {
    if (!paymentQrCode || !paymentTradeNo) return
    setPaymentStatus('pending')
    let stopped = false
    let timer: number | undefined
    const poll = async () => {
      try {
        const response = await getAirwallexPaymentStatus(paymentTradeNo)
        if (stopped) return
        if (!isApiSuccess(response) || !response.data) {
          timer = window.setTimeout(() => void poll(), 60_000)
          return
        }
        if (response.data.status === 'succeeded') {
          setPaymentStatus('succeeded')
          setPaymentQrCode(null)
          setPaymentTradeNo(null)
          await fetchUser()
          toast.success(t('Payment completed'))
        } else if (response.data.status === 'failed') {
          setPaymentStatus('failed')
          setPaymentQrCode(null)
          setPaymentTradeNo(null)
          toast.error(t('Payment failed'))
        } else if (response.data.poll_interval_seconds) {
          timer = window.setTimeout(
            () => void poll(),
            response.data.poll_interval_seconds * 1000
          )
        }
      } catch {
        if (!stopped) timer = window.setTimeout(() => void poll(), 60_000)
      }
    }
    void poll()
    return () => {
      stopped = true
      if (timer !== undefined) window.clearTimeout(timer)
    }
  }, [
    paymentQrCode,
    paymentTradeNo,
    fetchUser,
    setPaymentQrCode,
    setPaymentTradeNo,
    t,
  ])

  // Initialize topup amount when topup info is loaded
  const topupAmountInitializedRef = useRef(false)
  useEffect(() => {
    if (topupInfo && !topupAmountInitializedRef.current) {
      topupAmountInitializedRef.current = true
      const minTopup = getMinTopupAmount(topupInfo)
      setTopupAmount(minTopup)

      // Calculate initial payment amount with default payment type
      const defaultPaymentType = getDefaultPaymentType(topupInfo)
      calculatePaymentAmount(minTopup, defaultPaymentType)
    }
  }, [topupInfo, calculatePaymentAmount])

  // Get current payment type (selected or default)
  const getCurrentPaymentType = useCallback(() => {
    return selectedPaymentMethod?.type || getDefaultPaymentType(topupInfo)
  }, [selectedPaymentMethod, topupInfo])

  // Handle preset selection
  const handleSelectPreset = (preset: PresetAmount) => {
    setTopupAmount(preset.value)
    setSelectedPreset(preset.value)
    calculatePaymentAmount(preset.value, getCurrentPaymentType())
  }

  // Handle topup amount change
  const handleTopupAmountChange = (amount: number) => {
    setTopupAmount(amount)
    setSelectedPreset(null)
    calculatePaymentAmount(amount, getCurrentPaymentType())
  }

  // Handle payment method selection
  const handlePaymentMethodSelect = async (method: PaymentMethod) => {
    setSelectedPaymentMethod(method)
    setSelectedWaffoMethodIndex(null)
    setPaymentLoading(method.type)

    try {
      // Validate minimum topup
      const minTopup = getMinTopupAmount(topupInfo)
      if (topupAmount < minTopup) {
        return
      }

      // Calculate payment amount and show confirmation dialog
      await calculatePaymentAmount(topupAmount, method.type)
      setConfirmDialogOpen(true)
    } finally {
      setPaymentLoading(null)
    }
  }

  // Handle payment confirmation
  const handlePaymentConfirm = async () => {
    if (!selectedPaymentMethod) return

    const success = await dispatchSelectedPayment(
      selectedPaymentMethod,
      topupAmount,
      selectedWaffoMethodIndex,
      {
        regular: processPayment,
        waffo: processWaffoPayment,
        waffoPancake: processWaffoPancakePayment,
      }
    )

    if (success) {
      setConfirmDialogOpen(false)
      await fetchUser()
    }
  }

  // Handle redemption
  const handleRedeem = async () => {
    if (!redemptionCode) return

    const success = await redeemCode(redemptionCode)
    if (success) {
      setRedemptionCode('')
      await fetchUser()
    }
  }

  // Handle transfer
  const handleTransfer = async (amount: number) => {
    const success = await transferQuota(amount)
    if (success) {
      await fetchUser()
    }
    return success
  }

  // Handle Creem product selection
  const handleCreemProductSelect = (product: CreemProduct) => {
    setSelectedCreemProduct(product)
    setCreemDialogOpen(true)
  }

  // Handle Creem payment confirmation
  const handleCreemConfirm = async () => {
    if (!selectedCreemProduct) return

    const success = await processCreemPayment(selectedCreemProduct.productId)
    if (success) {
      setCreemDialogOpen(false)
      setSelectedCreemProduct(null)
      await fetchUser()
    }
  }

  const handleWaffoMethodSelect = async (
    method: WaffoPayMethod,
    index: number
  ) => {
    const loadingKey = `waffo-${index}`
    setSelectedPaymentMethod({
      name: method.name,
      type: PAYMENT_TYPES.WAFFO,
      icon: method.icon,
    })
    setSelectedWaffoMethodIndex(index)
    setPaymentLoading(loadingKey)

    try {
      await calculatePaymentAmount(topupAmount, PAYMENT_TYPES.WAFFO)
      setConfirmDialogOpen(true)
    } finally {
      setPaymentLoading(null)
    }
  }

  // Get discount rate for current topup amount
  const getDiscountRate = useCallback(() => {
    return topupInfo?.discount?.[topupAmount] || DEFAULT_DISCOUNT_RATE
  }, [topupInfo, topupAmount])

  const handleSubscriptionAvailabilityChange = useCallback(
    (available: boolean) => {
      setShowSubscriptionPanel(available)
    },
    []
  )

  let paymentStatusLabel = t('Payment failed')
  if (paymentStatus === 'pending') {
    paymentStatusLabel = t('Waiting for payment...')
  }
  if (paymentStatus === 'succeeded') {
    paymentStatusLabel = t('Payment completed')
  }

  return (
    <>
      <SectionPageLayout>
        <SectionPageLayout.Title>{t('Wallet')}</SectionPageLayout.Title>
        <SectionPageLayout.Content>
          <div className='mx-auto flex w-full max-w-7xl flex-col gap-4 sm:gap-5'>
            <WalletStatsCard
              user={user}
              loading={userLoading}
              onAddFunds={() =>
                document
                  .querySelector('#wallet-add-funds')
                  ?.scrollIntoView({ behavior: 'smooth' })
              }
            />

            <div id='wallet-add-funds' className='scroll-mt-4'>
              <RechargeFormCard
                topupInfo={topupInfo}
                presetAmounts={presetAmounts}
                selectedPreset={selectedPreset}
                onSelectPreset={handleSelectPreset}
                topupAmount={topupAmount}
                onTopupAmountChange={handleTopupAmountChange}
                paymentAmount={paymentAmount}
                calculating={calculating}
                onPaymentMethodSelect={handlePaymentMethodSelect}
                selectedPaymentMethod={selectedPaymentMethod}
                creditCurrency={topupInfo?.credit_currency}
                paymentLoading={paymentLoading}
                redemptionCode={redemptionCode}
                onRedemptionCodeChange={setRedemptionCode}
                onRedeem={handleRedeem}
                redeeming={redeeming}
                topupLink={topupInfo?.topup_link}
                loading={topupLoading}
                priceRatio={(status?.price as number) || 1}
                onOpenBilling={() => setBillingDialogOpen(true)}
                creemProducts={topupInfo?.creem_products}
                enableCreemTopup={topupInfo?.enable_creem_topup}
                onCreemProductSelect={handleCreemProductSelect}
                enableWaffoTopup={topupInfo?.enable_waffo_topup}
                waffoPayMethods={topupInfo?.waffo_pay_methods}
                waffoMinTopup={topupInfo?.waffo_min_topup}
                onWaffoMethodSelect={handleWaffoMethodSelect}
                enableWaffoPancakeTopup={topupInfo?.enable_waffo_pancake_topup}
                enableAirwallexTopup={topupInfo?.enable_airwallex_topup}
                showRedemption={false}
              />
            </div>

            <Tabs defaultValue='subscriptions' className='w-full'>
              <TabsList className='w-full justify-start overflow-x-auto sm:w-fit'>
                {showSubscriptionPanel && (
                  <TabsTrigger value='subscriptions'>
                    {t('Subscriptions')}
                  </TabsTrigger>
                )}
                <TabsTrigger value='affiliate'>
                  {t('Affiliate Rewards')}
                </TabsTrigger>
                <TabsTrigger value='account'>{t('Account Tools')}</TabsTrigger>
              </TabsList>
              {showSubscriptionPanel && (
                <TabsContent value='subscriptions' className='mt-4'>
                  <SubscriptionPlansCard
                    topupInfo={topupInfo}
                    onAvailabilityChange={handleSubscriptionAvailabilityChange}
                    userQuota={user?.quota}
                    onPurchaseSuccess={fetchUser}
                  />
                </TabsContent>
              )}
              <TabsContent value='affiliate' className='mt-4'>
                <AffiliateRewardsCard
                  user={user}
                  affiliateLink={affiliateLink}
                  onTransfer={() => setTransferDialogOpen(true)}
                  complianceConfirmed={
                    topupInfo?.payment_compliance_confirmed !== false
                  }
                  loading={affiliateLoading}
                />
              </TabsContent>
              <TabsContent value='account' className='mt-4'>
                <div className='grid gap-4 md:grid-cols-2'>
                  <div className='bg-card rounded-xl border p-5'>
                    <div className='flex items-center gap-2'>
                      <ShieldCheck className='text-primary size-5' />
                      <h3 className='font-semibold'>{t('Redeem a code')}</h3>
                    </div>
                    <p className='text-muted-foreground mt-1 text-sm'>
                      {t('Apply a redemption code to your account balance.')}
                    </p>
                    {topupInfo?.enable_redemption !== false ? (
                      <div className='mt-4 flex gap-2'>
                        <Label htmlFor='wallet-redemption' className='sr-only'>
                          {t('Redemption code')}
                        </Label>
                        <Input
                          id='wallet-redemption'
                          value={redemptionCode}
                          onChange={(e) => setRedemptionCode(e.target.value)}
                          placeholder={t('Enter your redemption code')}
                        />
                        <Button
                          variant='outline'
                          onClick={handleRedeem}
                          disabled={redeeming}
                        >
                          {redeeming ? t('Redeeming...') : t('Redeem')}
                        </Button>
                      </div>
                    ) : (
                      <p className='text-muted-foreground mt-4 text-sm'>
                        {t('Redemption codes are currently unavailable.')}
                      </p>
                    )}
                    {topupInfo?.topup_link && (
                      <a
                        className='mt-3 inline-block text-sm underline underline-offset-4'
                        href={topupInfo.topup_link}
                        target='_blank'
                        rel='noopener noreferrer'
                      >
                        {t('Get a redemption code')}
                      </a>
                    )}
                  </div>
                  <div className='bg-card flex flex-col justify-between rounded-xl border p-5'>
                    <div>
                      <h3 className='font-semibold'>{t('Billing history')}</h3>
                      <p className='text-muted-foreground mt-1 text-sm'>
                        {t(
                          'Review your previous payments and account transfers.'
                        )}
                      </p>
                    </div>
                    <Button
                      variant='outline'
                      className='mt-5 w-full sm:w-fit'
                      onClick={() => setBillingDialogOpen(true)}
                    >
                      {t('Open billing history')}
                    </Button>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </SectionPageLayout.Content>
      </SectionPageLayout>

      <PaymentConfirmDialog
        open={confirmDialogOpen}
        onOpenChange={setConfirmDialogOpen}
        onConfirm={handlePaymentConfirm}
        topupAmount={topupAmount}
        paymentAmount={paymentAmount}
        paymentMethod={selectedPaymentMethod}
        calculating={calculating}
        processing={processing || waffoProcessing || pancakeProcessing}
        discountRate={getDiscountRate()}
        creditCurrency={topupInfo?.credit_currency}
        paymentCurrency={
          selectedPaymentMethod?.currency || topupInfo?.credit_currency
        }
      />
      <Dialog
        open={Boolean(paymentQrCode)}
        onOpenChange={(open) => {
          if (!open) {
            setPaymentQrCode(null)
            setPaymentTradeNo(null)
          }
        }}
      >
        <DialogContent className='max-w-sm text-center'>
          <DialogHeader>
            <DialogTitle>{t('Scan to pay')}</DialogTitle>
            <DialogDescription>
              {t('Your payment status updates automatically.')}
            </DialogDescription>
          </DialogHeader>
          {paymentQrCode && (
            <div className='flex flex-col items-center gap-4 py-2'>
              <div className='rounded-2xl border bg-white p-4 shadow-sm'>
                <QRCodeSVG
                  value={paymentQrCode}
                  size={220}
                  aria-label={t('Payment QR code')}
                />
              </div>
              <div
                className='text-muted-foreground flex items-center gap-2 text-sm'
                role='status'
                aria-live='polite'
              >
                {paymentStatus === 'pending' && (
                  <Loader2 className='size-4 animate-spin' />
                )}
                {paymentStatusLabel}
              </div>
              <Button
                variant='outline'
                onClick={() => {
                  setPaymentQrCode(null)
                  setPaymentTradeNo(null)
                }}
              >
                {t('Close')}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <TransferDialog
        open={transferDialogOpen}
        onOpenChange={setTransferDialogOpen}
        onConfirm={handleTransfer}
        availableQuota={user?.aff_quota ?? 0}
        transferring={transferring}
      />

      <BillingHistoryDialog
        open={billingDialogOpen}
        onOpenChange={setBillingDialogOpen}
      />

      <CreemConfirmDialog
        open={creemDialogOpen}
        onOpenChange={setCreemDialogOpen}
        onConfirm={handleCreemConfirm}
        product={selectedCreemProduct}
        processing={creemProcessing}
      />
    </>
  )
}
