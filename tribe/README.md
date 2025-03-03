# Tribe Extension

A VS Code extension for AI-powered team creation and management.

## Configuration

The extension requires certain environment variables to be set. Create a `.env` file in the root directory by copying `.env.example`:

```bash
cp .env.example .env
```

Then edit the `.env` file with your configuration:

### Required Configuration
- `AI_API_ENDPOINT`: The API endpoint for the foundation model
- `ANTHROPIC_API_KEY`: Your Anthropic API key for accessing the foundation model

### Optional Configuration
- `TRIBE_MAX_RPM`: Maximum requests per minute (default: 60)
- `TRIBE_VERBOSE`: Enable verbose logging (default: true)

## Development

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   pip install -r requirements.txt
   ```
3. Set up your environment variables as described above
4. Run the extension in VS Code:
   - Press F5 to start debugging
   - Or run `npm run watch` for development

## Usage

[Rest of existing documentation...]
