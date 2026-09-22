package controller

import (
	"fmt"
	"io"
	"net/http"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/billing_setting"

	"github.com/gin-gonic/gin"
)

const (
	openRouterModelsURL         = "https://openrouter.ai/api/v1/models"
	openRouterReferenceTimeout  = 15 * time.Second
	openRouterReferenceCacheTTL = time.Hour
	openRouterReferenceMaxBytes = 20 << 20 // 20MB
)

type openRouterReferenceCacheState struct {
	mu         sync.Mutex
	models     []dto.OpenRouterReferenceModel
	fetchedAt  int64
	refreshing bool
}

var openRouterReferenceCache openRouterReferenceCacheState

// openRouterModelsPayload is the subset of the public OpenRouter /models
// response needed to derive reference pricing.
type openRouterModelsPayload struct {
	Data []struct {
		ID            string `json:"id"`
		Name          string `json:"name"`
		ContextLength int    `json:"context_length"`
		Pricing       struct {
			Prompt          string `json:"prompt"`
			Completion      string `json:"completion"`
			InputCacheRead  string `json:"input_cache_read"`
			InputCacheWrite string `json:"input_cache_write"`
		} `json:"pricing"`
	} `json:"data"`
}

// GetOpenRouterReferencePrices returns OpenRouter's public per-token pricing
// converted to USD per 1M tokens and local ratio units. The response lets the
// admin UI compare configured model prices against a neutral reference.
func GetOpenRouterReferencePrices(c *gin.Context) {
	force := c.Query("refresh") == "1"
	models, fetchedAt, err := loadOpenRouterReferencePrices(force)
	if err != nil {
		logger.LogError(c.Request.Context(), "OpenRouter 参考价格获取失败 error="+err.Error())
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "获取 OpenRouter 参考价格失败"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "success", "data": gin.H{
		"models":         models,
		"fetched_at":     fetchedAt,
		"quota_per_unit": common.QuotaPerUnit,
		"source":         openRouterModelsURL,
	}})
}

func loadOpenRouterReferencePrices(force bool) ([]dto.OpenRouterReferenceModel, int64, error) {
	openRouterReferenceCache.mu.Lock()
	defer openRouterReferenceCache.mu.Unlock()

	now := time.Now().Unix()
	if !force && len(openRouterReferenceCache.models) > 0 && now-openRouterReferenceCache.fetchedAt < int64(openRouterReferenceCacheTTL.Seconds()) {
		return openRouterReferenceCache.models, openRouterReferenceCache.fetchedAt, nil
	}

	models, err := fetchOpenRouterReferencePrices()
	if err != nil {
		return nil, 0, err
	}
	openRouterReferenceCache.models = models
	openRouterReferenceCache.fetchedAt = now
	return models, now, nil
}

// getCachedOpenRouterReferenceModels returns a snapshot of the cached reference
// prices without triggering a network fetch. Safe on the public pricing path.
func getCachedOpenRouterReferenceModels() []dto.OpenRouterReferenceModel {
	openRouterReferenceCache.mu.Lock()
	defer openRouterReferenceCache.mu.Unlock()
	if len(openRouterReferenceCache.models) == 0 {
		return nil
	}
	out := make([]dto.OpenRouterReferenceModel, len(openRouterReferenceCache.models))
	copy(out, openRouterReferenceCache.models)
	return out
}

// ensureOpenRouterReferenceRefresh warms the reference cache in the background
// when it is empty or stale, so public pricing never blocks on OpenRouter.
func ensureOpenRouterReferenceRefresh() {
	openRouterReferenceCache.mu.Lock()
	if openRouterReferenceCache.refreshing {
		openRouterReferenceCache.mu.Unlock()
		return
	}
	if len(openRouterReferenceCache.models) > 0 &&
		time.Now().Unix()-openRouterReferenceCache.fetchedAt < int64(openRouterReferenceCacheTTL.Seconds()) {
		openRouterReferenceCache.mu.Unlock()
		return
	}
	openRouterReferenceCache.refreshing = true
	openRouterReferenceCache.mu.Unlock()

	go func() {
		defer func() {
			openRouterReferenceCache.mu.Lock()
			openRouterReferenceCache.refreshing = false
			openRouterReferenceCache.mu.Unlock()
		}()
		if _, _, err := loadOpenRouterReferencePrices(true); err != nil {
			logger.LogError(nil, "OpenRouter 参考价格后台刷新失败 error="+err.Error())
		}
	}()
}

type openRouterReferenceIndex struct {
	fullID map[string]dto.OpenRouterReferenceModel
	suffix map[string]dto.OpenRouterReferenceModel
}

func buildOpenRouterReferenceIndex(models []dto.OpenRouterReferenceModel) openRouterReferenceIndex {
	index := openRouterReferenceIndex{
		fullID: make(map[string]dto.OpenRouterReferenceModel, len(models)),
		suffix: make(map[string]dto.OpenRouterReferenceModel, len(models)),
	}
	for _, model := range models {
		id := strings.ToLower(strings.TrimSpace(model.ID))
		if id == "" {
			continue
		}
		if _, ok := index.fullID[id]; !ok {
			index.fullID[id] = model
		}
		suffix := id
		if i := strings.LastIndex(id, "/"); i >= 0 {
			suffix = id[i+1:]
		}
		if suffix == "" {
			continue
		}
		if _, ok := index.suffix[suffix]; !ok {
			index.suffix[suffix] = model
		}
	}
	return index
}

