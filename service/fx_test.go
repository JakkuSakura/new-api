package service

import (
	"testing"

	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting"
	"github.com/shopspring/decimal"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestConvertMoneyIdentity(t *testing.T) {
	amount, rate, _, err := ConvertMoney(decimal.NewFromFloat(12.5), "usd", "USD")
	require.NoError(t, err)
	assert.True(t, amount.Equal(decimal.NewFromFloat(12.5)))
	assert.True(t, rate.Equal(decimal.NewFromInt(1)))
}

func TestConvertMoneyUsesDirectCreditRule(t *testing.T) {
	originalRules := setting.FXCreditRules
	t.Cleanup(func() { setting.FXCreditRules = originalRules })
	setting.FXCreditRules = `{"CNY":0.137}`

	amount, rate, _, err := ConvertMoney(decimal.NewFromInt(100), "CNY", "USD")
	require.NoError(t, err)
	assert.True(t, amount.Equal(decimal.NewFromFloat(13.7)))
	assert.True(t, rate.Equal(decimal.NewFromFloat(0.137)))
}

func TestConvertMoneyFallsBackToLatestSnapshot(t *testing.T) {
	originalRules := setting.FXCreditRules
	t.Cleanup(func() { setting.FXCreditRules = originalRules })
	setting.FXCreditRules = `{}`
	require.NoError(t, (&model.FXRateSnapshot{
		Provider:     "test",
		BaseCurrency: "USD",
		Rates:        `{"USD":1,"CNY":7.2,"EUR":0.9}`,
		FetchedAt:    123,
	}).Insert())

	amount, rate, fetchedAt, err := ConvertMoney(decimal.NewFromInt(100), "CNY", "EUR")
	require.NoError(t, err)
	assert.True(t, amount.Equal(decimal.NewFromFloat(12.5)))
	assert.True(t, rate.Equal(decimal.NewFromFloat(0.125)))
	assert.Equal(t, int64(123), fetchedAt)
}

func TestConvertMoneyRejectsUnsupportedCurrency(t *testing.T) {
	originalRules := setting.FXCreditRules
	t.Cleanup(func() { setting.FXCreditRules = originalRules })
	setting.FXCreditRules = `{}`
	require.NoError(t, (&model.FXRateSnapshot{BaseCurrency: "USD", Rates: `{"USD":1}`, FetchedAt: 1}).Insert())
	_, _, _, err := ConvertMoney(decimal.NewFromInt(1), "JPY", "USD")
	assert.Error(t, err)
}
