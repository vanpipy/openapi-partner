# OpenAPI Partner - API Type Automation Platform

> Automated TypeScript type generation from OpenAPI/Swagger specifications

## Features

- 📦 **Centralized Spec URL Management** - Store and manage multiple OpenAPI specifications
- 🔍 **Spec Version Auto-Detection** - Automatically detects OpenAPI 3.x or Swagger 2.0
- 🔄 **Automated Type Generation** - Generate TypeScript types using swagger-typescript-api
- 📁 **Task-Based Output** - Each generation creates a versioned directory
- 📥 **Multiple Download Options** - ZIP archive, individual files, or public links
- ⚡ **Real-Time Updates** - Server-Sent Events (SSE) for task status monitoring
- 🔐 **Token-Based Authentication** - SHA-256 hashed API tokens with permissions

## Supported Spec Versions

| Spec | Support | Notes |
|------|---------|-------|
| OpenAPI 3.2.x | ✅ Native | Full support |
| OpenAPI 3.1.x | ✅ Native | Full support |
| OpenAPI 3.0.x | ✅ Native | Full support |
| Swagger 2.0 | ⚙️ Auto-converts | Via swagger2openapi |

## Tech Stack

| Component | Technology |
|-----------|------------|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript (strict) |
| Database | SQLite + Drizzle ORM |
| Auth | Bearer Tokens (SHA-256) |
| Runtime | Bun |
| Container | Docker |
| Testing | Bun test, Playwright |

## Quick Start

### Prerequisites

- Bun 1.x
- Node.js 18+ (for Next.js)
- Docker (optional)

### Installation

```bash
# Install dependencies
bun install

# Run database migrations
bunx drizzle-kit migrate

# Start development server
bun --bun run dev
```

### Docker Deployment

```bash
# Build and start
docker compose up -d

# View logs
docker compose logs -f
```

## Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── actions/           # Server actions
│   │   ├── project.ts    # Project CRUD
│   │   ├── token.ts      # Token management
│   │   └── tasks.ts      # Task operations
│   ├── api/              # API routes
│   │   ├── tasks/        # SSE events, download
│   │   ├── files/        # File downloads
│   │   ├── public/       # Public download links
│   │   └── auth/         # Authentication
│   └── projects/         # Pages
├── components/            # React components
│   ├── project/          # ProjectForm, ProjectList
│   ├── token/           # TokenManager
│   └── task/            # TaskProgress
├── lib/                  # Core modules
│   ├── auth.ts          # Token generation/validation
│   ├── db/              # Database schema & connection
│   ├── generator.ts     # Type generator
│   └── tasks.ts         # Task lifecycle
└── middleware.ts        # Auth middleware
```

## Usage

### 1. Create a Project

```typescript
import { createProject } from '@/app/actions/project';

const result = await createProject({
  name: 'Pet Store API',
  specUrl: 'https://petstore.swagger.io/v2/swagger.json',
  specType: 'auto-detect', // or 'openapi3x' or 'swagger2x'
  outputPath: './generated',
});
```

### 2. Generate API Token

```typescript
import { createProjectToken } from '@/app/actions/token';

const result = await createProjectToken({
  projectId: 1,
  name: 'Production Key',
  permissions: ['read', 'write'],
  expiresInDays: 90,
});

console.log(result.data.token); // Save this - shown only once!
```

### 3. Trigger Type Sync

```typescript
import { triggerProjectSync } from '@/app/actions/project';

const result = await triggerProjectSync(1);
console.log(result.taskId); // Use for SSE subscription
```

### 4. Subscribe to Task Updates (SSE)

```typescript
const eventSource = new EventSource(`/api/tasks/${taskId}/events`);

eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  
  if (data.type === 'status') {
    console.log('Status:', data.status);
  } else if (data.type === 'progress') {
    console.log('Progress:', data.message);
  } else if (data.type === 'completed') {
    console.log('Done! Output:', data.outputPath);
    eventSource.close();
  }
};
```

### 5. Download Generated Files

```bash
# Download as ZIP (token required)
curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://your-domain.com/api/tasks/{taskId}/download \
  -o task.zip

