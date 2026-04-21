# Stage 1: Install all dependencies and build everything
FROM node:18-alpine AS build
WORKDIR /app

# Copy root package files (workspace config + lockfile)
COPY package.json package-lock.json ./
COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/

# Install all workspace dependencies using the root lockfile
RUN npm ci

# Copy source code
COPY backend/ ./backend/
COPY frontend/ ./frontend/

# Build frontend and backend
RUN npm run build:frontend && npm run build:backend

# Stage 2: Production
FROM node:18-alpine
WORKDIR /app

# Copy root package files
COPY package.json package-lock.json ./
COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/

# Install production dependencies only
RUN npm ci --omit=dev

# Copy compiled backend
COPY --from=build /app/backend/dist ./backend/dist

# Copy frontend build output
COPY --from=build /app/frontend/dist ./frontend/dist

# Create data directory for SQLite
RUN mkdir -p /app/backend/data

ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

CMD ["node", "backend/dist/index.js"]
