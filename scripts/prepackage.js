const fs = require("fs");
const ncp = require("ncp").ncp;
const path = require("path");
const { rimrafSync } = require("rimraf");
const { execSync } = require('child_process');
const axios = require('axios');

// Extension dependency configuration
const EXTENSION_DEPENDENCIES = [
  {
    id: 'ms-python.python',
    version: '2025.1.2025020701',
    headers: {
      'User-Agent': 'VSCode 1.85.1',
      'Accept': 'application/json;api-version=3.0-preview.1',
      'Accept-Encoding': 'gzip, deflate, br',
      'Content-Type': 'application/json'
    }
  }
];

const DOWNLOAD_RETRY_COUNT = 3;
const DOWNLOAD_TIMEOUT = 60000; // 60 seconds

// VS Code marketplace API constants
const MARKETPLACE_URL = 'https://marketplace.visualstudio.com/_apis/public/gallery';
const QUERY_URL = `${MARKETPLACE_URL}/extensionquery`;

// Helper function to safely execute in a directory
async function executeInDirectory(dir, operation) {
  const originalDir = process.cwd();
  fs.mkdirSync(dir, { recursive: true });

  try {
    process.chdir(dir);
    await operation();
  } finally {
    process.chdir(originalDir);
  }
}

// Helper function for safe file copy
async function safeCopy(src, dest, options = { dereference: true }) {
  return new Promise((resolve, reject) => {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    ncp(src, dest, options, error => error ? reject(error) : resolve());
  });
}

// Helper function to retry operations
async function withRetry(operation, retryCount = DOWNLOAD_RETRY_COUNT) {
  let lastError;
  for (let attempt = 1; attempt <= retryCount; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      console.log(`[retry] Attempt ${attempt}/${retryCount} failed:`, error.message);
      if (attempt < retryCount) {
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  throw lastError;
}

async function getExtensionDownloadUrl(extension) {
  console.log(`[debug] Getting download URL for ${extension.id}...`);

  const response = await axios({
    method: 'POST',
    url: QUERY_URL,
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json;api-version=3.0-preview.1',
      'User-Agent': 'VSCode 1.85.1'
    },
    data: {
      filters: [{
        pageNumber: 1,
        pageSize: 1,
        criteria: [{
          filterType: 7,
          value: extension.id
        }]
      }],
      assetTypes: ["Microsoft.VisualStudio.Services.VSIXPackage"],
      flags: 0x2 | 0x800
    }
  });

  console.log('[debug] API Response:', JSON.stringify(response.data, null, 2));

  if (!response.data?.results?.[0]?.extensions?.[0]?.versions?.[0]?.files) {
    throw new Error(`Extension ${extension.id} not found in marketplace`);
  }

  const extensionData = response.data.results[0].extensions[0];
  const vsixAsset = extensionData.versions[0].files.find(f =>
    f.assetType === "Microsoft.VisualStudio.Services.VSIXPackage" &&
    f.source
  );

  if (!vsixAsset) {
    throw new Error(`VSIX package not found for ${extension.id}`);
  }

  console.log('[debug] Found VSIX URL:', vsixAsset.source);
  return vsixAsset.source;
}

async function downloadExtension(extension, targetDir) {
  console.log(`[info] Downloading ${extension.id}...`);

  const fileName = `${extension.id}-${extension.version}.vsix`;
  const filePath = path.join(targetDir, fileName);

  return await withRetry(async () => {
    // First get the actual download URL from the marketplace API
    const downloadUrl = await getExtensionDownloadUrl(extension);
    console.log(`[debug] Got download URL: ${downloadUrl}`);

    // Then download the VSIX using axios
    const response = await axios({
      method: 'GET',
      url: downloadUrl,
      responseType: 'arraybuffer',
      timeout: DOWNLOAD_TIMEOUT,
      headers: {
        ...extension.headers,
        'Accept': '*/*'
      }
    });

    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, response.data);

    const stats = fs.statSync(filePath);
    if (stats.size === 0) {
      fs.unlinkSync(filePath);
      throw new Error(`Downloaded file is empty: ${filePath}`);
    }

    console.log(`[debug] Download completed: ${stats.size} bytes`);
    return filePath;
  });
}

async function moveDirectoryContents(sourceDir, targetDir) {
  if (!fs.existsSync(sourceDir)) {
    throw new Error(`Source directory does not exist: ${sourceDir}`);
  }

  // Ensure target directory exists
  fs.mkdirSync(targetDir, { recursive: true });

  // Read all items in the source directory
  const items = fs.readdirSync(sourceDir);

  for (const item of items) {
    const sourcePath = path.join(sourceDir, item);
    const targetPath = path.join(targetDir, item);

    if (fs.existsSync(targetPath)) {
      // Remove existing item in target
      if (fs.statSync(targetPath).isDirectory()) {
        rimrafSync(targetPath);
      } else {
        fs.unlinkSync(targetPath);
      }
    }

    // Move the item
    fs.renameSync(sourcePath, targetPath);
  }
}

