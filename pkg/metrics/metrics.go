package metrics

import (
	"net/http"
	"os"
	"sync"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

const (
	window1mSeconds = 60
	window5mSeconds = 300
)

var (
	registry = prometheus.NewRegistry()

	requestsTotal = prometheus.NewCounterVec(prometheus.CounterOpts{
		Name: "newapi_requests_total",
		Help: "Total number of settled relay requests, by status.",
	}, []string{"status"})

	tokensTotal = prometheus.NewCounterVec(prometheus.CounterOpts{
		Name: "newapi_tokens_total",
		Help: "Total tokens processed site-wide, by kind (prompt|completion).",
	}, []string{"kind"})

	modelTokensTotal = prometheus.NewCounterVec(prometheus.CounterOpts{
		Name: "newapi_model_tokens_total",
		Help: "Total tokens processed site-wide, by model and kind.",
	}, []string{"model", "kind"})

	tokensPerSecond = prometheus.NewGaugeVec(prometheus.GaugeOpts{
		Name: "newapi_tokens_per_second",
		Help: "Site-wide token throughput over a rolling window (kind: prompt|completion|total).",
	}, []string{"kind", "window"})

	initOnce sync.Once
	window   = newRollingWindow()
)

func init() {
	registry.MustRegister(requestsTotal, tokensTotal, modelTokensTotal, tokensPerSecond)
}

// Init starts the background task that publishes rolling throughput gauges.
func Init() {
	initOnce.Do(func() {
		go throughputLoop()
	})
}

type sampleCounts struct {
	prompt     int64
	completion int64
}

type rollingWindow struct {
	mu   sync.Mutex
	secs map[int64]*sampleCounts
}

func newRollingWindow() *rollingWindow {
	return &rollingWindow{secs: make(map[int64]*sampleCounts)}
}

func (w *rollingWindow) add(ts, prompt, completion int64) {
	w.mu.Lock()
	c := w.secs[ts]
	if c == nil {
		c = &sampleCounts{}
		w.secs[ts] = c
	}
	c.prompt += prompt
	c.completion += completion
	w.mu.Unlock()
}

func (w *rollingWindow) sumSince(fromTs int64) (prompt, completion int64) {
	w.mu.Lock()
	defer w.mu.Unlock()
	for ts, c := range w.secs {
		if ts >= fromTs {
			prompt += c.prompt
			completion += c.completion
		}
	}
	return prompt, completion
}

func (w *rollingWindow) pruneBefore(ts int64) {
	w.mu.Lock()
	for k := range w.secs {
		if k < ts {
			delete(w.secs, k)
		}
	}
	w.mu.Unlock()
}

func throughputLoop() {
	ticker := time.NewTicker(time.Second)
	defer ticker.Stop()
	for range ticker.C {
		now := time.Now().Unix()
		window.pruneBefore(now - window5mSeconds - 5)
		p1, c1 := window.sumSince(now - window1mSeconds)
		p5, c5 := window.sumSince(now - window5mSeconds)
		publish("prompt", p1, window1mSeconds, "1m")
		publish("completion", c1, window1mSeconds, "1m")
		publish("total", p1+c1, window1mSeconds, "1m")
		publish("prompt", p5, window5mSeconds, "5m")
		publish("completion", c5, window5mSeconds, "5m")
		publish("total", p5+c5, window5mSeconds, "5m")
	}
}

func publish(kind string, tokens, seconds int64, windowLabel string) {
	tokensPerSecond.WithLabelValues(kind, windowLabel).Set(float64(tokens) / float64(seconds))
}

// ObserveUsage records a settled request and its site-wide token usage.
func ObserveUsage(model string, promptTokens, completionTokens int64) {
	if promptTokens < 0 {
		promptTokens = 0
	}
	if completionTokens < 0 {
		completionTokens = 0
	}
	requestsTotal.WithLabelValues("success").Inc()
	tokensTotal.WithLabelValues("prompt").Add(float64(promptTokens))
	tokensTotal.WithLabelValues("completion").Add(float64(completionTokens))
	if model != "" {
		modelTokensTotal.WithLabelValues(model, "prompt").Add(float64(promptTokens))
		modelTokensTotal.WithLabelValues(model, "completion").Add(float64(completionTokens))
	}
	window.add(time.Now().Unix(), promptTokens, completionTokens)
}

// ObserveFailure records a failed relay request (no token usage).
func ObserveFailure() {
	requestsTotal.WithLabelValues("failure").Inc()
}

// Handler serves Prometheus metrics. If METRICS_TOKEN is set, access requires it.
func Handler() http.Handler {
	handler := promhttp.HandlerFor(registry, promhttp.HandlerOpts{})
	token := os.Getenv("METRICS_TOKEN")
	if token == "" {
		return handler
	}
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") == "Bearer "+token || r.URL.Query().Get("token") == token {
			handler.ServeHTTP(w, r)
			return
		}
		http.Error(w, "unauthorized", http.StatusUnauthorized)
	})
}
