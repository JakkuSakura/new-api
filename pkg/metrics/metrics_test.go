package metrics

import (
	"io"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func scrape(t *testing.T) string {
	t.Helper()
	req := httptest.NewRequest("GET", "/metrics", nil)
	rec := httptest.NewRecorder()
	Handler().ServeHTTP(rec, req)
	if rec.Code != 200 {
		t.Fatalf("metrics handler returned %d", rec.Code)
	}
	body, err := io.ReadAll(rec.Result().Body)
	if err != nil {
		t.Fatalf("read body: %v", err)
	}
	return string(body)
}

func TestObserveUsageExposesSiteWideTotals(t *testing.T) {
	Init()
	ObserveUsage("test-model", 100, 50)
	ObserveUsage("test-model", 1, 2)
	ObserveFailure()

	out := scrape(t)
	for _, want := range []string{
		`newapi_tokens_total{kind="prompt"} 101`,
		`newapi_tokens_total{kind="completion"} 52`,
		`newapi_requests_total{status="success"} 2`,
		`newapi_requests_total{status="failure"} 1`,
		`newapi_model_tokens_total{kind="prompt",model="test-model"} 101`,
	} {
		if !strings.Contains(out, want) {
			t.Fatalf("missing %q in metrics output:\n%s", want, out)
		}
	}
}

func TestThroughputGaugePublished(t *testing.T) {
	Init()
	ObserveUsage("test-model", 600, 600)
	// throughputLoop publishes once per second
	deadline := time.Now().Add(3 * time.Second)
	for time.Now().Before(deadline) {
		if strings.Contains(scrape(t), `newapi_tokens_per_second{kind="total",window="1m"}`) {
			return
		}
		time.Sleep(200 * time.Millisecond)
	}
	t.Fatal("throughput gauge was never published")
}
