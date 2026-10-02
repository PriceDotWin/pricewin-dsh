# PriceWin for DeepSeek Harness

Live hotel and flight prices compared across Booking.com, Agoda, Trip.com and
Traveloka, in USD, from inside [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness).
This is a DSH plugin bundle; its `cordis.patch.yml` adds two entries to the
profile:

- **`pricewin-mcp`**: `@deepseek-ai/dsh-mcp-client` connected to the PriceWin MCP
  server, `https://mcp.price.win/mcp` (Streamable HTTP, no account, no API key);
- **`pricewin-skills`**: a `@deepseek-ai/dsh-skill-filesystem` provider that
  serves only this package's `skills/pricewin-travel-search`: how to run a
  search (results arrive in two steps), what to ask when the trip details are
  incomplete, and how to read prices and links.

The package contains no code of its own.

## Install

```bash
dsh plugin --profile web add @pricewin/dsh
```

or from GitHub:

```bash
dsh plugin --profile web add github:PriceDotWin/pricewin-dsh
```

Use the name of your profile in place of `web`. You can also add it from the
**Plugins** page in the Web sidebar. Then ask, for example:

> Compare hotel prices in Da Nang for 2 adults from November 10 to 12.

The tools appear as `mcp__pricewin__<tool>`.

Tested with DSH 0.2.0-rc.2 (`dsh --profile headless`). DSH is a preview and its
configuration format still changes; if a newer version refuses the bundle,
please open an issue.

## Tools

| Tool | What it does |
|---|---|
| `search_hotels_live`, `poll_search_results` | Search a city's hotels across the OTAs and OpenTravel partner hotels; results arrive in two steps |
| `search_flights_live`, `poll_flight_results` | Search one-way or per-leg round-trip fares |
| `get_ota_hotel_detail` | Rooms, live prices, facilities and reviews for one named hotel (Booking.com) |
| `get_hotel_detail`, `get_hotel_info` | Rooms and prices, or facilities and policies, of an OpenTravel partner hotel |
| `get_cancellation_policy` | Refund terms for one rate |
| `request_booking`, `check_booking_status` | Send a booking request to a partner hotel and read its status |
| `request_cancel_token`, `cancel_booking` | Cancel such a booking, in two steps |

**Booking takes no money.** `request_booking` sends the guest's name, phone and
email to the hotel, which confirms the request; no room is held and the guest
pays at the property. Cancelling needs a single-use token that is emailed to the
address on the booking, so nothing is cancelled without the guest's own inbox.

## What the bundle sends, and where

DSH talks to one remote MCP server, `https://mcp.price.win/mcp`.

- **To `mcp.price.win`**: the arguments of each tool call, which are trip details
  (city, dates, party size, hotel name, price range, airports, cabin), a short
  excerpt of the request used only to pick the reply language, and, for a
  booking request, the guest's name, phone number and email.
- **Onward from PriceWin's server**: only to PriceWin's own backend and to
  OpenTravel's API (`api.travelopen.ai`), which the PriceWin developer also owns.
  A booking request's name, phone and email go to the partner hotel through
  OpenTravel, so the hotel can confirm it.
- **Usage analytics**: PriceWin records trip parameters only (city, dates,
  party size, hotel name, currency), never a guest's name, email, phone,
  confirmation code or cancel token.
- **Where prices come from**: PriceWin's backend reads Booking.com, Agoda,
  Traveloka, Trip.com and Google Flights from their public pages at search time.
  PriceWin has no partnership with those sites. Each result is labelled with its
  source and links to it for booking. Prices are time-sensitive.

No payment data is ever requested. See the
[privacy policy](https://www.price.win/en/privacy-policy) and
[terms of service](https://www.price.win/en/terms-of-service).

The same server and skill are packaged for Claude Code, Codex CLI, Antigravity
and OpenCode in
[pricewin-agent-plugin](https://github.com/PriceDotWin/pricewin-agent-plugin),
and for Pi in [pricewin-pi](https://github.com/PriceDotWin/pricewin-pi).

## Support

[mcp.price.win/support](https://mcp.price.win/support) · support@price.win ·
[tool reference](https://mcp.price.win/docs)

## License

MIT
