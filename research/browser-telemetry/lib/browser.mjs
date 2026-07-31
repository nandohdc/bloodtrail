export function chromeLaunchOptions({ headless }) {
  const options = { headless }
  if (process.env.CHROME_PATH) {
    options.executablePath = process.env.CHROME_PATH
  } else {
    options.channel = process.env.BROWSER_CHANNEL || 'chrome'
  }
  return options
}
