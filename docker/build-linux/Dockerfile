FROM golang:1.24

# Install node
RUN apt-get update && apt-get install -y curl
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
RUN apt-get install -y nodejs build-essential

# Install specific npm version to match development environment
RUN npm install -g npm@11.6.2

# Install Wails dependencies for Linux
RUN apt-get update && apt-get install -y \
    libgtk-3-dev \
    libwebkit2gtk-4.1-dev \
    nsis \
    fonts-noto \
    fonts-liberation \
    fontconfig \
    x11-xserver-utils \
    xvfb \
    && rm -rf /var/lib/apt/lists/*

# Install Wails
RUN go install github.com/wailsapp/wails/v2/cmd/wails@latest

WORKDIR /app
# Build command (assumes mounted volume for output if needed, but we'll cp out)
# We expect the source code to be mounted at /app via -v

# Run npm install (incremental) and then build
CMD ["sh", "-c", "cd desktop/wails/frontend && npm install && cd .. && xvfb-run -a sh -c '(wails build -tags webkit2_41 || wails build -tags webkit2 || wails build)' && cp build/bin/MLCRemote /out/"]
