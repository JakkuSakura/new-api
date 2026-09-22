package dto

// OpenRouterReferenceModel is one OpenRouter model with its public reference
// pricing converted into both USD per 1M tokens and the local ratio unit.
type OpenRouterReferenceModel struct {
	ID                 string  `json:"id"`
	Name               string  `json:"name"`
	PromptUSDPer1M     float64 `json:"prompt_usd_per_1m"`
	CompletionUSDPer1M float64 `json:"completion_usd_per_1m"`
	CacheReadUSDPer1M  float64 `json:"cache_read_usd_per_1m"`
	CacheWriteUSDPer1M float64 `json:"cache_write_usd_per_1m"`
	ModelRatio         float64 `json:"model_ratio"`
	CompletionRatio    float64 `json:"completion_ratio"`
	CacheRatio         float64 `json:"cache_ratio"`
	CreateCacheRatio   float64 `json:"create_cache_ratio"`
	ContextLength      int     `json:"context_length"`
}