# Download single file (token required)
curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://your-domain.com/api/files/{taskId}/api.ts

# Public download (no auth required)
curl https://your-domain.com/api/public/{publicToken} -o types.zip
```

## Generated Files Structure

```
./generated/
└── tasks/
    └── {task-id}/
        ├── manifest.json          # Metadata
        ├── api.ts               # Main API client
        ├── data-contracts.ts    # Type definitions
        ├── http-client.ts       # HTTP layer
        └── route-types.ts       # Route types
```

## API Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/tasks/[id]/events` | None | SSE task stream (public) |
| GET | `/api/tasks/[id]/download` | Token | Download as ZIP |
| GET | `/api/files/[taskId]/[file]` | Token | Download single file |
| GET | `/api/public/[token]` | None | Public download (no auth) |

## Database Schema

### Projects Table

| Field | Type | Description |
|-------|------|-------------|
| id | INTEGER | Primary key |
| name | TEXT | Project name |
| specUrl | TEXT | OpenAPI specification URL |
| specType | TEXT | auto-detect, openapi3x, swagger2x |
| specVersion | TEXT | Auto-detected version (e.g., "3.1.0") |
| wasConverted | BOOLEAN | True if converted from Swagger 2.0 |
| outputPath | TEXT | Generated types output path |
| apiVersion | TEXT | API version (optional) |
| baseUrl | TEXT | Base URL override (optional) |
| isActive | BOOLEAN | Active status |
| createdAt | TIMESTAMP | Created time |
| updatedAt | TIMESTAMP | Updated time |

### Tasks Table

| Field | Type | Description |
|-------|------|-------------|
| id | TEXT | UUID primary key |
| projectId | INTEGER | Foreign key to projects |
| status | TEXT | PENDING/PROCESSING/SUCCESS/FAILED |
| errorMessage | TEXT | Error details (if failed) |
| executionLog | TEXT | Execution logs |
| outputDir | TEXT | Path to generated files |
| outputFiles | TEXT | JSON array of file names |
| outputSize | INTEGER | Total size in bytes |
| downloadCount | INTEGER | Number of downloads |
| publicToken | TEXT | UUID for public download |
| startedAt | TIMESTAMP | Processing start time |
| completedAt | TIMESTAMP | Completion time |
| createdAt | TIMESTAMP | Task creation time |

### Tokens Table

| Field | Type | Description |
|-------|------|-------------|
| id | INTEGER | Primary key |
| projectId | INTEGER | Foreign key to projects |
| name | TEXT | Token name |
| tokenHash | TEXT | SHA-256 hash |
| permissions | TEXT | JSON array: ["read","write"] |
| expiresAt | TIMESTAMP | Expiration timestamp |
| isActive | BOOLEAN | Active status |
| lastUsedAt | TIMESTAMP | Last usage timestamp |
| createdAt | TIMESTAMP | ISO timestamp |

## Testing

```bash
# Run unit tests
bun test

# Run E2E tests
bun playwright test

# Type check
bunx tsc --noEmit
```

## Task Lifecycle

```
┌──────────┐    trigger    ┌─────────────┐
│ PENDING  │ ─────────────▶│ PROCESSING  │
└──────────┘               └─────────────┘
     ▲                           │
     │                           │
     │                      ┌────┴────┐
     │                      │         │
     ▼                      ▼         ▼
┌──────────┐          ┌─────────┐ ┌────────┐
│ (retry)  │          │ SUCCESS │ │ FAILED │
└──────────┘          └─────────┘ └────────┘
                           │
                           ▼
                    ┌───────────┐
                    │ DOWNLOADS │
                    └───────────┘
```

## Environment Variables

```env
# Required
DATABASE_URL=file:./data/config.db

# Optional
NEXT_PUBLIC_API_URL=http://localhost:3000
LOG_LEVEL=info
```

## License

MIT
