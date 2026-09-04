package setting

var (
	AirwallexEnabled       bool
	AirwallexClientID      string
	AirwallexAPIKey        string
	AirwallexWebhookSecret string
	AirwallexSandbox       bool
	AirwallexCurrency      string  = "USD"
	AirwallexUnitPrice     float64 = 1
	AirwallexMinTopUp      int     = 1
)
