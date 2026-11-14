package main

import (
	"fmt"
	"os"
)

type runnerConfig struct {
	runtime       string
	requireGvisor bool
	enabled       bool
}

func loadRunnerConfig() (runnerConfig, error) {
	config := runnerConfig{runtime: os.Getenv("RUNNER_RUNTIME"), enabled: true}
	for name, setting := range map[string]*bool{
		"RUNNER_REQUIRE_GVISOR": &config.requireGvisor,
		"RUNNER_ENABLED":        &config.enabled,
	} {
		if value, present := os.LookupEnv(name); present {
			switch value {
			case "true":
				*setting = true
			case "false":
				*setting = false
			default:
				return config, fmt.Errorf("%s must be true or false", name)
			}
		}
	}
	if config.requireGvisor && config.runtime != "runsc" {
		return config, fmt.Errorf("RUNNER_REQUIRE_GVISOR=true requires RUNNER_RUNTIME=runsc; refusing to use Docker's default runtime")
	}
	if config.runtime != "" && config.runtime != "runsc" {
		return config, fmt.Errorf("RUNNER_RUNTIME must be empty or runsc")
	}
	return config, nil
}
