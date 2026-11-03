// Browser half of @pricewin/dsh: hotel and flight result cards for the
// PriceWin search tools in the DSH Web UI.
//
// The cards read the `presentationMeta` record that lib/index.js attaches on
// the host. A result without it (an older session, a failed projection) keeps
// a plain text row, so nothing renders worse than DSH's generic card.
//
// Hand-written in the shape DSH's module loader serves for /plugins/<name>/client.js,
// so the package needs no build step. React comes from the host page.
window.__ModuleLoader__.load({
  id: '@pricewin/dsh',
  factory: (require) => {
    const module = { exports: {} }
    const React = require('react')
    const h = React.createElement

    const SERVER = 'pricewin'
    const NS = 'pricewin'
    const HOTEL_TOOLS = ['search_hotels_live', 'poll_search_results']
    const FLIGHT_TOOLS = ['search_flights_live', 'poll_flight_results']
    const FIRST_HOTELS = 3
    const FIRST_FLIGHTS = 3

    const en = {
      'hotel.title': 'Hotel prices',
      'flight.title': 'Flight prices',
      'status.searching': 'Searching…',
      'status.started': 'Search started',
      'status.more': 'More prices are still arriving',
      'status.failed': 'The search failed',
      'hotel.found': '{n} hotels',
      'hotel.nights': '{n} nights total',
      'hotel.night': '1 night total',
      'hotel.perNight': '{amount}/night',
      'hotel.on': 'on {source}',
      'hotel.reviews': '{n} reviews',
      'hotel.stars': '{n}-star',
      'hotel.direct': 'Book direct · pay at the hotel',
      'hotel.directAsk': 'Ask the assistant to show the rooms of a book-direct hotel.',
      'hotel.estimate': 'Estimate',
      'hotel.note': 'Starting prices for the whole stay. Room type, meals and cancellation terms can differ between sites.',
      'flight.fares': '{n} fares',
      'flight.nonstop': 'Nonstop',
      'flight.stops': '{n} stops',
      'flight.stop': '1 stop',
      'flight.via': 'via {agent}',
      'flight.party': 'for {n} travellers',
      'flight.return': 'Return',
      'flight.outbound': 'Outbound',
      'flight.note': 'Each leg is a separate one-way ticket. Prices are for the whole party.',
      'list.showAll': 'Show all {n}',
      'list.showLess': 'Show fewer',
      'list.page': 'Results {from}–{to}. Ask for more to see the next page.',
      'source.direct': 'Direct',
    }
    const zh = {
      'hotel.title': '酒店比价',
      'flight.title': '机票比价',
      'status.searching': '正在搜索…',
      'status.started': '已开始搜索',
      'status.more': '更多价格仍在陆续返回',
      'status.failed': '搜索失败',
      'hotel.found': '{n} 家酒店',
      'hotel.nights': '共 {n} 晚总价',
      'hotel.night': '共 1 晚总价',
      'hotel.perNight': '{amount}/晚',
      'hotel.on': '来自 {source}',
      'hotel.reviews': '{n} 条评价',
      'hotel.stars': '{n} 星级',
      'hotel.direct': '酒店直订 · 到店付款',
      'hotel.directAsk': '可以让助手展示直订酒店的房型。',
      'hotel.estimate': '估价',
      'hotel.note': '整段住宿的起价。各网站的房型、餐食和取消条款可能不同。',
      'flight.fares': '{n} 个票价',
      'flight.nonstop': '直飞',
      'flight.stops': '经停 {n} 次',
      'flight.stop': '经停 1 次',
      'flight.via': '来自 {agent}',
      'flight.party': '{n} 位旅客总价',
      'flight.return': '返程',
      'flight.outbound': '去程',
      'flight.note': '每一程都是单独出票的单程机票。价格为全部旅客的总价。',
      'list.showAll': '显示全部 {n} 个',
      'list.showLess': '收起',
      'list.page': '第 {from}–{to} 条结果。需要更多可以让助手翻页。',
      'source.direct': '直订',
    }

    const SOURCE_NAMES = {
      booking: 'Booking.com',
      agoda: 'Agoda',
      traveloka: 'Traveloka',
      tripcom: 'Trip.com',
      airbnb: 'Airbnb',
      hotelscom: 'Hotels.com',
      ivivu: 'iVIVU',
    }

    // `t` from the DSH locale service, with {name} placeholders filled here.
    function useText(t) {
      return (key, params) => {
        let value = typeof t === 'function' ? t(key) : key
        if (typeof value !== 'string' || value === key) value = en[key] ?? key
        for (const [name, replacement] of Object.entries(params ?? {})) value = value.split(`{${name}}`).join(String(replacement))
        return value
      }
    }

    const language = () => (typeof navigator !== 'undefined' && navigator.language) || 'en-US'
    function money(amount, currency) {
      try {
        return new Intl.NumberFormat(language(), {
          style: 'currency',
          currency,
          maximumFractionDigits: amount >= 1000 ? 0 : 2,
        }).format(amount)
      } catch {
        return `${amount} ${currency}`
      }
    }
    function day(iso) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(iso ?? '')) return iso ?? ''
      return new Intl.DateTimeFormat(language(), { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' })
        .format(new Date(`${iso}T00:00:00Z`))
    }
    function duration(minutes) {
      if (!(minutes > 0)) return ''
      const hours = Math.floor(minutes / 60)
      const rest = minutes % 60
      return hours > 0 ? `${hours}h${rest > 0 ? ` ${rest}m` : ''}` : `${rest}m`
    }
    const sourceName = (source, say) => (source === 'direct' ? say('source.direct') : SOURCE_NAMES[source] ?? source)

    function resultText(block) {
      const content = Array.isArray(block?.content) ? block.content : []
      return content.map((item) => (item?.type === 'text' ? item.text : '')).join('\n').trim()
    }
    const CSS = `
.pwdsh{--pw-line:color-mix(in srgb,currentColor 14%,transparent);--pw-soft:color-mix(in srgb,currentColor 5%,transparent);--pw-dim:color-mix(in srgb,currentColor 62%,transparent);--pw-good:color-mix(in srgb,#0f9d63 78%,currentColor);border:1px solid var(--pw-line);border-radius:10px;margin:4px 0;font-size:13px;line-height:1.4;overflow:hidden;max-width:760px}
.pwdsh *{box-sizing:border-box}
.pwdsh-head{display:flex;flex-wrap:wrap;align-items:baseline;gap:4px 10px;padding:8px 12px;background:var(--pw-soft)}
.pwdsh-brand{font-weight:600}
.pwdsh-sub{color:var(--pw-dim)}
.pwdsh-status{margin-left:auto;color:var(--pw-dim);font-size:12px}
.pwdsh-list{display:flex;flex-direction:column}
.pwdsh-card{display:grid;grid-template-columns:92px minmax(0,1fr) auto;gap:4px 12px;padding:10px 12px;border-top:1px solid var(--pw-line)}
.pwdsh-photo{grid-row:span 2;width:92px;height:70px;border-radius:6px;object-fit:cover;background:var(--pw-soft)}
.pwdsh-name{font-weight:600;color:inherit;text-decoration:none;overflow-wrap:anywhere}
a.pwdsh-name:hover{text-decoration:underline}
.pwdsh-meta{color:var(--pw-dim);font-size:12px;overflow-wrap:anywhere}
.pwdsh-meta span+span::before{content:" · "}
.pwdsh-price{text-align:right;white-space:nowrap}
.pwdsh-amount{font-size:16px;font-weight:700}
.pwdsh-per{color:var(--pw-dim);font-size:12px}
.pwdsh-offers{grid-column:2 / 4;display:flex;flex-wrap:wrap;gap:6px}
.pwdsh-offer{display:inline-flex;gap:6px;align-items:baseline;padding:2px 8px;border:1px solid var(--pw-line);border-radius:999px;color:inherit;text-decoration:none;font-size:12px;white-space:nowrap}
a.pwdsh-offer:hover{background:var(--pw-soft)}
.pwdsh-offer strong{font-weight:600}
.pwdsh-best{border-color:var(--pw-good);color:var(--pw-good)}
.pwdsh-direct{display:inline-block;padding:1px 7px;border-radius:999px;background:color-mix(in srgb,var(--pw-good) 14%,transparent);color:var(--pw-good);font-size:11px;font-weight:600;margin-top:2px}
.pwdsh-flight{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:4px 12px;padding:10px 12px;border-top:1px solid var(--pw-line)}
.pwdsh-times{font-weight:600;font-size:14px}
.pwdsh-flight .pwdsh-offers{grid-column:1 / 3}
.pwdsh-leg{padding:6px 12px;border-top:1px solid var(--pw-line);font-weight:600;background:var(--pw-soft)}
.pwdsh-foot{display:flex;flex-wrap:wrap;gap:6px 12px;align-items:center;padding:8px 12px;border-top:1px solid var(--pw-line);color:var(--pw-dim);font-size:12px}
.pwdsh-more{margin-left:auto;border:1px solid var(--pw-line);background:none;color:inherit;border-radius:6px;padding:3px 10px;font:inherit;cursor:pointer}
.pwdsh-more:hover{background:var(--pw-soft)}
.pwdsh-text{margin:0;padding:8px 12px;border-top:1px solid var(--pw-line);white-space:pre-wrap;overflow-wrap:anywhere;font:inherit;font-size:12px;max-height:240px;overflow:auto}
.pwdsh-error{padding:8px 12px;border-top:1px solid var(--pw-line);color:color-mix(in srgb,#d93025 80%,currentColor)}
@media (max-width:520px){.pwdsh-card{grid-template-columns:64px minmax(0,1fr)}.pwdsh-photo{width:64px;height:52px}.pwdsh-price{text-align:left;grid-column:2}.pwdsh-offers{grid-column:1 / 3}}
`
    function ensureStyle() {
      if (typeof document === 'undefined' || document.getElementById('pwdsh-style') !== null) return () => {}
      const style = document.createElement('style')
      style.id = 'pwdsh-style'
      style.textContent = CSS
      document.head.appendChild(style)
      return () => style.remove()
    }

    function Link({ href, className, children, label }) {
      return href
        ? h('a', { href, className, target: '_blank', rel: 'noopener noreferrer', 'aria-label': label }, children)
        : h('span', { className }, children)
    }

    function Shell({ title, subtitle, status, children }) {
      return h('div', { className: 'pwdsh' },
        h('div', { className: 'pwdsh-head' },
          h('span', { className: 'pwdsh-brand' }, 'PriceWin · ', title),
          subtitle ? h('span', { className: 'pwdsh-sub' }, subtitle) : null,
          status ? h('span', { className: 'pwdsh-status' }, status) : null,
        ),
        children,
      )
    }

    // Shared by both views: everything that is not a settled card.
    function Pending({ props, title, say }) {
      const block = props.block
      if (props.phase !== 'result') return h(Shell, { title, status: say('status.searching') })
      if (block.isError) {
        const message = resultText(block) || block.error?.reason || block.error?.code || ''
        return h(Shell, { title, status: say('status.failed') },
          message ? h('div', { className: 'pwdsh-error' }, message.split('\n')[0]) : null)
      }
      const text = resultText(block)
      return h(Shell, { title }, text ? h('pre', { className: 'pwdsh-text' }, text) : null)
    }

    function Toggle({ shown, total, open, setOpen, say }) {
      if (total <= shown && !open) return null
      return h('button', { type: 'button', className: 'pwdsh-more', onClick: () => setOpen(!open) },
        open ? say('list.showLess') : say('list.showAll', { n: total }))
    }

    function HotelCard({ row, nights, say }) {
      const main = row.offers[0]
      const live = row.offers.filter((offer) => !offer.indicative)
      const bestPrice = live.length > 1 ? live[0] : null
      const link = row.offers.find((offer) => offer.url)?.url
      const meta = []
      if (row.rating > 0) meta.push(h('span', { key: 'r' }, `★ ${row.rating.toFixed(1)}`, row.reviewCount > 0 ? ` (${say('hotel.reviews', { n: row.reviewCount.toLocaleString(language()) })})` : ''))
      if (row.stars > 0) meta.push(h('span', { key: 's' }, say('hotel.stars', { n: Math.min(5, Math.round(row.stars)) })))
      if (row.location) meta.push(h('span', { key: 'l' }, row.location))
      return h('div', { className: 'pwdsh-card' },
        row.imageUrl
          ? h('img', { className: 'pwdsh-photo', src: row.imageUrl, alt: '', loading: 'lazy', referrerPolicy: 'no-referrer', onError: (event) => { event.currentTarget.style.visibility = 'hidden' } })
          : h('div', { className: 'pwdsh-photo' }),
        h('div', null,
          h(Link, { href: link, className: 'pwdsh-name' }, row.name),
          meta.length > 0 ? h('div', { className: 'pwdsh-meta' }, meta) : null,
          row.direct ? h('span', { className: 'pwdsh-direct' }, say('hotel.direct')) : null,
        ),
        main
          ? h('div', { className: 'pwdsh-price' },
              h('div', { className: 'pwdsh-amount' }, (main.indicative ? '~' : '') + money(main.price, main.currency)),
              h('div', { className: 'pwdsh-per' }, nights === 1 ? say('hotel.night') : say('hotel.nights', { n: nights })),
              nights > 1 ? h('div', { className: 'pwdsh-per' }, say('hotel.perNight', { amount: money(main.price / nights, main.currency) })) : null,
              h('div', { className: 'pwdsh-per' }, main.indicative ? say('hotel.estimate') : say('hotel.on', { source: sourceName(main.source, say) })),
            )
          : h('div'),
        row.offers.length > 1
          ? h('div', { className: 'pwdsh-offers' }, row.offers.map((offer) =>
              h(Link, {
                key: offer.source,
                href: offer.url,
                className: `pwdsh-offer${offer === bestPrice ? ' pwdsh-best' : ''}`,
              }, h('span', null, sourceName(offer.source, say)), h('strong', null, (offer.indicative ? '~' : '') + money(offer.price, offer.currency)))))
          : null,
      )
    }

    function HotelView(props) {
      const say = useText(props.t)
      const [open, setOpen] = React.useState(false)
      const title = say('hotel.title')
      const meta = props.phase === 'result' && !props.block.isError ? props.block.meta : undefined
      if (meta?.kind !== 'hotels' || meta.version !== 1 || meta.rows.length === 0) {
        if (meta?.kind === 'hotels' && meta.status !== 'completed' && !props.block.isError) {
          return h(Shell, { title, subtitle: subtitleOfStay(meta), status: say('status.started') })
        }
        return h(Pending, { props, title, say })
      }
      const rows = open ? meta.rows : meta.rows.slice(0, FIRST_HOTELS)
      const hasDirect = meta.rows.some((row) => row.direct)
      return h(Shell, {
        title,
        subtitle: [subtitleOfStay(meta), meta.totalHotels > 0 ? say('hotel.found', { n: meta.totalHotels }) : ''].filter(Boolean).join(' · '),
        status: meta.status === 'completed' ? '' : say('status.more'),
      },
        h('div', { className: 'pwdsh-list' }, rows.map((row, index) => h(HotelCard, { key: `${index}:${row.name}`, row, nights: meta.nights, say }))),
        h('div', { className: 'pwdsh-foot' },
          h('span', null, say('hotel.note'), hasDirect ? ` ${say('hotel.directAsk')}` : '',
            meta.hasMore ? ` ${say('list.page', { from: meta.offset + 1, to: meta.offset + meta.rows.filter((row) => row.sourceCount > 0).length })}` : ''),
          h(Toggle, { shown: FIRST_HOTELS, total: meta.rows.length, open, setOpen, say }),
        ),
      )
    }
    function subtitleOfStay(meta) {
      return [meta.city, meta.checkIn && meta.checkOut ? `${day(meta.checkIn)} – ${day(meta.checkOut)}` : ''].filter(Boolean).join(' · ')
    }

    function FlightRow({ flight, adults, say }) {
      const stops = flight.stops === 0 ? say('flight.nonstop') : flight.stops === 1 ? say('flight.stop') : say('flight.stops', { n: flight.stops })
      const best = flight.offers[0]
      return h('div', { className: 'pwdsh-flight' },
        h('div', null,
          h('div', { className: 'pwdsh-times' }, `${flight.departTime} → ${flight.arriveTime}`, flight.arriveDate && flight.arriveDate !== flight.departDate ? ' +1' : ''),
          h('div', { className: 'pwdsh-meta' },
            h('span', null, [flight.airline, `${flight.airlineCode}${flight.flightNumber}`].filter(Boolean).join(' ')),
            h('span', null, `${flight.from}–${flight.to}`),
            flight.duration > 0 ? h('span', null, duration(flight.duration)) : null,
            h('span', null, stops, flight.stopCities.length > 0 ? ` (${flight.stopCities.join(', ')})` : ''),
          ),
        ),
        h('div', { className: 'pwdsh-price' },
          h(Link, { href: flight.url, className: 'pwdsh-name' }, h('span', { className: 'pwdsh-amount' }, money(flight.price, flight.currency))),
          h('div', { className: 'pwdsh-per' }, adults > 1 ? say('flight.party', { n: adults }) : say('flight.via', { agent: flight.agent })),
        ),
        flight.offers.length > 1
          ? h('div', { className: 'pwdsh-offers' }, flight.offers.map((offer, index) =>
              h(Link, { key: `${index}:${offer.agent}`, href: offer.url, className: `pwdsh-offer${offer === best ? ' pwdsh-best' : ''}` },
                h('span', null, offer.agent), h('strong', null, money(offer.price, offer.currency)))))
          : null,
      )
    }

    function FlightView(props) {
      const say = useText(props.t)
      const [open, setOpen] = React.useState(false)
      const title = say('flight.title')
      const meta = props.phase === 'result' && !props.block.isError ? props.block.meta : undefined
      const legs = meta?.kind === 'flights' && meta.version === 1 ? [['outbound', meta.outbound], ['return', meta.return]].filter(([, flights]) => flights.length > 0) : []
      const route = meta?.kind === 'flights' ? `${meta.origin} → ${meta.destination} · ${day(meta.departureDate)}${meta.returnDate ? ` – ${day(meta.returnDate)}` : ''}` : ''
      if (legs.length === 0) {
        if (meta?.kind === 'flights' && meta.status !== 'completed') return h(Shell, { title, subtitle: route, status: say('status.started') })
        return h(Pending, { props, title, say })
      }
      const total = meta.totalOutbound + meta.totalReturn
      const longest = Math.max(...legs.map(([, flights]) => flights.length))
      return h(Shell, {
        title,
        subtitle: [route, total > 0 ? say('flight.fares', { n: total }) : ''].filter(Boolean).join(' · '),
        status: meta.status === 'completed' ? '' : say('status.more'),
      },
        legs.map(([leg, flights]) => h(React.Fragment, { key: leg },
          legs.length > 1 ? h('div', { className: 'pwdsh-leg' }, say(leg === 'return' ? 'flight.return' : 'flight.outbound')) : null,
          (open ? flights : flights.slice(0, FIRST_FLIGHTS)).map((flight, index) =>
            h(FlightRow, { key: `${index}:${flight.airlineCode}${flight.flightNumber}`, flight, adults: meta.adults, say })),
        )),
        h('div', { className: 'pwdsh-foot' },
          h('span', null, say('flight.note')),
          h(Toggle, { shown: FIRST_FLIGHTS, total: longest, open, setOpen, say }),
        ),
      )
    }

    module.exports.inject = ['slots', 'locale']
    module.exports.apply = function apply(ctx) {
      ctx.effect(() => ctx.locale.register(NS, { en, zh }), 'pricewin-dsh: dictionaries')
      ctx.effect(ensureStyle, 'pricewin-dsh: card styles')
      ctx.slots.inject('tool.call.toolview', function* () {
        for (const tool of HOTEL_TOOLS) {
          yield ctx.slots.register({ name: 'tool.call.toolview', key: `mcp__${SERVER}__${tool}`, locale: NS }, HotelView)
        }
        for (const tool of FLIGHT_TOOLS) {
          yield ctx.slots.register({ name: 'tool.call.toolview', key: `mcp__${SERVER}__${tool}`, locale: NS }, FlightView)
        }
      })
    }
    return module.exports
  },
})
