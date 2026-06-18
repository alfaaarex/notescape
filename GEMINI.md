# Project Overview: Notescape

Notescape is a premium, collaborative note-taking and task-management application built with Next.js and Supabase. It features a custom markdown-like editor, real-time collaboration using Yjs, AI-powered note insights via the Claude API, and PWA support for an installable workspace experience.

## Core Technologies
- **Framework:** [Next.js 16 (App Router)](https://nextjs.org/)
- **Language:** [TypeScript](https://www.typescriptlang.org/)
- **Database & Auth:** [Supabase](https://supabase.com/)
- **Real-time Collaboration:** [Yjs](https://yjs.dev/) with Supabase Realtime/Broadcast
- **Styling:** [Tailwind CSS](https://tailwindcss.com/) with [Framer Motion](https://www.framer.com/motion/)
- **Editor:** Custom Markdown editor with slash commands and Tiptap integration
- **AI Integration:** Claude API (Anthropic) for generating summaries, themes, and action items
- **PWA:** Service workers and manifest for offline support and installability

## Getting Started

### Prerequisites
- Node.js (version as per `package.json` devDependencies, likely 20+)
- npm, yarn, pnpm, or bun

### Environment Variables
Create a `.env.local` file with the following keys:
```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
# Optional: Anthropic API key for AI features
# ANTHROPIC_API_KEY=your_anthropic_api_key
```

### Development Commands
- `npm run dev`: Starts the development server at `http://localhost:3000`
- `npm run build`: Builds the application for production
- `npm run start`: Starts the production server
- `npm run lint`: Runs ESLint for code quality checks

## Project Structure
- `app/`: Next.js App Router pages and API routes
  - `api/parse-task/`: NLP task parsing logic
  - `shared/[id]/`: Public/Shared note views
- `components/`: Reusable UI components
  - `editor.tsx`: The primary collaborative markdown editor
  - `task-board.tsx` / `task-calendar.tsx`: Task management views
  - `auth-provider.tsx`: Supabase authentication context
- `lib/`: Core utilities and business logic
  - `supabaseClient.ts`: Supabase client initialization
  - `useYjsNote.ts`: Hook for Yjs collaboration logic
  - `types.ts`: Centralized TypeScript interfaces (Note, Task, Profile, etc.)
  - `storage.ts`: Local and remote storage abstraction
- `public/`: Static assets and PWA manifest/icons

## Development Conventions

### Code Style
- **Components:** Prefer Functional Components with hooks. Use `'use client'` directive for interactive components.
- **Styling:** Use Tailwind CSS utility classes. For complex animations, use Framer Motion.
- **State Management:** Use React Context for global state (e.g., Auth, Theme) and local state/hooks for component-specific logic.
- **Collaboration:** Collaborative features should leverage Yjs and the `useYjsNote` hook to ensure data consistency across clients.

### Data Modeling
- Define shared types in `lib/types.ts`.
- Database interactions should primarily go through the `supabase` client in `lib/supabaseClient.ts`.
- Note content is stored as strings but treated as Markdown within the application.

### AI Features
- AI-related logic (like note summarization) uses the Anthropic API. Ensure proper error handling and loading states when calling these services.

### Testing & Quality
- Ensure new components are responsive and support both Light and Dark themes (managed via `ThemeProvider`).
- Run `npm run lint` before committing to maintain code standards.
