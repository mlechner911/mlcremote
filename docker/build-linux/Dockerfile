FROM golang:1.21

# Install node
RUN apt-get update && apt-get install -y curl
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
RUN apt-get install -y nodejs build-essential

# Install Wails dependencies for Linux
RUN apt-get update && apt-get install -y \
    libgtk-3-dev \
    libwebkit2gtk-4.0-dev \
    nsis \
    && rm -rf /var/lib/apt/lists/*

# Install Wails
RUN go install github.com/wailsapp/wails/v2/cmd/wails@latest

WORKDIR /app
COPY . .

# Build command (assumes mounted volume for output if needed, but we'll cp out)
# We expect the source code to be mounted at /app or copied in. 
# This dockerfile copies it in for the image build, but for dev we might want mounts.
# For now, following the plan: copy source, run build.

CMD ["sh", "-c", "cd desktop/wails && wails build && cp build/bin/MLCRemote /out/"]
