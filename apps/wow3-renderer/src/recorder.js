import puppeteer from 'puppeteer';
import { PuppeteerScreenRecorder } from 'puppeteer-screen-recorder';

/**
 * Record a wow3-animation presentation playing in headless Puppeteer.
 *
 * @param {Object} opts
 * @param {number} opts.port - Local server port
 * @param {number} opts.width - Project width in px
 * @param {number} opts.height - Project height in px
 * @param {string} opts.outputPath - Temp path for the video file
 * @param {(msg: string) => void} [opts.onProgress] - Progress callback
 * @returns {Promise<void>}
 */
export async function record({ port, width, height, outputPath, onProgress }) {
  const log = onProgress || (() => {});

  log('Launching browser...');
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      `--window-size=${width},${height}`,
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--autoplay-policy=no-user-gesture-required',
    ],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width, height });

    log('Loading player...');
    await page.goto(`http://127.0.0.1:${port}/?mode=player`, {
      waitUntil: 'networkidle0',
      timeout: 30000,
    });

    // Wait for the player API to be available
    await page.waitForFunction(() => window.__wow3?.ready === true, { timeout: 15000 });

    log('Loading presentation...');
    await page.evaluate(async () => {
      await window.__wow3.loadFile('/input.wow3a');
    });

    // Read duration and resolution from the loaded project
    const duration = await page.evaluate(() => window.__wow3.duration);
    log(`Presentation duration: ${(duration / 1000).toFixed(1)}s`);

    // Configure and start recording
    const recorder = new PuppeteerScreenRecorder(page, {
      followNewTab: false,
      fps: 24,
      ffmpeg_Path: null,
      videoFrame: { width, height },
      videoCrf: 18,
      videoCodec: 'libx264',
      videoPreset: 'ultrafast',
      videoBitrate: 8000,
    });

    log('Starting recording...');
    await recorder.start(outputPath);

    // Start playback and wait for it to end
    await page.evaluate(() => window.__wow3.play());

    log('Recording complete.');
    await recorder.stop();
  } finally {
    await browser.close();
  }
}
