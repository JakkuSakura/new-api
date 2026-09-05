package service

import (
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting"
	"github.com/shopspring/decimal"
)

// ConvertMoney applies an exact configured direct rule when available. If no
// rule exists, it converts through the configured FX base currency.
func ConvertMoney(amount decimal.Decimal, from, to string) (decimal.Decimal, decimal.Decimal, int64, error) {
	from = strings.ToUpper(strings.TrimSpace(from))
	to = strings.ToUpper(strings.TrimSpace(to))
	if from == "" || to == "" {
		return decimal.Zero, decimal.Zero, 0, fmt.Errorf("currency is required")
	}
	if from == to {
		return amount, decimal.NewFromInt(1), time.Now().Unix(), nil
	}
	var direct map[string]float64
	if err := common.UnmarshalJsonStr(setting.FXCreditRules, &direct); err == nil {
		if rate, ok := direct[from]; ok && rate > 0 {
			return amount.Mul(decimal.NewFromFloat(rate)), decimal.NewFromFloat(rate), time.Now().Unix(), nil
		}
	}
	snapshot, err := model.LatestFXRateSnapshot()
	if err != nil {
		return decimal.Zero, decimal.Zero, 0, err
	}
	var rates map[string]float64
	if err := common.UnmarshalJsonStr(snapshot.Rates, &rates); err != nil {
		return decimal.Zero, decimal.Zero, 0, err
	}
	fromRate, fromOK := rates[from]
	toRate, toOK := rates[to]
	if !fromOK || !toOK || fromRate <= 0 || toRate <= 0 {
		return decimal.Zero, decimal.Zero, 0, fmt.Errorf("unsupported currency conversion %s to %s", from, to)
	}
	rate := decimal.NewFromFloat(toRate).Div(decimal.NewFromFloat(fromRate))
	return amount.Mul(rate), rate, snapshot.FetchedAt, nil
}

func RefreshFXRates() error {
	base := strings.ToUpper(strings.TrimSpace(setting.FXBaseCurrency))
	if base == "" {
		return fmt.Errorf("FX base currency is empty")
	}
	query := url.Values{"base": []string{base}}
	if setting.FXAPIKey != "" {
		query.Set("access_key", setting.FXAPIKey)
	}
	req, err := http.NewRequest(http.MethodGet, "https://api.exchangerate.host/live?"+query.Encode(), nil)
	if err != nil {
		return err
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	var payload struct {
		Success bool               `json:"success"`
		Quotes  map[string]float64 `json:"quotes"`
		Rates   map[string]float64 `json:"rates"`
	}
	if err := common.DecodeJson(resp.Body, &payload); err != nil {
		return err
	}
	if resp.StatusCode >= 300 || (!payload.Success && len(payload.Quotes) == 0 && len(payload.Rates) == 0) {
		return fmt.Errorf("FX provider returned HTTP %d", resp.StatusCode)
	}
	rates := payload.Rates
	if len(rates) == 0 {
		rates = make(map[string]float64, len(payload.Quotes))
		for pair, rate := range payload.Quotes {
			if strings.HasPrefix(pair, base) {
				rates[strings.TrimPrefix(pair, base)] = rate
			}
		}
	}
	rates[base] = 1
	raw, err := common.Marshal(rates)
	if err != nil {
		return err
	}
	return (&model.FXRateSnapshot{Provider: setting.FXProvider, BaseCurrency: base, Rates: string(raw), FetchedAt: time.Now().Unix()}).Insert()
}

func StartFXRateRefresh() {
	go func() {
		if err := RefreshFXRates(); err != nil {
			logger.LogWarn(nil, "initial FX rate refresh failed: "+err.Error())
		}
		ticker := time.NewTicker(time.Hour)
		defer ticker.Stop()
		for range ticker.C {
			if err := RefreshFXRates(); err != nil {
				logger.LogWarn(nil, "hourly FX rate refresh failed: "+err.Error())
			}
		}
	}()
}
