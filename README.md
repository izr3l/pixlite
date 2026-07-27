# Pixlite - Browser-Based Image Optimizer

A lightning-fast, privacy-first, browser-based image optimization tool. 

Users can drag and drop images, configure resize and compression settings, inspect or strip metadata, and download the processed results either individually or batched as a ZIP file. **No images ever leave your device.** There is no backend, no database, no authentication, and no server-side processing.

##  Features

- **100% Client-Side Processing**: All image resizing, compression, and metadata stripping happens directly in your browser using Web Workers.
- **Format Conversion**: Convert images between JPEG, PNG, WebP, AVIF, and GIF.
- **Smart Compression**: Compress by quality slider or set a target file size (e.g., compress this image to exactly 200KB).
- **Advanced Resizing**: Lock aspect ratios, use social media presets (Instagram, Twitter/X, LinkedIn), or define custom dimensions.
- **Metadata Management**: Inspect EXIF data, strip GPS location data for privacy, or remove all metadata completely.
- **Batch Processing**: Queue up to 20 images at a time (max 150MB each) and process them concurrently with zero UI freezing.
- **Before & After Preview**: Interactive comparison slider to instantly see quality differences and file size reduction.
- **ZIP Export**: Download all optimized images in a single ZIP file.

##  Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS, shadcn/ui
- **Icons**: Lucide React
- **State Management**: Zustand
- **Image Processing**:
  - `browser-image-compression` (Client-side compression)
  - `exifr` (EXIF reading)
  - `piexifjs` (EXIF stripping)
- **Export**: `jszip`, `file-saver`

##  Getting Started

### Prerequisites
- Node.js (v20.9.0 or higher)

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/izr3l/pixlite.git
   cd pixlite
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Run the development server:**
   ```bash
   npm run dev
   ```

4. **Open the app:**
   Visit `http://localhost:3000` in your browser.

##  Project Structure

- `src/components/`: Reusable UI components (DropZone, FileQueue, PreviewPanel, etc.)
- `src/lib/`: Core utilities including processing logic (`compress.ts`, `resize.ts`, `metadata.ts`).
- `src/workers/`: Web Worker (`image.worker.ts`) for offloading heavy processing from the main thread.
- `src/store/`: Zustand global state management (`useImageStore.ts`).
- `src/app/`: Next.js App Router entry points.

##  Contributing

Contributions, issues, and feature requests are welcome!

##  Privacy & Security

**Your images never leave your page.** 
Pixlite does not have a backend server. All files are loaded into browser memory, processed using your local CPU, and downloaded directly back to your local filesystem. You can safely use Pixlite offline.
