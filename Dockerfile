# Build environment for Knight's Launcher (Linux target)
# Matches Ubuntu 22.04 which has the webkit2gtk 4.1 packages Tauri 2 requires
FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive

# System dependencies required by Tauri on Linux
RUN apt-get update && apt-get install -y \
    curl \
    wget \
    file \
    patchelf \
    build-essential \
    pkg-config \
    libfuse2 \
    libssl-dev \
    libgtk-3-dev \
    desktop-file-utils \
    libwebkit2gtk-4.1-dev \
    libayatana-appindicator3-dev \
    librsvg2-dev \
    patchelf \
    && rm -rf /var/lib/apt/lists/*

# Node.js 20 LTS
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# Rust (stable)
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --no-modify-path
ENV PATH="/root/.cargo/bin:${PATH}"

WORKDIR /app

# Install npm dependencies first (better layer caching)
COPY package*.json ./
RUN npm ci

# Copy the rest of the project
COPY . .

CMD ["npm", "run", "tauri", "build"]
