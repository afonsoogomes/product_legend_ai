import { program } from 'commander'
import puppeteer from "puppeteer"
import { load } from 'cheerio'
import OpenAI from 'openai'
import TelegramBot from 'node-telegram-bot-api'
import fs from 'fs'
import path from 'path'
import 'dotenv/config'

program
  .option('-u, --url <path>', 'URL do produto da shopee.')
  .parse(process.argv)

const fetchProduct = async () => {
  const browser = await puppeteer.launch({
    ignoreDefaultArgs: ['--disable-extensions'],
    args: ['--headless', '--no-sandbox', '--disable-setuid-sandbox', '--disable-features=site-per-process']
  })

  const page = await browser.newPage()
  await page.setJavaScriptEnabled(false)
  await page?.goto(program.opts().url)
  await page?.waitForNetworkIdle()
  const html = await page?.content()

  await browser.close()

  const $ = load(html)
  const title = $('h2:contains("Seção de informações do produto") ~ div > div:nth-child(1) > span').text()
  const details = $('h2:contains("Seção de informações do produto") ~ div').text()
  const price = $('h2:contains("Price Section") ~ div > div:nth-child(2) > div:nth-child(1)').text()

  return {
    title,
    details,
    price
  }
}

const fecthLegend = async (product) => {
  const template = fs.readFileSync(path.resolve('./stubs/template.stub'), 'utf8').replace(/{{(.*?)}}/g, (match, key) => {
    if (product.hasOwnProperty(key.trim())) {
      return product[key.trim()]
    } else {
      return match
    }
  })

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
  })

  const completions = await openai.chat.completions.create({
    messages: [{ role: 'user', content: template }],
    model: 'gpt-3.5-turbo'
  })

  return completions.choices?.[0]?.message?.content
}

const sendMessage = async (message) => {
  const bot = new TelegramBot(process.env.TELEGRAM_API_TOKEN, {
    polling: true
  })

  await bot.sendMessage(process.env.TELEGRAM_CHANNEL_ID, message)
}

const start = async () => {
  const product = await fetchProduct()
  const legend = await fecthLegend(product)
  await sendMessage(legend)
  process.exit(0);
}

start()