func (index openRouterReferenceIndex) match(name string) (dto.OpenRouterReferenceModel, bool) {
	normalized := strings.ToLower(strings.TrimSpace(name))
	if normalized == "" {
		return dto.OpenRouterReferenceModel{}, false
	}
	if model, ok := index.fullID[normalized]; ok {
		return model, true
	}
	suffix := normalized
	if i := strings.LastIndex(normalized, "/"); i >= 0 {
		suffix = normalized[i+1:]
	}
	model, ok := index.suffix[suffix]
	return model, ok
}

// applyOpenRouterDiscounts annotates token-ratio models with the relative
// saving against the OpenRouter reference price. Fixed-price and tiered
// expression models are not comparable and are skipped.
func applyOpenRouterDiscounts(pricing []model.Pricing) {
	models := getCachedOpenRouterReferenceModels()
	if len(models) == 0 || common.QuotaPerUnit <= 0 {
		return
	}
	index := buildOpenRouterReferenceIndex(models)
	for i := range pricing {
		item := &pricing[i]
		if item.QuotaType != 0 || item.BillingMode == billing_setting.BillingModeTieredExpr {
			continue
		}
		reference, ok := index.match(item.ModelName)
		if !ok || reference.PromptUSDPer1M <= 0 {
			continue
		}
		inputUSD := item.ModelRatio * 1_000_000 / common.QuotaPerUnit
		discountInput := 1 - inputUSD/reference.PromptUSDPer1M
		item.DiscountInput = &discountInput
		if reference.CompletionUSDPer1M > 0 {
			outputUSD := inputUSD * item.CompletionRatio
			discountOutput := 1 - outputUSD/reference.CompletionUSDPer1M
			item.DiscountOutput = &discountOutput
		}
	}
}

func fetchOpenRouterReferencePrices() ([]dto.OpenRouterReferenceModel, error) {
	req, err := http.NewRequest(http.MethodGet, openRouterModelsURL, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Accept", "application/json")
	resp, err := (&http.Client{Timeout: openRouterReferenceTimeout}).Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		return nil, fmt.Errorf("openrouter returned status %d", resp.StatusCode)
	}
	body, err := io.ReadAll(io.LimitReader(resp.Body, openRouterReferenceMaxBytes))
	if err != nil {
		return nil, err
	}
	var payload openRouterModelsPayload
	if err := common.Unmarshal(body, &payload); err != nil {
		return nil, err
	}

	models := buildOpenRouterReferenceModels(payload, common.QuotaPerUnit)
	return models, nil
}

// buildOpenRouterReferenceModels converts the raw OpenRouter catalog into USD
// per 1M tokens plus the equivalent local ratio units. quotaPerUnit is the
// number of quota units that equal 1 USD and must match live billing.
func buildOpenRouterReferenceModels(payload openRouterModelsPayload, quotaPerUnit float64) []dto.OpenRouterReferenceModel {
	models := make([]dto.OpenRouterReferenceModel, 0, len(payload.Data))
	for _, item := range payload.Data {
		item.ID = strings.TrimSpace(item.ID)
		if item.ID == "" {
			continue
		}
		prompt := parseOpenRouterUSDPer1M(item.Pricing.Prompt)
		if prompt <= 0 {
			continue
		}
		completion := parseOpenRouterUSDPer1M(item.Pricing.Completion)
		cacheRead := parseOpenRouterUSDPer1M(item.Pricing.InputCacheRead)
		cacheWrite := parseOpenRouterUSDPer1M(item.Pricing.InputCacheWrite)

		model := dto.OpenRouterReferenceModel{
			ID:                 item.ID,
			Name:               item.Name,
			PromptUSDPer1M:     prompt,
			CompletionUSDPer1M: completion,
			CacheReadUSDPer1M:  cacheRead,
			CacheWriteUSDPer1M: cacheWrite,
			CompletionRatio:    1,
			ContextLength:      item.ContextLength,
		}
		if quotaPerUnit > 0 {
			model.ModelRatio = roundRatioValue(prompt * quotaPerUnit / 1_000_000)
		}
		if item.Pricing.Completion != "" {
			model.CompletionRatio = roundRatioValue(completion / prompt)
		}
		if cacheRead > 0 {
			model.CacheRatio = roundRatioValue(cacheRead / prompt)
		}
		if cacheWrite > 0 {
			model.CreateCacheRatio = roundRatioValue(cacheWrite / prompt)
		}
		models = append(models, model)
	}

	sort.Slice(models, func(i, j int) bool { return models[i].ID < models[j].ID })
	return models
}

// parseOpenRouterUSDPer1M converts an OpenRouter per-token USD price string
// into USD per 1M tokens. Unparseable or negative values yield 0.
func parseOpenRouterUSDPer1M(raw string) float64 {
	value, err := strconv.ParseFloat(strings.TrimSpace(raw), 64)
	if err != nil || value <= 0 {
		return 0
	}
	return value * 1_000_000
}
