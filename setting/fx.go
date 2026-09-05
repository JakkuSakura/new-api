package setting

// FX configuration is persisted through the option store. Rates are refreshed
// by the backend worker and are never used to rewrite existing orders.
var (
	FXProvider       = "exchangerate.host"
	FXAPIKey         = ""
	FXBaseCurrency   = "USD"
	FXCreditCurrency = "USD"
	FXCreditRules    = "{}"
)
