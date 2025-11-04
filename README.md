# NexusChat

**Videxa NexusChat** - AI-powered healthcare data intelligence assistant built for the Videxa platform.

## Overview

NexusChat is a specialized AI chat interface designed for healthcare data analysis and insights. It integrates with the Videxa AgentNexus platform to provide intelligent conversation capabilities for healthcare claims processing, carrier analysis, and data intelligence.

## Key Features

- **Healthcare Data Intelligence**: Analyze insurance claims, carrier contracts, and healthcare data
- **Multi-Tenant Support**: Secure, isolated data access per organization
- **Snowflake Integration**: Direct connection to Snowflake data warehouse for real-time analytics
- **SSO Authentication**: Seamless single sign-on with AgentNexus platform
- **Conversation History**: Persistent chat history stored in Snowflake
- **File Upload**: Support for healthcare data file ingestion (CSV, 837 EDI)
- **AI Agents**: Powered by advanced LLM models with custom healthcare knowledge
- **Web Search Integration**: Real-time information retrieval for healthcare queries

## Architecture

NexusChat is part of the Videxa platform ecosystem:

```
┌──────────────┐         ┌──────────────┐         ┌──────────────┐
│ AgentNexus   │ ──SSO──►│  NexusChat   │ ──────►│  Snowflake   │
│  Dashboard   │         │  (Chat UI)   │         │  (Data)      │
└──────────────┘         └──────────────┘         └──────────────┘
```

- **AgentNexus**: User registration, authentication, and dashboard
- **NexusChat**: AI-powered chat interface
- **Snowflake**: Data warehouse for healthcare data and user management

## Technology Stack

- **Frontend**: React 18, Vite, TailwindCSS
- **Backend**: Node.js, Express, Passport.js
- **Database**: Snowflake (user profiles, conversations, healthcare data)
- **AI/ML**: OpenAI, Anthropic Claude, custom LLM integrations
- **Authentication**: JWT tokens, SSO with AgentNexus
- **Deployment**: Docker, Azure Container Registry, Azure App Service

## Getting Started

### Prerequisites

- Node.js 20 LTS or higher
- Docker and Docker Compose
- Access to Snowflake instance
- AgentNexus backend running (for SSO)

### Environment Variables

Create a `.env` file with the following variables:

```bash
# Application
NODE_ENV=development
HOST=localhost
PORT=3080

# Snowflake Connection
SNOWFLAKE_ACCOUNT=your-account
SNOWFLAKE_USER=your-user
SNOWFLAKE_DATABASE=AGENTNEXUS_DB
SNOWFLAKE_SCHEMA=NEXUSCHAT
SNOWFLAKE_WAREHOUSE=COMPUTE_WH
SNOWFLAKE_PRIVATE_KEY=your-private-key

# Authentication
AGENTNEXUS_BACKEND_URL=http://localhost:3050
SESSION_SECRET=your-session-secret

# AI Models
OPENAI_API_KEY=your-openai-key
ANTHROPIC_API_KEY=your-anthropic-key
```

### Installation

```bash
# Install dependencies
npm install

# Build packages
npm run build:packages

# Run in development mode
npm run backend:dev
npm run frontend:dev
```

### Docker Deployment

```bash
# Build and start services
docker-compose -f docker-compose.snowflake-only.yml up -d

# View logs
docker-compose -f docker-compose.snowflake-only.yml logs -f
```

## Documentation

For detailed documentation, see the `/documentation` directory:

- [Snowflake Deployment Summary](documentation/snowflake-deployment-summary.md)
- [Use Cases](documentation/use-cases.md)
- [Test Cases](documentation/test-cases.md)
- [Architecture](documentation/SNOWFLAKE-ONLY-ARCHITECTURE.md)

## Development

### Running Tests

```bash
# Run E2E tests
npm run test:videxa

# Run E2E tests in headed mode
npm run test:videxa:headed

# Run specific test suites
npm run test:videxa:branding
npm run test:videxa:functionality
```

### Testing MCP-Playwright Integration

```bash
npm run test:mcp-playwright
```

## Deployment

### Azure Deployment

```bash
# Build Docker image
docker build -t nexuschat:latest .

# Tag for Azure Container Registry
docker tag nexuschat:latest videxaregistry.azurecr.io/nexuschat:latest

# Push to ACR
docker push videxaregistry.azurecr.io/nexuschat:latest
```

### Environment-Specific Configuration

- **Development**: Uses local .env file
- **Production**: Uses Azure Key Vault for secrets

## Contributing

This is a proprietary Videxa project. For internal development:

1. Create a feature branch from `main`
2. Make your changes and test thoroughly
3. Submit a pull request with detailed description
4. Ensure all tests pass before merging

## Security

- All authentication handled via JWT tokens from AgentNexus
- Snowflake connections use RSA key-pair authentication
- Secrets stored in Azure Key Vault (production)
- Multi-tenant data isolation enforced at database level

## Support

For technical support or questions:
- Internal team: Contact the Videxa development team
- Issues: [GitHub Issues](https://github.com/kcrossley2020/NexusChat/issues)

## License

ISC - Proprietary to Videxa

---

**Version**: v1.0.0
**Last Updated**: 2025-01-03
**Maintained by**: Videxa Development Team
