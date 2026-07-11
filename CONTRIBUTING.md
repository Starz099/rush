# Contributing to Rush

This document explains the local development setup, build steps, and codebase architecture for contributing to Rush.

## Workspace Architecture

Rush is structured as a pnpm monorepo:

- apps/editor: The React and TypeScript desktop client built with Vite, Tailwind CSS (v4), and shadcn/ui.
- apps/landing: The Next.js product landing page built with Framer Motion.
- packages/engine: Shared TypeScript helpers for timeline state management.
- src-tauri: The core Rust Tauri backend handling OS integrations, SQLite storage, and video processing sidecars.

---

## Local Development Setup

### Prerequisites

Ensure you have the following installed on your system:

- Node.js (LTS version)
- Rust (Stable toolchain)
- pnpm (Version 11)

#### Linux Dependencies (Ubuntu/Debian)

```bash
sudo apt-get update
sudo apt-get install -y libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf
```

---

## Running and Building

### Initialize Workspace

```bash
pnpm install
```

### Run Desktop Application

To launch the Tauri development window:

```bash
pnpm dev
```

### Run Landing Page

To run the Next.js landing page server:

```bash
pnpm --filter landing dev
```

### Code Formatting

Ensure code is formatted before submitting:

```bash
pnpm format
```

### Production Build

To compile native binaries for your current platform:

```bash
pnpm build
```
