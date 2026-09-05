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
)

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
