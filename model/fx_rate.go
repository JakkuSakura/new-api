package model

import (
	"time"
)

type FXRateSnapshot struct {
	ID           uint   `gorm:"primaryKey"`
	Provider     string `gorm:"index;type:varchar(64)"`
	BaseCurrency string `gorm:"index;type:varchar(3)"`
	Rates        string `gorm:"type:text"`
	FetchedAt    int64  `gorm:"index"`
	CreatedAt    time.Time
}

func (snapshot *FXRateSnapshot) Insert() error { return DB.Create(snapshot).Error }

func LatestFXRateSnapshot() (*FXRateSnapshot, error) {
	var snapshot FXRateSnapshot
	if err := DB.Order("fetched_at DESC").First(&snapshot).Error; err != nil {
		return nil, err
	}
	return &snapshot, nil
}
