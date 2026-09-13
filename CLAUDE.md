# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Backend
- Install dependencies: `npm install`
- Run server (dev): `npm run server`
- Run tests: `npm test`
- Start entire app (server + client): `npm run dev`

### Frontend
- Install dependencies: `npm install --prefix client`
- Run frontend (dev): `npm run client`
- Build frontend: `npm run build`

## Architecture & Structure

### Big Picture
The application is a full-stack stock tracking system ("Buffet API") consisting of a Node.js/Express backend and a React/Vite frontend. The application is publicly accessible and does not require user authentication.

### Backend (`/src`)
- **Models (`/src/models`)**: Sequelize models for PostgreSQL. `index.js` handles automatic model loading and association.
- **Routes (`/src/routes`)**: Express routers defining the API surface.
- **Services (`/src/services`)**: Business logic and external API integrations (primarily `yahoo-finance2`).
- **Middleware (`/src/middleware`)**: Request validation and centralized error handling.
  - `validate.js`: Zod-based request validation using schemas defined in `schemas.js`.
  - `errorHandler.js`: Centralized error handling.
- **MCP (`/src/mcp`)**: Implements Model Context Protocol for AI agent integration.
- **Server (`server.js`)**: Application entry point, database initialization, and route registration.

### Frontend (`/client`)
- **Framework**: React with TypeScript and Vite.
- **State Management**: Redux Toolkit.
- **Visualization**: Recharts for stock price and performance analytics.
- **Structure**:
  - `src/api.ts`: Centralized API client.
  - `src/components/dashboards`: Specialized views for Earnings, Fundamentals, News, and Performance.

### Data Flow
1. Client requests data via REST API.
2. Backend validates input via Zod middleware.
3. Services fetch data from PostgreSQL or the Yahoo Finance provider.
4. Data is returned as JSON and visualized in React dashboards.
