package controller

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting"
	"github.com/gin-gonic/gin"
	"github.com/shopspring/decimal"
)

type airwallexClient struct {
	token     string
	expiresAt time.Time
	mu        sync.Mutex
}

var airwallex = &airwallexClient{}

func airwallexBaseURL() string {
	if setting.AirwallexSandbox {
		return "https://api-demo.airwallex.com"
	}
	return "https://api.airwallex.com"
}
func airwallexEnabled() bool {
	return setting.AirwallexEnabled && setting.AirwallexClientID != "" && setting.AirwallexAPIKey != ""
}

func (c *airwallexClient) accessToken() (string, error) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.token != "" && time.Until(c.expiresAt) > time.Minute {
		return c.token, nil
	}
	req, err := http.NewRequest(http.MethodPost, airwallexBaseURL()+"/api/v1/authentication/login", nil)
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("x-client-id", setting.AirwallexClientID)
	req.Header.Set("x-api-key", setting.AirwallexAPIKey)
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	var out struct {
		Token     string `json:"token"`
		ExpiresIn int    `json:"expires_in"`
	}
	if err := common.DecodeJson(resp.Body, &out); err != nil {
		return "", err
	}
	if resp.StatusCode >= 300 || out.Token == "" {
		return "", fmt.Errorf("airwallex authentication failed (%d)", resp.StatusCode)
	}
	c.token, c.expiresAt = out.Token, time.Now().Add(time.Duration(out.ExpiresIn)*time.Second)
	return c.token, nil
}

func airwallexRequest(path string, payload any) (map[string]any, error) {
	token, err := airwallex.accessToken()
	if err != nil {
		return nil, err
	}
	body, err := common.Marshal(payload)
	if err != nil {
		return nil, err
	}
	req, err := http.NewRequest(http.MethodPost, airwallexBaseURL()+path, bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	var out map[string]any
	if err := common.DecodeJson(resp.Body, &out); err != nil {
		return nil, err
	}
	if resp.StatusCode >= 300 {
		return nil, fmt.Errorf("airwallex request failed (%d): %v", resp.StatusCode, out)
	}
	return out, nil
}

type AirwallexPayRequest struct {
	Amount        int64  `json:"amount"`
	PaymentMethod string `json:"payment_method"`
}

func airwallexPayMoney(amount int64, group string) float64 {
	ratio := common.GetTopupGroupRatio(group)
	if ratio == 0 {
		ratio = 1
	}
	return decimal.NewFromInt(amount).Mul(decimal.NewFromFloat(setting.AirwallexUnitPrice)).Mul(decimal.NewFromFloat(ratio)).InexactFloat64()
}
func RequestAirwallexAmount(c *gin.Context) {
	var req AirwallexPayRequest
	if c.ShouldBindJSON(&req) != nil {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "参数错误"})
		return
	}
	if req.Amount < int64(setting.AirwallexMinTopUp) || req.Amount > 10000 {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "充值金额无效"})
		return
	}
	group, err := model.GetUserGroup(c.GetInt("id"), true)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "获取用户分组失败"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "success", "data": strconv.FormatFloat(airwallexPayMoney(req.Amount, group), 'f', 2, 64)})
}

