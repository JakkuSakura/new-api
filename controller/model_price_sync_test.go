package controller

import (
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestParseOpenRouterUSDPer1M(t *testing.T) {
	assert.Equal(t, 2.5, parseOpenRouterUSDPer1M("0.0000025"))
	assert.Equal(t, 0.0, parseOpenRouterUSDPer1M(""))
	assert.Equal(t, 0.0, parseOpenRouterUSDPer1M("abc"))
	assert.Equal(t, 0.0, parseOpenRouterUSDPer1M("-1"))
}

func TestBuildOpenRouterReferenceModels(t *testing.T) {
	raw := `{"data":[
		{"id":"openai/gpt-4o","name":"OpenAI: GPT-4o","context_length":128000,"pricing":{"prompt":"0.0000025","completion":"0.00001","input_cache_read":"0.00000125","input_cache_write":"0.000003125"}},
		{"id":"vendor/dynamic","pricing":{"prompt":"-1","completion":"-1"}},
		{"id":"vendor/zero","pricing":{"prompt":"0","completion":"0"}},
		{"id":"","pricing":{"prompt":"0.000001","completion":"0.000002"}}
	]}`
	var payload openRouterModelsPayload
	require.NoError(t, common.Unmarshal([]byte(raw), &payload))

	models := buildOpenRouterReferenceModels(payload, 500000)
	require.Len(t, models, 1)

	model := models[0]
	assert.Equal(t, "openai/gpt-4o", model.ID)
	assert.Equal(t, 2.5, model.PromptUSDPer1M)
	assert.Equal(t, 10.0, model.CompletionUSDPer1M)
	assert.Equal(t, 1.25, model.ModelRatio)
	assert.Equal(t, 4.0, model.CompletionRatio)
	assert.Equal(t, 0.5, model.CacheRatio)
	assert.Equal(t, 1.25, model.CreateCacheRatio)
	assert.Equal(t, 128000, model.ContextLength)
}

func TestApplyOpenRouterDiscounts(t *testing.T) {
	originalQuota := common.QuotaPerUnit
	common.QuotaPerUnit = 500000
	t.Cleanup(func() { common.QuotaPerUnit = originalQuota })

	openRouterReferenceCache.mu.Lock()
	openRouterReferenceCache.models = []dto.OpenRouterReferenceModel{
		{ID: "openai/gpt-4o", PromptUSDPer1M: 2.5, CompletionUSDPer1M: 10},
	}
	openRouterReferenceCache.fetchedAt = time.Now().Unix()
	openRouterReferenceCache.mu.Unlock()
	t.Cleanup(func() {
		openRouterReferenceCache.mu.Lock()
		openRouterReferenceCache.models = nil
		openRouterReferenceCache.mu.Unlock()
	})

	pricing := []model.Pricing{
		{ModelName: "gpt-4o", ModelRatio: 1, CompletionRatio: 4},
		{ModelName: "gpt-4o", QuotaType: 1, ModelPrice: 1},
	}
	applyOpenRouterDiscounts(pricing)

	require.NotNil(t, pricing[0].DiscountInput)
	assert.InDelta(t, 0.2, *pricing[0].DiscountInput, 1e-9)
	require.NotNil(t, pricing[0].DiscountOutput)
	assert.InDelta(t, 0.2, *pricing[0].DiscountOutput, 1e-9)
	assert.Nil(t, pricing[1].DiscountInput)
}
