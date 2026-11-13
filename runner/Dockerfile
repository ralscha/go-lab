FROM golang:1.27.4-bookworm

# Precompile standard packages for offline, unprivileged jobs, including -race.
ENV GOTOOLCHAIN=local GOPROXY=off GOSUMDB=off GOMAXPROCS=2
RUN mkdir -p /opt/go-cache /work && \
    GOCACHE=/opt/go-cache go install std && \
    GOCACHE=/opt/go-cache go install -race std && \
    chmod -R a+rX /opt/go-cache
COPY run.sh /usr/local/bin/go-lab-run
RUN chmod 0555 /usr/local/bin/go-lab-run
ENV HOME=/work GOTMPDIR=/work GOCACHE=/work/cache GOPATH=/work/gopath GOENV=off
USER 10001:10001
WORKDIR /work
ENTRYPOINT ["/usr/bin/timeout", "--signal=KILL", "30s", "/usr/local/bin/go-lab-run"]
