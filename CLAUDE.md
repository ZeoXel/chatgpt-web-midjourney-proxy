# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is **ChatGPT Web Midjourney Proxy** - a comprehensive AI web application that integrates ChatGPT functionality with Midjourney image generation, Suno music generation, Luma video generation, and other AI services. The project is built as a monorepo with a Vue.js frontend and Node.js Express backend.

## Development Commands

### Frontend Development
```bash
# Install dependencies
pnpm install

# Development server (runs on port 1002)
pnpm dev

# Build frontend
pnpm build

# Type checking
pnpm type-check

# Linting
pnpm lint
pnpm lint:fix
```

### Backend Development
```bash
# Navigate to service directory
cd service

# Install dependencies
pnpm install

# Development server (runs on port 3002)
pnpm dev

# Build backend
pnpm build

# Production server
pnpm prod

# Direct development run
pnpm start
```

### Docker Development
```bash
# Build and run with docker-compose
docker-compose up

# Build Docker image manually
docker build -t chatgpt-web-midjourney-proxy .
```

## Architecture Overview

### Frontend (Vue.js + Vite)
- **Framework**: Vue 3 with TypeScript
- **UI Library**: Naive UI
- **Build Tool**: Vite
- **State Management**: Pinia
- **Routing**: Vue Router
- **Internationalization**: vue-i18n (supports multiple languages)
- **Key Features**: PWA support, real-time audio processing, multi-modal AI interfaces

### Backend (Node.js + Express)
- **Runtime**: Node.js with Express
- **Language**: TypeScript (compiled with tsup)
- **Authentication**: Custom middleware with rate limiting
- **File Handling**: Multer for uploads, AWS SDK for R2 storage
- **Proxy Architecture**: Multiple AI service proxies (OpenAI, Midjourney, Suno, Luma, etc.)

### Project Structure
```
├── src/                    # Frontend source
│   ├── api/               # API integration layer
│   ├── components/        # Vue components
│   ├── store/            # Pinia stores
│   ├── views/            # Page components
│   └── utils/            # Utilities
├── service/               # Backend source
│   └── src/              # Express server code
├── docker-compose/        # Docker configurations
└── public/               # Static assets
```

## Key Architectural Patterns

### API Proxy Architecture
The backend uses a sophisticated proxy system to integrate multiple AI services:
- **OpenAI Proxy** (`/openapi`): Handles ChatGPT, DALL-E, Whisper, TTS
- **Midjourney Proxy** (`/mjapi`): Image generation and manipulation
- **Suno Proxy** (`/sunoapi`): Music generation
- **Luma Proxy** (`/luma`): Video generation
- **Additional Services**: Viggle, Runway, Kling, Pika, Udio, etc.

### Frontend State Management
Uses Pinia with modular stores:
- **Auth Store**: User authentication and permissions
- **Settings Store**: Application configuration
- **Chat Store**: Conversation management
- **Specialized Stores**: Per-service state (Suno, Luma, etc.)

### Multi-Modal Integration
The application integrates various AI modalities:
- **Text**: ChatGPT conversation with custom models
- **Images**: Midjourney generation, DALL-E, Ideogram, Flux
- **Audio**: Suno music generation, Udio, Whisper transcription, TTS
- **Video**: Luma, Runway, Kling, Pika video generation
- **Real-time**: OpenAI Realtime API with voice processing

### Environment Configuration
Critical environment variables for development:
- `OPENAI_API_KEY`: OpenAI API access
- `OPENAI_API_BASE_URL`: Custom API endpoint
- `MJ_SERVER`: Midjourney proxy server
- `MJ_API_SECRET`: Midjourney authentication
- `SUNO_SERVER` & `SUNO_KEY`: Music generation
- `LUMA_SERVER` & `LUMA_KEY`: Video generation
- `AUTH_SECRET_KEY`: Application access control

### File Upload System
Multi-tier file upload architecture:
1. **Local Storage**: Default file uploads to `./uploads/`
2. **Cloudflare R2**: Cloud storage with pre-signed URLs
3. **External File Servers**: Configurable third-party integration
4. **Proxy Upload**: Route uploads through OpenAI endpoint

## Development Workflows

### Adding New AI Services
1. Create API integration in `src/api/[service].ts`
2. Add proxy handler in `service/src/myfun.ts`
3. Register proxy route in `service/src/index.ts`
4. Create frontend components in `src/views/[service]/`
5. Update environment variables and session config

### Frontend Development
- Use composition API with `<script setup lang="ts">`
- Leverage Naive UI components for consistency
- Follow reactive patterns with Pinia stores
- Implement responsive design with CSS-in-JS patterns

### Backend Development
- All routes use authentication middleware (`authV2`)
- Implement proper error handling and logging
- Use TypeScript for type safety
- Follow Express middleware patterns for extensibility

## Testing and Quality

### Code Quality
```bash
# Frontend linting
pnpm lint

# Backend linting  
cd service && pnpm lint

# Type checking
pnpm type-check
```

### Development Server Setup
1. Frontend dev server: `http://localhost:1002`
2. Backend dev server: `http://localhost:3002`  
3. Vite proxy configuration handles API routing during development

## Deployment Considerations

### Production Build
```bash
# Build both frontend and backend
pnpm build
cd service && pnpm build
```

### Docker Deployment
The Dockerfile uses multi-stage builds:
1. **Frontend Build**: Node.js with Vite build
2. **Backend Build**: TypeScript compilation  
3. **Production**: Serves static files + API on port 3002

### Environment Security
- Never commit API keys or secrets
- Use environment variables for all configuration
- Configure CORS and rate limiting appropriately
- Implement proper authentication for production deployments

## Important Implementation Notes

### Real-time Features
- WebSocket connections for live chat
- Audio streaming with custom wavtools
- Server-sent events for long-running AI operations

### Multi-language Support
- Complete i18n implementation with vue-i18n
- Supports: EN, CN, FR, KR, RU, TR, VN, TW
- Dynamic language switching without reload

### PWA Capabilities  
- Service worker registration
- Offline functionality
- App-like mobile experience
- File caching strategies