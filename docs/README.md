# OSO Kafka Backup Documentation

This directory contains the documentation site for OSO Kafka Backup, built with [Docusaurus](https://docusaurus.io/).

## Prerequisites

- Node.js 18+
- npm or yarn

## Local Development

```bash
# Install dependencies
npm install

# Start development server
npm run start
```

The site runs at http://localhost:3000 with hot reloading enabled.

## Building

```bash
# Build for production
npm run build

# Serve the built site locally
npm run serve
```

Output is generated in the `build/` directory.

## Project Structure

```
docs/
├── docs/                  # Documentation markdown files
│   ├── intro.md          # Homepage
│   ├── getting-started/  # Getting started guides
│   ├── deployment/       # Deployment guides
│   ├── guides/           # How-to guides
│   ├── reference/        # API and CLI reference
│   ├── operator/         # Kubernetes operator docs
│   ├── enterprise/       # Enterprise features
│   ├── architecture/     # Architecture deep-dives
│   ├── troubleshooting/  # Troubleshooting guides
│   └── examples/         # Example configurations
├── static/               # Static assets (images, diagrams)
├── src/
│   └── css/             # Custom CSS
├── docusaurus.config.js  # Docusaurus configuration
├── sidebars.js          # Sidebar navigation
└── package.json         # Dependencies
```

## Adding Documentation

1. Create a new `.md` file in the appropriate directory
2. Add frontmatter:
   ```yaml
   ---
   title: "Page Title"
   description: "Short description for SEO"
   sidebar_position: 1
   ---
   ```
3. Add the page to `sidebars.js`
4. Run `npm run start` to verify

## Writing Guidelines

- Use action-oriented language ("Create", "Configure", not "It is possible to...")
- Include copy-paste ready code examples
- Always specify language in code blocks (```bash, ```yaml, etc.)
- Use relative links for internal documentation
- Add SEO-friendly titles and descriptions

## Deployment

Documentation is automatically deployed via GitHub Actions on push to `main`.

For manual deployment:
```bash
npm run build
npm run deploy
```

## Resources

- [Docusaurus Documentation](https://docusaurus.io/docs)
- [Markdown Features](https://docusaurus.io/docs/markdown-features)
- [MDX Components](https://docusaurus.io/docs/markdown-features/react)