func RequestAirwallexPay(c *gin.Context) {
	if !airwallexEnabled() {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "Airwallex 支付未配置"})
		return
	}
	var req AirwallexPayRequest
	if c.ShouldBindJSON(&req) != nil || (req.PaymentMethod != model.PaymentMethodAirwallex && req.PaymentMethod != model.PaymentMethodAirwallexWeChat) {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "参数错误"})
		return
	}
	if req.Amount < int64(setting.AirwallexMinTopUp) || req.Amount > 10000 {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "充值金额无效"})
		return
	}
	id := c.GetInt("id")
	group, err := model.GetUserGroup(id, true)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "获取用户分组失败"})
		return
	}
	money := airwallexPayMoney(req.Amount, group)
	tradeNo := fmt.Sprintf("AWX%d%d", id, time.Now().UnixNano())
	currency := strings.ToUpper(strings.TrimSpace(setting.AirwallexCurrency))
	if currency == "" {
		currency = "USD"
	}
	var result map[string]any
	if req.PaymentMethod == model.PaymentMethodAirwallex {
		result, err = airwallexRequest("/api/v1/pa/payment_links", map[string]any{"request_id": tradeNo, "merchant_order_id": tradeNo, "amount": money, "currency": currency, "success_redirect_url": paymentReturnPath("/wallet"), "failure_redirect_url": paymentReturnPath("/wallet")})
	} else {
		result, err = airwallexRequest("/api/v1/pa/payment_intents", map[string]any{"request_id": tradeNo, "merchant_order_id": tradeNo, "amount": money, "currency": currency, "payment_method": map[string]any{"type": "wechatpay", "flow": "qr_code"}})
	}
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "拉起支付失败"})
		return
	}
	if err := (&model.TopUp{UserId: id, Amount: req.Amount, Money: money, TradeNo: tradeNo, PaymentMethod: req.PaymentMethod, PaymentProvider: model.PaymentProviderAirwallex, CreateTime: time.Now().Unix(), Status: common.TopUpStatusPending}).Insert(); err != nil {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "创建订单失败"})
		return
	}
	data := gin.H{}
	if req.PaymentMethod == model.PaymentMethodAirwallex {
		payLink, _ := result["url"].(string)
		if payLink == "" {
			payLink, _ = result["payment_link_url"].(string)
		}
		if payLink == "" { c.JSON(http.StatusOK, gin.H{"message": "error", "data": "Airwallex 未返回支付链接"}); return }
		data["pay_link"] = payLink
	} else {
		data["qr_code"] = result["qr_code"]
		if data["qr_code"] == nil {
			if next, ok := result["next_action"].(map[string]any); ok {
				data["qr_code"] = next["qr_code"]
			}
		}
		if data["qr_code"] == nil { c.JSON(http.StatusOK, gin.H{"message": "error", "data": "Airwallex 未返回微信支付二维码"}); return }
	}
	c.JSON(http.StatusOK, gin.H{"message": "success", "data": data})
}

func AirwallexWebhook(c *gin.Context) {
	body, err := io.ReadAll(c.Request.Body)
	if err != nil {
		c.Status(http.StatusBadRequest)
		return
	}
	ts, sig := c.GetHeader("x-timestamp"), c.GetHeader("x-signature")
	stamp, parseErr := strconv.ParseInt(ts, 10, 64)
	if parseErr != nil || time.Since(time.Unix(stamp, 0)) > 5*time.Minute || time.Since(time.Unix(stamp, 0)) < -5*time.Minute {
		c.Status(http.StatusUnauthorized)
		return
	}
	mac := hmac.New(sha256.New, []byte(setting.AirwallexWebhookSecret))
	mac.Write([]byte(ts))
	mac.Write(body)
	expected := hex.EncodeToString(mac.Sum(nil))
	if setting.AirwallexWebhookSecret == "" || !hmac.Equal([]byte(strings.ToLower(sig)), []byte(expected)) {
		c.Status(http.StatusUnauthorized)
		return
	}
	var event struct {
		Type      string `json:"name"`
		EventType string `json:"type"`
		Data      struct {
			Object struct {
				MerchantOrderID string `json:"merchant_order_id"`
				Status          string `json:"status"`
			} `json:"object"`
		} `json:"data"`
	}
	if common.Unmarshal(body, &event) != nil {
		c.Status(http.StatusBadRequest)
		return
	}
	eventName := event.Type
	if eventName == "" {
		eventName = event.EventType
	}
	if eventName != "payment_intent.succeeded" && eventName != "payment_link.paid" && eventName != "payment_intent.succeeded.v2" {
		c.Status(http.StatusOK)
		return
	}
	if event.Data.Object.Status != "" && event.Data.Object.Status != "SUCCEEDED" && event.Data.Object.Status != "paid" {
		c.Status(http.StatusOK)
		return
	}
	if err := model.RechargeAirwallex(event.Data.Object.MerchantOrderID, c.ClientIP()); err != nil {
		c.Status(http.StatusInternalServerError)
		return
	}
	c.Status(http.StatusOK)
}
