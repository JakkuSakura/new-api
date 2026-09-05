package controller

import (
	"net/http"

	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting"
	"github.com/gin-gonic/gin"
)

func GetFXStatus(c *gin.Context) {
	snapshot, err := model.LatestFXRateSnapshot()
	data := gin.H{
		"provider":        setting.FXProvider,
		"base_currency":   setting.FXBaseCurrency,
		"credit_currency": setting.FXCreditCurrency,
		"last_fetched_at": int64(0),
		"available":       false,
	}
	if err == nil {
		data["last_fetched_at"] = snapshot.FetchedAt
		data["available"] = true
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": data})
}
