#!/usr/bin/env node
// Simple renderer for docs/screenshot-template.html using Puppeteer
const fs = require('fs')
const path = require('path')
const puppeteer = require('puppeteer')

async function render(output) {
  const template = path.resolve(__dirname, 'screenshot-template.html')
  const html = 'file://' + template
  const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] })
  const page = await browser.newPage()
  await page.setViewport({ width: 1400, height: 900 })
  await page.goto(html, { waitUntil: 'networkidle0' })
  await page.waitForTimeout(250)
  await page.screenshot({ path: output || path.resolve(__dirname, 'fancy-screenshot.png'), fullPage: false })
  await browser.close()
}

const argv = require('minimist')(process.argv.slice(2))
const out = argv.output || argv.o || path.resolve(__dirname, 'fancy-screenshot.png')
render(out).then(() => console.log('Rendered', out)).catch(err => { console.error(err); process.exit(1) })
