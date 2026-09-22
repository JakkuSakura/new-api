package controller

import (
	"testing"

	"github.com/QuantumNous/new-api/common"

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