async function extractVSIX(vsixPath, targetDir) {
  console.log(`[info] Extracting ${path.basename(vsixPath)}...`);

  // Verify file exists and has content
  if (!fs.existsSync(vsixPath)) {
    throw new Error(`VSIX file not found: ${vsixPath}`);
  }

  const stats = fs.statSync(vsixPath);
  if (stats.size === 0) {
    throw new Error(`Downloaded VSIX file is empty: ${vsixPath}`);
  }

  // Verify file is a valid zip
  try {
    execSync(`unzip -t "${vsixPath}"`, { stdio: 'ignore' });
  } catch (error) {
    throw new Error(`Invalid VSIX file (not a valid zip): ${vsixPath}`);
  }

  const tempDir = path.join(targetDir, 'temp-extract');
  fs.mkdirSync(tempDir, { recursive: true });

  try {
    // Extract the VSIX
    execSync(`unzip -o "${vsixPath}" -d "${tempDir}"`, { stdio: 'inherit' });

    // Find package.json in the extracted files
    const packageJsonPath = path.join(tempDir, 'extension', 'package.json');
    if (!fs.existsSync(packageJsonPath)) {
      throw new Error('package.json not found in extracted VSIX');
    }

    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    const extensionDir = path.join(targetDir, 'extensions', packageJson.publisher, packageJson.name);

    // Move the contents using our new function
    const sourceExtensionDir = path.join(tempDir, 'extension');
    await moveDirectoryContents(sourceExtensionDir, extensionDir);

    return extensionDir;
  } catch (error) {
    console.error('Error during VSIX extraction:', error);
    throw error;
  } finally {
    // Cleanup
    rimrafSync(tempDir);
    rimrafSync(vsixPath);
  }
}

async function setupDependencies(extensionRoot) {
  console.log("[info] Setting up extension dependencies...");

  const dependenciesDir = path.join(extensionRoot, 'dependencies');
  fs.mkdirSync(dependenciesDir, { recursive: true });

  for (const extension of EXTENSION_DEPENDENCIES) {
    try {
      const vsixPath = await downloadExtension(extension, dependenciesDir);
      await extractVSIX(vsixPath, dependenciesDir);
      console.log(`[info] Successfully installed ${extension.id}`);
    } catch (error) {
      console.error(`[error] Failed to setup ${extension.id}:`, error);
      throw error;
    }
  }
}

async function buildExtension(extensionRoot) {
  console.log("[info] Building extension...");

  await executeInDirectory(extensionRoot, async () => {
    // Install dependencies
    execSync('npm install', { stdio: 'inherit' });

    // Build TypeScript
    execSync('npm run compile', { stdio: 'inherit' });

    // Build and copy webview
    try {
      execSync('npm run build:webview', { stdio: 'inherit' });
    } catch (error) {
      console.warn('[warn] Failed to build webview:', error);
    }

    // Copy Python files
    const pythonSrcDir = path.join(extensionRoot, 'tribe');
    const pythonDestDir = path.join(extensionRoot, 'out', 'tribe');
    if (fs.existsSync(pythonSrcDir)) {
      await safeCopy(pythonSrcDir, pythonDestDir);
    }

    // Copy bundled files
    const bundledSrcDir = path.join(extensionRoot, 'bundled');
    const bundledDestDir = path.join(extensionRoot, 'out', 'bundled');
    if (fs.existsSync(bundledSrcDir)) {
      await safeCopy(bundledSrcDir, bundledDestDir);
    }

    // Install Python package in development mode
    try {
      execSync('venv/bin/pip install -e .', { stdio: 'inherit' });
    } catch (error) {
      console.warn('[warn] Failed to install Python package:', error);
    }
  });
}

async function main() {
  const originalDir = process.cwd();

  try {
    const scriptDir = __dirname;
    const extensionRoot = path.resolve(scriptDir, "..");
    const outDir = path.join(extensionRoot, "out");

    console.log("[info] Packaging agent extension...");

    // Clean output directory
    rimrafSync(outDir);
    fs.mkdirSync(outDir, { recursive: true });

    // Setup dependencies first
    await setupDependencies(extensionRoot);

    // Build the extension
    await buildExtension(extensionRoot);

    // Update package.json to include bundled extensions
    const packageJsonPath = path.join(extensionRoot, 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    packageJson.bundledExtensions = EXTENSION_DEPENDENCIES.map(dep => dep.id);
    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));

    console.log("[info] Extension packaging completed successfully");

  } catch (error) {
    console.error("[error] Extension packaging failed:", error);
    process.exit(1);
  } finally {
    process.chdir(originalDir);
  }
}

module.exports = { main };

if (require.main === module) {
  main();
}
