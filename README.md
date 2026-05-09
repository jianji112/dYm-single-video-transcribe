# dYm

**[English](README.md) | [中文](README_CN.md)**

> AI-Powered Video Analysis & Download Manager for Douyin (Electron + TypeScript)

[![Electron](https://img.shields.io/badge/Electron-39.x-47848F?logo=electron&logoColor=white)](https://www.electronjs.org/)
[![React](https://img.shields.io/badge/React-19.x-61DAFB?logo=react&logoColor=white)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/License-GPL%20v3-blue.svg)](LICENSE)

dYm is a desktop application that combines **watermark-free video downloading** with **AI-driven content analysis**. Built for content creators, social media managers, and researchers who need to efficiently collect, organize, and understand short-form video content at scale.

[Current Repository](https://github.com/jianji112/dYm-single-video-transcribe)

---

## Project Origin

This project is **modified from** [Everless321/dYm](https://github.com/Everless321/dYm).

Thanks to the original author for open-sourcing the project and providing the solid download and analysis foundation that this edition builds on.

Current maintained fork:
- [jianji112/dYm-single-video-transcribe](https://github.com/jianji112/dYm-single-video-transcribe)

---

## AI Video Analysis

The core intelligence of dYm — automatically understand what's in your videos without watching them one by one.

### How It Works

1. **Frame Extraction** — FFmpeg extracts key frames from videos at configurable intervals (e.g., 4 evenly-spaced frames from a 30s video)
2. **Vision API Analysis** — Extracted frames are sent to a multimodal Vision LLM (OpenAI-compatible API) for content understanding
3. **Structured Output** — The AI returns structured metadata that gets stored alongside each video in the local database

### What the AI Extracts

| Field | Description | Example |
|-------|-------------|---------|
| **Tags** | Content keywords for search & filtering | `["cooking", "recipe", "pasta"]` |
| **Category** | Content classification | `Food & Cooking` |
| **Summary** | Brief description of the video content | `Step-by-step pasta carbonara recipe with tips` |
| **Scene** | Visual scene description | `Kitchen, indoor, close-up shots` |
| **Content Level** | Content rating (1-5 scale) | `1` (safe for all audiences) |

### Analysis Configuration

- **Model Selection** — Works with any OpenAI-compatible Vision API (Grok, OpenAI GPT-4o, Claude, etc.)
- **Custom Prompts** — Define exactly what the AI should look for in your content
- **Frame Slicing** — Configure how many frames to extract per video (trade-off between accuracy and API cost)
- **Concurrency Control** — Run multiple analyses in parallel with configurable worker count
- **Rate Limiting** — Built-in RPM (requests per minute) limiter to stay within API quotas
- **Batch Processing** — Analyze all unprocessed videos in one click, with real-time progress tracking
- **Per-User Analysis** — Analyze videos from a specific creator, or across all creators at once

### Image Post Support

For image carousel posts (Douyin's photo mode), dYm sends the original images directly to the Vision API — no frame extraction needed. Up to 10 images per post are analyzed in a single API call.

---

## Features

- **User Management** – Add and manage Douyin creators, bulk refresh profiles
- **Batch Download** – Concurrent watermark-free downloads with configurable limits and task tracking
- **Smart Filtering** – Filter content by creator, AI-generated tags, category, and content level
- **Local Storage** — All data stored in a local SQLite database, fully under your control
- **Clipboard Detection** – Auto-detect Douyin links from clipboard, one-click add
- **System Tray** – Minimize to tray for background operation

## Added in This Fork

- **Single Video Download** – Add a single Douyin video directly from a short link, full link, `jingxuan` link, or mixed share text
- **Clipboard Routing for Video Links** – Detect video links from the clipboard and route them into the single-video workflow instead of treating them as creator links
- **Configurable Single-Video Author Handling** – Decide whether authors discovered through single-video downloads should be added to user management by default
- **Audio Transcription** – Extract audio from downloaded videos and send it to SiliconFlow for speech-to-text
- **Transcript Storage and Export** – Save transcription results both in the local database and as `transcript.txt`, with in-app viewing, copying, and export support

---

## Quick Start

1. Download the installer from [Releases](https://github.com/jianji112/dYm-single-video-transcribe/releases)
2. Open dYm and configure your Douyin Cookie in Settings
3. Paste a Douyin link or add a creator
4. Download videos and enable AI analysis as needed

## Configuration Tutorials

Chinese screenshot tutorials are available here:

- [Douyin Cookie Setup](README_CN.md#douyin-config-tutorial)
- [Audio Transcription Setup](README_CN.md#transcription-config-tutorial)

---

## Tech Stack

- **Framework**: Electron + React 19 + TypeScript
- **UI**: Tailwind CSS + Radix UI + shadcn/ui
- **Database**: better-sqlite3
- **Video Processing**: fluent-ffmpeg (frame extraction for AI analysis)
- **Download Engine**: [dy-downloader](https://github.com/Everless321/dyDownload)
- **AI Integration**: OpenAI-compatible Vision API (configurable endpoint)

---

## Installation & Development

### Run from Source

```bash
git clone https://github.com/jianji112/dYm-single-video-transcribe.git
cd dYm-single-video-transcribe
npm install
npm run dev
```

### Download Pre-built

Go to [Releases](https://github.com/jianji112/dYm-single-video-transcribe/releases) for installer packages.

---

## Build

```bash
# macOS
npm run build:mac

# Windows
npm run build:win

# Linux
npm run build:linux

# Compile only (no packaging)
npm run build:unpack
```

Build output is in the `dist/` directory.

---

## Configuration

### Cookie Setup (Required)

1. Go to Settings
2. Click "Get Cookie"
3. Log in to Douyin in the popup window
4. Cookie is saved automatically after login

### AI Analysis Setup (Optional)

1. Go to Settings → Analysis Settings
2. Configure your API Key and API URL (default: Grok API)
3. Customize the analysis prompt, model, concurrency, and rate limits

---

## Project Structure

```text
dYm/
├── src/
│   ├── main/                # Electron main process
│   │   ├── database/        # SQLite database operations
│   │   ├── services/        # Download, analysis, scheduling services
│   │   │   └── analyzer.ts  # AI video analysis engine
│   │   └── index.ts
│   ├── preload/             # Preload scripts
│   └── renderer/            # React renderer process
├── build/                   # Build resources
├── resources/               # App resources
└── electron-builder.yml     # Packaging config
```

---

## Commands

```bash
npm run dev           # Development mode
npm run typecheck     # Type checking
npm run lint          # Linting
npm run format        # Formatting
npm run test:e2e      # E2E tests
```

---

## FAQ

### Download fails?

Check:
1. Cookie is valid and not expired
2. Network connection is stable
3. Download directory has write permissions

### AI analysis fails?

Check:
1. API Key is configured correctly
2. API quota is sufficient
3. Video files are complete and readable

### macOS says "app is damaged"?

Run:

```bash
sudo xattr -cr /Applications/dYm.app/
```

---

## License

This project is licensed under [GPL v3](https://www.gnu.org/licenses/gpl-3.0.html).

## Disclaimer

This tool is for learning and research purposes only. Please comply with local laws and platform terms of service. All downloaded content copyrights belong to the original creators.
