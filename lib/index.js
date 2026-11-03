// Host half of @pricewin/dsh.
//
// dsh-mcp-client renders an MCP result to its text blocks only, so the Web UI
// never sees `structuredContent`. This plugin gives the PriceWin search tools a
// `presentationMeta` projection: a compact, replayable record of the results
// that lib/client.js draws as hotel and flight cards. The model's content is
// untouched, and a projection that cannot read the result returns null, which
// leaves the card on its text fallback.

export const name = 'pricewin-dsh'
export const inject = ['tools']

// Must match `serverName` in cordis.patch.yml.
const SERVER = 'pricewin'
const MAX_HOTELS = 50
const MAX_FLIGHTS = 20
const MAX_FLIGHT_OFFERS = 6

const PROJECTIONS = {
  search_hotels_live: hotelMeta,
  poll_search_results: hotelMeta,
  search_flights_live: flightMeta,
  poll_flight_results: flightMeta,
}

export function apply(ctx) {
  const attached = new Set()
  const attach = () => {
    for (const [rawName, project] of Object.entries(PROJECTIONS)) {
      const output = ctx.tools.get(`mcp__${SERVER}__${rawName}`)?.output
      if (output === undefined || attached.has(output)) continue
      // Another plugin may already own the projection; never replace it.
      if (output.presentationMeta !== undefined || !Object.isExtensible(output)) continue
      output.presentationMeta = (_args, value) => {
        try {
          return project(value?.structuredContent) ?? null
        } catch {
          return null
        }
      }
      attached.add(output)
    }
  }
  ctx.on('tools/change', attach)
  attach()
  ctx.effect(() => () => {
    for (const output of attached) delete output.presentationMeta
    attached.clear()
  }, 'pricewin-dsh: presentation projections')
}

const isRecord = (value) => typeof value === 'object' && value !== null && !Array.isArray(value)
const text = (value) => (typeof value === 'string' ? value : '')
const num = (value) => (typeof value === 'number' && Number.isFinite(value) ? value : 0)
const validPrice = (price, currency) =>
  typeof price === 'number' && Number.isFinite(price) && price > 0 && /^[A-Za-z]{3}$/.test(currency ?? '')
const safeUrl = (value) => {
  if (typeof value !== 'string') return undefined
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : undefined
  } catch {
    return undefined
  }
}

// Same OTA order and name matching as pricewin-mcp src/hotel-result-list.ts,
// so a card lists the same offers as the ChatGPT widget.
const HOTEL_OTAS = ['booking', 'agoda', 'traveloka', 'tripcom', 'airbnb', 'hotelscom', 'ivivu']

