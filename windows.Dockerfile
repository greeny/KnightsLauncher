# Cross-compilation environment for building Windows .exe from Linux
# Uses cargo-xwin for MSVC cross-compilation and NSIS for installer bundling
FROM ubuntu:24.04

ENV DEBIAN_FRONTEND=noninteractive

# System dependencies for cross-compilation
RUN apt-get update && apt-get install -y \
	curl \
	wget \
	file \
	build-essential \
	pkg-config \
	libssl-dev \
	nsis \
	clang \
	llvm \
	lld \
	&& rm -rf /var/lib/apt/lists/*

# Node.js 20 LTS
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
	&& apt-get install -y nodejs \
	&& rm -rf /var/lib/apt/lists/*

# Rust (stable) with Windows MSVC target
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --no-modify-path
ENV PATH="/root/.cargo/bin:${PATH}"
RUN rustup target add x86_64-pc-windows-msvc

# cargo-xwin downloads the Windows SDK and CRT automatically on first build
RUN cargo install cargo-xwin

WORKDIR /app

# Install npm dependencies first (better layer caching)
COPY package*.json ./
RUN npm ci

# Copy the rest of the project
COPY . .

# Override bundle targets via env var (CLI --bundles flag only accepts host-OS formats)
ENV TAURI_CONFIG="{\"bundle\":{\"targets\":[\"nsis\"]}}"

# Build frontend, then cross-compile Rust backend and bundle NSIS installer
# --runner cargo-xwin: use cargo-xwin instead of cargo for MSVC cross-compilation
# --target: Windows 64-bit MSVC
CMD ["npm", "run", "tauri", "build", "--", "--runner", "cargo-xwin", "--target", "x86_64-pc-windows-msvc"]
