# AI Woo Chat - SaaS Platform

Next.js 14 SaaS platform for AI-powered WooCommerce chat assistant.

## Tech Stack

- **Next.js 14** (App Router)
- **Supabase** (Postgres + pgvector + Auth)
- **TypeScript**
- **OpenAI API** (for embeddings and chat)
- **Resend** (for emails)

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Supabase project
- OpenAI API key
- Resend API key (optional)

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Copy `.env.example` to `.env.local`:
   ```bash
   cp .env.example .env.local
   ```

4. Fill in your environment variables in `.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL` - Your Supabase project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Your Supabase anon key
   - `SUPABASE_SERVICE_ROLE_KEY` - Your Supabase service role key
   - `OPENAI_API_KEY` - Your OpenAI API key
   - `RESEND_API_KEY` - Your Resend API key (optional)
   - `SAAS_URL` - Your SaaS platform URL

5. Run the development server:
   ```bash
   npm run dev
   ```

6. Open [http://localhost:3000](http://localhost:3000) in your browser

## Project Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── (auth)/            # Auth routes (login, etc.)
│   ├── (dashboard)/       # Dashboard routes (protected)
│   ├── api/               # API routes
│   │   ├── chat/          # Chat endpoints (bootstrap, message, events)
│   │   ├── ingestion/     # Ingestion webhook
│   │   ├── license/       # License activation
│   │   └── widget/        # Widget bundle endpoint
│   ├── layout.tsx         # Root layout
│   └── page.tsx           # Home page
├── lib/
│   ├── chat/              # Chat session & message handling
│   ├── rag/               # RAG pipeline (retrieval, context, prompts)
│   ├── embeddings/        # OpenAI embeddings
│   ├── ingestion/         # Ingestion service
│   ├── wordpress/         # WP API client
│   ├── supabase/          # Supabase client setup
│   │   ├── client.ts      # Browser client
│   │   ├── server.ts      # Server client
│   │   ├── middleware.ts  # Auth middleware
│   │   └── types.ts       # Database types
│   └── auth/              # Auth helpers
├── widget/                # Chat widget frontend
│   ├── components/        # React UI components
│   ├── api-client.ts      # API client
│   ├── storage.ts         # Storage management
│   └── ChatWidget.tsx     # Main widget component
└── middleware.ts          # Next.js middleware
```

## Implementation Status

✅ **To-Do #8: Ingestion Service** - COMPLETED
✅ **To-Do #9: RAG Core** - COMPLETED  
✅ **To-Do #10: Chat Runtime** - COMPLETED
✅ **To-Do #11: Widget Frontend** - COMPLETED
✅ **To-Do #12: Email Service** - COMPLETED
✅ **To-Do #13: Dashboard Basic** - COMPLETED

**All 14 To-Dos are now completed!** 🎉

See `docs/implementation-status.md` for detailed status.

## Troubleshooting

Ako naiđeš na probleme, proveri [TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) za česte probleme i rešenja:

- **"Tenant or user not found" (XX000)** - RLS problemi sa direktnim Postgres konekcijama
- **"site_id is not defined"** - Shorthand property syntax greške
- **406 Not Acceptable (PGRST116)** - `.single()` umesto `.maybeSingle()` u Supabase query-jima

## Environment Variables

See `.env.example` for all required environment variables.

## Development

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run type-check` - Run TypeScript type checking

## Database Types

To regenerate Supabase types:

```bash
npx supabase gen types typescript --project-id <project-id> > src/lib/supabase/types.ts
```

## License

Proprietary - All rights reserved