function nameKey(name, city) {
  const normalize = (value) =>
    value
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/đ/g, 'd')
      .replace(/\b(khach san|hotel|resort|spa|the|and|by)\b/g, ' ')
      .replace(/[^\p{L}\p{N}]+/gu, ' ')
      .replace(/\bdanang\b/g, 'da nang')
      .replace(/\bhanoi\b/g, 'ha noi')
      .replace(/\bsaigon\b/g, 'sai gon')
      .replace(/\bphuquoc\b/g, 'phu quoc')
      .trim()
      .replace(/\s+/g, ' ')
  const key = normalize(name)
  const town = normalize(city)
  if (!town) return key
  return key
    .replace(new RegExp(`\\b${town.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g'), ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

function hotelMeta(data) {
  if (!isRecord(data) || !Array.isArray(data.hotels)) return null
  const city = text(data.city)
  const fx = isRecord(data.fxRates) ? data.fxRates : {}
  const usd = (offer) => {
    if (offer.currency === 'USD') return offer.price
    const rate = fx[offer.currency]
    return typeof rate === 'number' && rate > 0 ? offer.price / rate : null
  }

  const rows = []
  const byIdentity = new Map()
  for (const hotel of data.hotels) {
    if (!isRecord(hotel)) continue
    const prices = isRecord(hotel.prices) ? hotel.prices : {}
    const offers = HOTEL_OTAS.flatMap((source) => {
      const quote = prices[source]
      return isRecord(quote) && validPrice(quote.price, quote.currency)
        ? [{ source, price: quote.price, currency: quote.currency.toUpperCase(), url: safeUrl(quote.url), indicative: false }]
        : []
    })
    if (offers.length === 0) continue
    const identity = `${nameKey(text(hotel.name), city)}|${text(hotel.location).toLowerCase()}`
    const existing = byIdentity.get(identity)
    if (existing !== undefined) {
      existing.offers.push(...offers)
      continue
    }
    const row = {
      name: text(hotel.name),
      location: text(hotel.location),
      imageUrl: safeUrl(hotel.imageUrl),
      stars: num(hotel.stars),
      rating: num(hotel.rating),
      reviewCount: num(hotel.reviewCount),
      direct: false,
      offers,
    }
    byIdentity.set(identity, row)
    rows.push(row)
  }

  // OpenTravel partner hotels sell their own rooms, paid at the hotel. They
  // join the OTA row of the same hotel when exactly one matches.
  const directs = new Map()
  for (const direct of [...(data.opentravelResults ?? []), ...(data.opentravelIndicativeResults ?? [])]) {
    if (isRecord(direct) && typeof direct.propertyId === 'string' && !directs.has(direct.propertyId)) {
      directs.set(direct.propertyId, direct)
    }
  }
  const directNameCounts = new Map()
  for (const direct of directs.values()) {
    const key = nameKey(text(direct.name), city)
    directNameCounts.set(key, (directNameCounts.get(key) ?? 0) + 1)
  }
  for (const direct of directs.values()) {
    const key = nameKey(text(direct.name), city)
    const candidates = key ? rows.filter((row) => !row.direct && nameKey(row.name, city) === key) : []
    let row = candidates.length === 1 && directNameCounts.get(key) === 1 ? candidates[0] : undefined
    if (row === undefined) {
      row = {
        name: text(direct.name),
        location: text(direct.address) || text(direct.city) || city,
        imageUrl: safeUrl(direct.mainImageUrl),
        stars: 0,
        rating: 0,
        reviewCount: 0,
        direct: false,
        offers: [],
      }
      rows.push(row)
    }
    row.direct = true
    row.imageUrl ??= safeUrl(direct.mainImageUrl)
    // Only the stay total prices the stay; never rebuild it from a nightly rate.
    const total = direct.totalForStay
    const nights = direct.nights
    if (validPrice(total, direct.currency) && Number.isInteger(nights) && nights > 0) {
      row.offers.push({
        source: 'direct',
        price: total,
        currency: direct.currency.toUpperCase(),
        indicative: direct.priceType === 'indicative',
      })
    }
  }

  for (const row of rows) {
    const cheapest = new Map()
    for (const offer of row.offers) {
      const previous = cheapest.get(offer.source)
      if (previous === undefined || (usd(offer) ?? Infinity) < (usd(previous) ?? Infinity)) cheapest.set(offer.source, offer)
    }
    row.offers = [...cheapest.values()].sort(
      (a, b) => Number(a.indicative) - Number(b.indicative) || (usd(a) ?? Infinity) - (usd(b) ?? Infinity),
    )
    const live = row.offers.filter((offer) => !offer.indicative)
    row.sourceCount = live.length
    row.minPriceUsd = live.length > 0 && live.every((offer) => usd(offer) !== null)
      ? Math.min(...live.map(usd))
      : null
  }
  // The widget's default "compare" order: most sources first, then cheapest.
  rows.sort((a, b) =>
    b.sourceCount - a.sourceCount ||
    (a.minPriceUsd ?? Infinity) - (b.minPriceUsd ?? Infinity) ||
    a.name.localeCompare(b.name),
  )

  return {
    kind: 'hotels',
    version: 1,
    city,
    checkIn: text(data.checkIn),
    checkOut: text(data.checkOut),
    nights: num(data.nights),
    adults: num(data.adults),
    status: text(data.status),
    totalHotels: num(data.totalHotels),
    offset: num(data.offset),
    hasMore: data.hasMore === true,
    // The cap bounds the OTA page; partner hotels are never cut from it.
    rows: rows.slice(0, MAX_HOTELS + directs.size),
  }
}

function flightMeta(data) {
  if (!isRecord(data) || !Array.isArray(data.outboundFlights)) return null
  const leg = (flights) =>
    (Array.isArray(flights) ? flights : [])
      .filter((flight) => isRecord(flight) && validPrice(flight.price, flight.currency))
      .slice(0, MAX_FLIGHTS)
      .map((flight) => {
        const departure = isRecord(flight.departure) ? flight.departure : {}
        const arrival = isRecord(flight.arrival) ? flight.arrival : {}
        return {
          airline: text(flight.airline),
          airlineCode: text(flight.airlineCode),
          flightNumber: text(flight.flightNumber),
          from: text(departure.airport),
          departTime: text(departure.time),
          departDate: text(departure.date),
          to: text(arrival.airport),
          arriveTime: text(arrival.time),
          arriveDate: text(arrival.date),
          duration: num(flight.duration),
          stops: num(flight.stops),
          stopCities: Array.isArray(flight.stopCities) ? flight.stopCities.filter((city) => typeof city === 'string') : [],
          price: flight.price,
          currency: flight.currency.toUpperCase(),
          agent: text(flight.agent),
          url: safeUrl(flight.bookingUrl),
          offers: (Array.isArray(flight.offers) ? flight.offers : [])
            .filter((offer) => isRecord(offer) && validPrice(offer.price, offer.currency))
            .slice(0, MAX_FLIGHT_OFFERS)
            .map((offer) => ({
              agent: text(offer.agent),
              price: offer.price,
              currency: offer.currency.toUpperCase(),
              url: safeUrl(offer.bookingUrl),
            })),
        }
      })
  return {
    kind: 'flights',
    version: 1,
    origin: text(data.origin),
    destination: text(data.destination),
    departureDate: text(data.departureDate),
    returnDate: text(data.returnDate),
    adults: num(data.adults),
    cabin: text(data.cabin),
    status: text(data.status),
    totalOutbound: num(data.totalOutbound),
    totalReturn: num(data.totalReturn),
    hasMore: data.hasMore === true,
    outbound: leg(data.outboundFlights),
    return: leg(data.returnFlights),
  }
}
