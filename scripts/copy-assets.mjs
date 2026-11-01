import { cpSync } from 'node:fs'

const source = new URL('../', import.meta.url)
const output = new URL('../dist/', import.meta.url)

for (const name of ['_headers', 'robots.txt', 'sitemap.xml', 'og-cover.jpg', 'data', 'thumbs', 'img']) {
  cpSync(new URL(name, source), new URL(name, output), { recursive: true })
}

console.log('dist includes the frontend, gallery data, thumbnails and full-size images.')
