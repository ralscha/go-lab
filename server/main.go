package main

import (
	"context"
	"errors"
	"log"
	"net"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"strconv"
	"syscall"
	"time"
)

func env(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}

func main() {
	port := env("PORT", "3002")
	n, err := strconv.Atoi(port)
	if err != nil || n < 1 || n > 65535 {
		log.Fatal("PORT must be 1-65535")
	}
	root, err := filepath.Abs(env("STATIC_ROOT", "dist/go-lab/browser"))
	if err != nil {
		log.Fatal(err)
	}
	config, err := loadRunnerConfig()
	if err != nil {
		log.Fatal(err)
	}
	app := newApp(&dockerRunner{image: env("RUNNER_IMAGE", "go-lab-runner:1.27.4"), runtime: config.runtime}, root)
	app.config = config
	server := &http.Server{
		Addr: net.JoinHostPort(env("HOST", "127.0.0.1"), port), Handler: app,
		ReadHeaderTimeout: 5 * time.Second, ReadTimeout: 10 * time.Second,
		WriteTimeout: 50 * time.Second, IdleTimeout: 60 * time.Second, MaxHeaderBytes: 16 << 10,
	}
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	go func() {
		<-ctx.Done()
		shutdown, cancel := context.WithTimeout(context.Background(), 45*time.Second)
		defer cancel()
		if err := server.Shutdown(shutdown); err != nil {
			log.Print(err)
		}
	}()
	log.Printf("go-lab: http://%s (Go 1.27.4 runner)", server.Addr)
	if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
		log.Fatal(err)
	}
}
