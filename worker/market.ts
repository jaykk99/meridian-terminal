/**
 * Simulated market data engine.
 *
 * Prices are generated deterministically from a symbol seed and wall-clock time
 * using layered value noise, so every client, candle and quote agrees without a
 * price feed or database. This is a paper-trading simulator: no order ever
 * reaches a real venue.
 */

export type AssetClass = 'Crypto' | 'Equities' | 'Forex' | 'Indices' | 'Commodities' | 'ETFs';

export interface MarketDef {
  symbol: string;
  name: string;
  assetClass: AssetClass;
  base: number;
  vol: number;
  drift: number;
}

export interface Quote {
  symbol: string;
  name: string;
  assetClass: AssetClass;
  price: number;
  change24h: number;
  high24h: number;
  low24h: number;
  volume: number;
  spark: number[];
}

export interface Candle {
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

type Row = [symbol: string, name: string, base: number, vol?: number, drift?: number];

const RAW: Record<AssetClass, Row[]> = {
  Crypto: [
    ['BTCUSD', 'Bitcoin', 96240, 1.15, 1],
    ['ETHUSD', 'Ethereum', 3412, 1.2, 0.8],
    ['SOLUSD', 'Solana', 196.4, 1.45, 1.1],
    ['XRPUSD', 'XRP', 2.24, 1.3, 0.4],
    ['ADAUSD', 'Cardano', 0.912, 1.3, 0.2],
    ['DOGEUSD', 'Dogecoin', 0.324, 1.6, 0.3],
    ['AVAXUSD', 'Avalanche', 38.2, 1.35, 0.4],
    ['LINKUSD', 'Chainlink', 22.4, 1.3, 0.5],
    ['DOTUSD', 'Polkadot', 7.44, 1.2, 0.1],
    ['LTCUSD', 'Litecoin', 106.8, 1.0, 0.2],
    ['BCHUSD', 'Bitcoin Cash', 486.2, 1.1, 0.2],
    ['ATOMUSD', 'Cosmos', 8.24, 1.2, 0],
    ['NEARUSD', 'NEAR Protocol', 5.68, 1.4, 0.6],
    ['APTUSD', 'Aptos', 9.84, 1.4, 0.3],
    ['ARBUSD', 'Arbitrum', 1.12, 1.5, 0.5],
    ['OPUSD', 'Optimism', 1.94, 1.5, 0.4],
    ['SUIUSD', 'Sui', 3.42, 1.55, 0.9],
    ['TONUSD', 'Toncoin', 5.22, 1.3, 0.2],
    ['TRXUSD', 'TRON', 0.246, 0.9, 0.3],
    ['SHIBUSD', 'Shiba Inu', 0.0000242, 1.7, 0.1],
    ['COOLUSD', 'Sum Cool', 0.42, 1.4, 3.2],
    ['PEPEUSD', 'Pepe', 0.0000184, 1.8, 0.4],
    ['WIFUSD', 'dogwifhat', 2.84, 1.8, 0.6],
    ['BONKUSD', 'Bonk', 0.0000312, 1.9, 0.5],
    ['FLOKIUSD', 'Floki', 0.000214, 1.7, 0.3],
    ['INJUSD', 'Injective', 24.6, 1.5, 0.5],
    ['SEIUSD', 'Sei', 0.42, 1.5, 0.4],
    ['TIAUSD', 'Celestia', 6.24, 1.5, 0.3],
    ['JUPUSD', 'Jupiter', 1.08, 1.5, 0.5],
    ['PYTHUSD', 'Pyth Network', 0.38, 1.6, 0.3],
    ['STRKUSD', 'Starknet', 0.54, 1.6, 0.2],
    ['WLDUSD', 'Worldcoin', 2.34, 1.7, 0.4],
    ['RENDERUSD', 'Render', 7.42, 1.5, 0.6],
    ['FETUSD', 'Artificial Superintelligence', 1.46, 1.6, 0.5],
    ['TAOUSD', 'Bittensor', 486.2, 1.6, 1.1],
    ['KASUSD', 'Kaspa', 0.142, 1.4, 0.4],
    ['XLMUSD', 'Stellar', 0.428, 1.1, 0.2],
    ['ALGOUSD', 'Algorand', 0.242, 1.3, 0.1],
    ['HBARUSD', 'Hedera', 0.286, 1.3, 0.4],
    ['ICPUSD', 'Internet Computer', 10.24, 1.4, 0.2],
    ['FILUSD', 'Filecoin', 5.42, 1.3, 0.1],
    ['AAVEUSD', 'Aave', 186.4, 1.4, 0.6],
    ['MKRUSD', 'Maker', 1682.4, 1.4, 0.5],
    ['UNIUSD', 'Uniswap', 9.84, 1.4, 0.3],
    ['CRVUSD', 'Curve DAO', 0.62, 1.5, 0.1],
    ['LDOUSD', 'Lido DAO', 1.84, 1.5, 0.3],
    ['ENAUSD', 'Ethena', 0.58, 1.7, 0.8],
    ['ONDOUSD', 'Ondo Finance', 1.12, 1.7, 0.9],
    ['JTOUSD', 'Jito', 2.86, 1.6, 0.4],
    ['WUSD', 'Wormhole', 0.32, 1.6, 0.2],
  ],
  Equities: [
    ['AAPL', 'Apple', 232.4, 0.8, 0.6],
    ['MSFT', 'Microsoft', 428.6, 0.8, 0.8],
    ['NVDA', 'NVIDIA', 178.2, 1.5, 1.4],
    ['AMZN', 'Amazon', 205.8, 1.0, 0.7],
    ['GOOGL', 'Alphabet', 186.4, 0.95, 0.5],
    ['META', 'Meta Platforms', 592.2, 1.2, 0.9],
    ['TSLA', 'Tesla', 342.8, 1.6, 0.4],
    ['AMD', 'Advanced Micro Devices', 148.6, 1.4, 0.5],
    ['NFLX', 'Netflix', 821.4, 1.1, 0.7],
    ['JPM', 'JPMorgan Chase', 246.2, 0.8, 0.4],
    ['V', 'Visa', 312.6, 0.7, 0.3],
    ['MA', 'Mastercard', 526.4, 0.7, 0.3],
    ['DIS', 'Walt Disney', 112.8, 0.95, 0.1],
    ['BA', 'Boeing', 178.4, 1.2, -0.2],
    ['XOM', 'Exxon Mobil', 118.6, 0.9, 0.2],
    ['CVX', 'Chevron', 158.2, 0.9, 0.2],
    ['PFE', 'Pfizer', 28.4, 0.9, -0.1],
    ['KO', 'Coca-Cola', 63.2, 0.6, 0.1],
    ['PEP', 'PepsiCo', 168.4, 0.6, 0.1],
    ['COST', 'Costco', 928.6, 0.7, 0.5],
    ['WMT', 'Walmart', 92.4, 0.7, 0.4],
    ['HD', 'Home Depot', 398.2, 0.8, 0.3],
    ['UNH', 'UnitedHealth', 588.4, 0.9, 0.1],
    ['LLY', 'Eli Lilly', 782.6, 1.1, 0.8],
    ['ORCL', 'Oracle', 182.4, 1.0, 0.6],
    ['CRM', 'Salesforce', 336.8, 1.0, 0.4],
    ['ADBE', 'Adobe', 512.2, 1.1, 0.3],
    ['INTC', 'Intel', 26.4, 1.3, -0.4],
    ['MU', 'Micron', 118.6, 1.4, 0.6],
    ['QCOM', 'Qualcomm', 168.2, 1.1, 0.3],
    ['AVGO', 'Broadcom', 172.8, 1.2, 0.9],
    ['PLTR', 'Palantir', 68.4, 1.6, 1.1],
    ['COIN', 'Coinbase', 288.6, 1.7, 0.8],
    ['HOOD', 'Robinhood', 38.2, 1.6, 0.9],
    ['SHOP', 'Shopify', 108.4, 1.3, 0.5],
    ['UBER', 'Uber', 78.6, 1.1, 0.5],
    ['ABNB', 'Airbnb', 138.2, 1.2, 0.2],
    ['SNOW', 'Snowflake', 128.4, 1.4, 0.3],
    ['CRWD', 'CrowdStrike', 348.6, 1.3, 0.7],
    ['PANW', 'Palo Alto Networks', 398.4, 1.2, 0.6],
    ['ABBV', 'AbbVie', 186.4, 0.8, 0.4],
    ['MRK', 'Merck', 98.6, 0.8, 0.1],
    ['TMO', 'Thermo Fisher', 545.2, 0.9, 0.4],
    ['ABT', 'Abbott Laboratories', 118.4, 0.8, 0.2],
    ['DHR', 'Danaher', 246.8, 0.9, 0.3],
    ['AMGN', 'Amgen', 312.4, 0.9, 0.3],
    ['GILD', 'Gilead Sciences', 92.6, 0.9, 0.2],
    ['VRTX', 'Vertex Pharmaceuticals', 468.2, 1.0, 0.4],
    ['REGN', 'Regeneron', 782.4, 1.1, 0.3],
    ['ISRG', 'Intuitive Surgical', 512.6, 1.0, 0.5],
    ['SYK', 'Stryker', 386.2, 0.8, 0.4],
    ['MDT', 'Medtronic', 88.4, 0.8, 0.1],
    ['BMY', 'Bristol-Myers Squibb', 58.2, 0.9, 0.1],
    ['ZTS', 'Zoetis', 176.8, 0.9, 0.2],
    ['GS', 'Goldman Sachs', 528.4, 1.0, 0.5],
    ['MS', 'Morgan Stanley', 128.6, 1.0, 0.4],
    ['BAC', 'Bank of America', 44.2, 1.0, 0.3],
    ['WFC', 'Wells Fargo', 74.8, 0.9, 0.3],
    ['C', 'Citigroup', 68.4, 1.0, 0.2],
    ['SCHW', 'Charles Schwab', 78.6, 0.9, 0.3],
    ['BLK', 'BlackRock', 1042.8, 0.9, 0.5],
    ['AXP', 'American Express', 288.4, 0.9, 0.4],
    ['USB', 'U.S. Bancorp', 48.6, 0.9, 0.2],
    ['PNC', 'PNC Financial', 186.2, 0.9, 0.3],
    ['COF', 'Capital One', 168.4, 1.1, 0.3],
    ['BRKB', 'Berkshire Hathaway B', 468.6, 0.7, 0.4],
    ['SPGI', 'S&P Global', 512.2, 0.8, 0.4],
    ['MCO', "Moody's", 486.4, 0.9, 0.4],
    ['ICE', 'Intercontinental Exchange', 158.6, 0.8, 0.4],
    ['CME', 'CME Group', 232.8, 0.8, 0.4],
    ['CAT', 'Caterpillar', 386.4, 1.0, 0.5],
    ['DE', 'Deere', 428.2, 0.9, 0.4],
    ['HON', 'Honeywell', 218.6, 0.8, 0.3],
    ['GE', 'GE Aerospace', 186.8, 1.0, 0.6],
    ['LMT', 'Lockheed Martin', 528.4, 0.8, 0.3],
    ['RTX', 'RTX Corp', 122.6, 0.8, 0.3],
    ['NOC', 'Northrop Grumman', 512.8, 0.8, 0.2],
    ['GD', 'General Dynamics', 286.4, 0.8, 0.3],
    ['EMR', 'Emerson Electric', 118.2, 0.9, 0.3],
    ['ETN', 'Eaton', 342.6, 0.9, 0.5],
    ['ITW', 'Illinois Tool Works', 268.4, 0.8, 0.3],
    ['PH', 'Parker Hannifin', 612.2, 0.9, 0.4],
    ['UNP', 'Union Pacific', 236.8, 0.8, 0.3],
    ['CSX', 'CSX', 34.2, 0.8, 0.2],
    ['NSC', 'Norfolk Southern', 248.6, 0.8, 0.2],
    ['FDX', 'FedEx', 286.4, 1.0, 0.3],
    ['UPS', 'UPS', 128.2, 0.9, 0.1],
    ['MMM', '3M', 128.6, 0.9, 0.1],
    ['MCD', "McDonald's", 292.4, 0.7, 0.4],
    ['SBUX', 'Starbucks', 98.2, 0.9, 0.2],
    ['NKE', 'Nike', 78.6, 1.0, 0.1],
    ['TGT', 'Target', 148.4, 0.9, 0.2],
    ['LOW', "Lowe's", 268.2, 0.9, 0.3],
    ['TJX', 'TJX Companies', 118.6, 0.8, 0.4],
    ['LULU', 'Lululemon', 312.4, 1.2, 0.2],
    ['MAR', 'Marriott', 278.6, 0.9, 0.4],
    ['HLT', 'Hilton', 238.4, 0.9, 0.4],
    ['CMG', 'Chipotle', 58.2, 1.1, 0.2],
    ['YUM', 'Yum! Brands', 138.6, 0.8, 0.3],
    ['KHC', 'Kraft Heinz', 32.4, 0.8, 0.1],
    ['GIS', 'General Mills', 68.2, 0.7, 0.1],
    ['HSY', 'Hershey', 178.4, 0.8, 0.1],
    ['MDLZ', 'Mondelez', 68.6, 0.7, 0.2],
    ['STZ', 'Constellation Brands', 238.2, 0.8, 0.2],
    ['MO', 'Altria', 52.4, 0.7, 0.2],
    ['PM', 'Philip Morris', 128.6, 0.7, 0.4],
    ['EL', 'Estée Lauder', 88.4, 1.1, 0.1],
    ['CL', 'Colgate-Palmolive', 98.6, 0.6, 0.2],
    ['PG', 'Procter & Gamble', 172.4, 0.6, 0.3],
    ['KMB', 'Kimberly-Clark', 138.2, 0.6, 0.2],
    ['T', 'AT&T', 22.4, 0.7, 0.2],
    ['VZ', 'Verizon', 42.6, 0.6, 0.1],
    ['TMUS', 'T-Mobile', 228.4, 0.8, 0.4],
    ['CMCSA', 'Comcast', 42.2, 0.9, 0.1],
    ['CHTR', 'Charter Communications', 368.6, 0.9, 0.2],
    ['EA', 'Electronic Arts', 148.2, 0.9, 0.2],
    ['RBLX', 'Roblox', 48.6, 1.5, 0.4],
    ['SPOT', 'Spotify', 468.4, 1.2, 0.7],
    ['PINS', 'Pinterest', 32.8, 1.4, 0.3],
    ['SNAP', 'Snap', 12.4, 1.6, -0.3],
    ['DASH', 'DoorDash', 168.2, 1.3, 0.5],
    ['NET', 'Cloudflare', 88.6, 1.6, 0.5],
    ['DDOG', 'Datadog', 128.4, 1.5, 0.5],
    ['ZS', 'Zscaler', 208.6, 1.5, 0.4],
    ['OKTA', 'Okta', 82.4, 1.5, 0.1],
    ['MDB', 'MongoDB', 312.8, 1.5, 0.4],
    ['TEAM', 'Atlassian', 248.2, 1.3, 0.4],
    ['WDAY', 'Workday', 268.4, 1.2, 0.4],
    ['NOW', 'ServiceNow', 928.6, 1.1, 0.6],
    ['INTU', 'Intuit', 682.4, 1.1, 0.5],
    ['OXY', 'Occidental Petroleum', 52.6, 1.1, 0.1],
    ['PSX', 'Phillips 66', 128.4, 1.0, 0.2],
    ['MPC', 'Marathon Petroleum', 168.2, 1.0, 0.3],
    ['VLO', 'Valero Energy', 148.6, 1.0, 0.3],
    ['SLB', 'SLB', 44.2, 1.1, 0.1],
    ['HAL', 'Halliburton', 32.4, 1.2, 0.1],
    ['EOG', 'EOG Resources', 128.8, 1.0, 0.3],
    ['KMI', 'Kinder Morgan', 26.4, 0.8, 0.2],
    ['WMB', 'Williams Companies', 52.2, 0.9, 0.3],
    ['OKE', 'ONEOK', 102.6, 0.9, 0.4],
    ['LIN', 'Linde', 458.2, 0.8, 0.4],
    ['APD', 'Air Products', 308.4, 0.8, 0.2],
    ['SHW', 'Sherwin-Williams', 368.6, 0.9, 0.3],
    ['FCX', 'Freeport-McMoRan', 42.8, 1.2, 0.3],
    ['NEM', 'Newmont', 52.4, 1.1, 0.3],
    ['DOW', 'Dow', 42.6, 1.0, 0.1],
    ['DD', 'DuPont', 78.4, 1.0, 0.1],
    ['ALB', 'Albemarle', 98.2, 1.5, 0.2],
    ['AMT', 'American Tower', 208.6, 0.8, 0.2],
    ['PLD', 'Prologis', 118.4, 0.8, 0.2],
    ['CCI', 'Crown Castle', 108.6, 0.9, 0.1],
    ['EQIX', 'Equinix', 928.4, 0.8, 0.4],
    ['SPG', 'Simon Property', 168.2, 0.9, 0.2],
    ['VICI', 'VICI Properties', 32.6, 0.7, 0.3],
    ['GM', 'General Motors', 52.4, 1.1, 0.2],
    ['F', 'Ford', 11.2, 1.1, 0.1],
    ['RIVN', 'Rivian', 13.4, 1.8, 0.1],
    ['LCID', 'Lucid Group', 3.24, 1.9, 0],
    ['NIO', 'NIO', 6.42, 1.7, 0.1],
    ['XPEV', 'XPeng', 12.6, 1.7, 0.2],
    ['LI', 'Li Auto', 26.4, 1.5, 0.2],
    ['ASML', 'ASML Holding', 742.6, 1.2, 0.6],
    ['TSM', 'Taiwan Semiconductor', 198.4, 1.2, 0.7],
    ['ARM', 'Arm Holdings', 142.6, 1.6, 0.8],
    ['MRVL', 'Marvell Technology', 88.4, 1.4, 0.5],
    ['ON', 'ON Semiconductor', 68.2, 1.4, 0.2],
    ['TXN', 'Texas Instruments', 198.6, 0.9, 0.3],
    ['ADI', 'Analog Devices', 228.4, 0.9, 0.4],
    ['NXPI', 'NXP Semiconductors', 232.6, 1.1, 0.3],
    ['SWKS', 'Skyworks Solutions', 88.2, 1.3, 0.1],
    ['LRCX', 'Lam Research', 88.6, 1.3, 0.6],
    ['AMAT', 'Applied Materials', 178.4, 1.3, 0.5],
    ['KLAC', 'KLA Corp', 728.2, 1.2, 0.6],
  ],
  Forex: [
    ['EURUSD', 'Euro / US Dollar', 1.0842, 0.8],
    ['GBPUSD', 'British Pound / US Dollar', 1.2684, 0.9],
    ['USDJPY', 'US Dollar / Japanese Yen', 154.28, 0.9],
    ['USDCHF', 'US Dollar / Swiss Franc', 0.8824, 0.8],
    ['AUDUSD', 'Australian Dollar / US Dollar', 0.6582, 0.9],
    ['USDCAD', 'US Dollar / Canadian Dollar', 1.3724, 0.8],
    ['NZDUSD', 'New Zealand Dollar / US Dollar', 0.5984, 0.9],
    ['EURGBP', 'Euro / British Pound', 0.8536, 0.7],
    ['EURJPY', 'Euro / Japanese Yen', 166.84, 0.9],
    ['GBPJPY', 'British Pound / Japanese Yen', 195.42, 1.0],
    ['USDMXN', 'US Dollar / Mexican Peso', 17.24, 1.0],
    ['USDZAR', 'US Dollar / South African Rand', 18.42, 1.1],
    ['USDSEK', 'US Dollar / Swedish Krona', 10.62, 0.9],
    ['USDNOK', 'US Dollar / Norwegian Krone', 10.84, 1.0],
    ['USDINR', 'US Dollar / Indian Rupee', 83.62, 0.6],
    ['USDSGD', 'US Dollar / Singapore Dollar', 1.3424, 0.6],
    ['EURCHF', 'Euro / Swiss Franc', 0.9424, 0.6],
    ['EURCAD', 'Euro / Canadian Dollar', 1.4826, 0.7],
    ['EURAUD', 'Euro / Australian Dollar', 1.6482, 0.7],
    ['EURNZD', 'Euro / New Zealand Dollar', 1.8124, 0.7],
    ['GBPAUD', 'British Pound / Australian Dollar', 1.9286, 0.8],
    ['GBPCAD', 'British Pound / Canadian Dollar', 1.7384, 0.7],
    ['GBPCHF', 'British Pound / Swiss Franc', 1.1182, 0.7],
    ['GBPNZD', 'British Pound / New Zealand Dollar', 2.1224, 0.8],
    ['AUDCAD', 'Australian Dollar / Canadian Dollar', 0.9042, 0.6],
    ['AUDCHF', 'Australian Dollar / Swiss Franc', 0.5824, 0.6],
    ['AUDJPY', 'Australian Dollar / Japanese Yen', 101.62, 0.7],
    ['CADCHF', 'Canadian Dollar / Swiss Franc', 0.6424, 0.6],
    ['CADJPY', 'Canadian Dollar / Japanese Yen', 112.42, 0.7],
    ['CHFJPY', 'Swiss Franc / Japanese Yen', 174.86, 0.7],
    ['NZDJPY', 'New Zealand Dollar / Japanese Yen', 92.42, 0.8],
    ['USDTRY', 'US Dollar / Turkish Lira', 34.24, 1.2],
    ['USDCNH', 'US Dollar / Offshore Yuan', 7.284, 0.7],
    ['USDKRW', 'US Dollar / Korean Won', 1382.4, 0.8],
  ],
  Indices: [
    ['SPX', 'S&P 500', 5982.4, 0.9, 0.5],
    ['NDX', 'Nasdaq 100', 21142.6, 1.1, 0.8],
    ['DJI', 'Dow Jones 30', 43924.8, 0.8, 0.4],
    ['RUT', 'Russell 2000', 2342.6, 1.0, 0.2],
    ['DAX', 'DAX 40', 19426.4, 0.9, 0.4],
    ['FTSE', 'FTSE 100', 8264.2, 0.8, 0.2],
    ['NIKKEI', 'Nikkei 225', 39248.6, 1.0, 0.5],
    ['HSI', 'Hang Seng', 19842.4, 1.1, 0.1],
    ['CAC', 'CAC 40', 7482.6, 0.9, 0.2],
    ['STOXX', 'Euro Stoxx 50', 5024.8, 0.9, 0.3],
    ['ASX', 'ASX 200', 8324.6, 0.8, 0.3],
    ['SMI', 'Swiss Market Index', 11842.6, 0.8, 0.3],
    ['IBEX', 'IBEX 35', 11624.4, 0.9, 0.3],
    ['AEX', 'AEX 25', 892.6, 0.8, 0.3],
    ['OMXS', 'OMX Stockholm 30', 2482.4, 0.8, 0.2],
    ['KOSPI', 'KOSPI', 2684.6, 0.9, 0.1],
    ['TWSE', 'Taiwan TAIEX', 22842.4, 1.0, 0.5],
    ['SENSEX', 'BSE Sensex', 78642.8, 0.9, 0.4],
    ['IPC', 'IPC Mexico', 52418.6, 1.0, 0.1],
    ['VIX', 'CBOE Volatility Index', 15.24, 1.8, -0.2],
  ],
  Commodities: [
    ['XAUUSD', 'Gold', 2684.2, 0.9, 0.6],
    ['XAGUSD', 'Silver', 31.42, 1.1, 0.4],
    ['WTI', 'WTI Crude', 72.42, 1.1, 0.1],
    ['BRENT', 'Brent Crude', 76.24, 1.0, 0.1],
    ['NG', 'Natural Gas', 3.12, 1.4, -0.2],
    ['COPPER', 'Copper', 4.284, 0.9, 0.3],
    ['PLATINUM', 'Platinum', 986.4, 1.0, 0.2],
    ['COFFEE', 'Coffee', 312.6, 1.3, 0.5],
    ['COCOA', 'Cocoa', 8214.0, 1.4, 0.6],
    ['WHEAT', 'Wheat', 568.4, 1.0, 0],
    ['CORN', 'Corn', 428.6, 0.9, 0.1],
    ['SUGAR', 'Sugar', 21.42, 1.0, 0.1],
    ['ALUMINUM', 'Aluminum', 2484.2, 0.8, 0.2],
    ['NICKEL', 'Nickel', 16424.6, 1.0, 0.1],
    ['ZINC', 'Zinc', 2842.4, 0.8, 0.1],
    ['IRONORE', 'Iron Ore', 118.6, 0.9, 0],
    ['LUMBER', 'Lumber', 568.4, 1.1, 0.1],
    ['COTTON', 'Cotton', 72.42, 1.0, 0.1],
    ['ORANGEJUICE', 'Orange Juice', 468.2, 1.4, 0.6],
    ['LEANHOGS', 'Lean Hogs', 82.46, 1.2, 0.1],
    ['CATTLE', 'Live Cattle', 186.4, 0.8, 0.3],
    ['COBALT', 'Cobalt', 24.84, 1.3, 0.3],
    ['URANIUM', 'Uranium', 82.46, 1.2, 0.6],
  ],
  ETFs: [
    ['SPY', 'SPDR S&P 500 ETF', 596.4, 0.9, 0.5],
    ['QQQ', 'Invesco QQQ Trust', 512.6, 1.0, 0.8],
    ['IWM', 'iShares Russell 2000', 232.4, 1.0, 0.2],
    ['DIA', 'SPDR Dow Jones ETF', 438.6, 0.8, 0.4],
    ['GLD', 'SPDR Gold Shares', 246.8, 0.9, 0.6],
    ['SLV', 'iShares Silver Trust', 30.24, 1.1, 0.4],
    ['TLT', 'iShares 20+ Year Treasury', 92.42, 0.8, -0.2],
    ['HYG', 'iShares High Yield Bond', 78.64, 0.5, 0.1],
    ['EEM', 'iShares Emerging Markets', 44.28, 0.9, 0.1],
    ['ARKK', 'ARK Innovation ETF', 52.46, 1.5, 0.3],
    ['XLE', 'Energy Select Sector', 92.84, 1.0, 0.2],
    ['XLF', 'Financial Select Sector', 46.28, 0.8, 0.4],
    ['SMH', 'VanEck Semiconductor', 248.6, 1.3, 0.9],
    ['VTI', 'Vanguard Total Market', 292.4, 0.9, 0.5],
    ['VOO', 'Vanguard S&P 500', 548.6, 0.9, 0.5],
    ['IVV', 'iShares Core S&P 500', 602.4, 0.9, 0.5],
    ['VUG', 'Vanguard Growth', 388.2, 1.1, 0.7],
    ['VTV', 'Vanguard Value', 178.4, 0.8, 0.3],
    ['VYM', 'Vanguard High Dividend', 132.6, 0.7, 0.3],
    ['SCHD', 'Schwab US Dividend Equity', 28.42, 0.7, 0.3],
    ['JEPI', 'JPMorgan Equity Premium', 58.24, 0.7, 0.3],
    ['SOXL', 'Direxion Semiconductor Bull 3x', 42.68, 2.2, 0.6],
    ['TQQQ', 'ProShares UltraPro QQQ', 62.42, 2.0, 0.7],
    ['SQQQ', 'ProShares UltraPro Short QQQ', 8.246, 2.0, -0.7],
    ['XBI', 'SPDR Biotech', 98.42, 1.3, 0.2],
    ['XLV', 'Health Care Select Sector', 148.6, 0.8, 0.3],
    ['XLU', 'Utilities Select Sector', 82.46, 0.7, 0.2],
    ['XLP', 'Consumer Staples Select', 78.64, 0.6, 0.2],
    ['XLY', 'Consumer Discretionary Select', 192.4, 1.0, 0.3],
    ['XLI', 'Industrials Select Sector', 138.2, 0.9, 0.4],
    ['XLB', 'Materials Select Sector', 92.46, 0.9, 0.2],
    ['XLK', 'Technology Select Sector', 232.4, 1.1, 0.6],
    ['XLC', 'Communication Services Select', 98.24, 0.9, 0.4],
    ['XRE', 'REITs Select Sector', 88.42, 0.8, 0.1],
    ['GDX', 'VanEck Gold Miners', 38.64, 1.3, 0.4],
    ['USO', 'United States Oil Fund', 72.46, 1.2, 0.1],
    ['TIP', 'iShares TIPS Bond', 108.24, 0.5, 0.1],
    ['BND', 'Vanguard Total Bond Market', 72.64, 0.4, 0.1],
    ['AGG', 'iShares Core US Aggregate Bond', 98.42, 0.4, 0.1],
    ['LQD', 'iShares Investment Grade Credit', 108.46, 0.5, 0.1],
    ['EMB', 'iShares Emerging Markets Bond', 88.24, 0.7, 0.1],
    ['EWJ', 'iShares Japan', 68.46, 0.8, 0.2],
    ['FXI', 'iShares China Large-Cap', 28.42, 1.1, 0.1],
    ['INDA', 'iShares India', 48.62, 0.9, 0.3],
    ['EWT', 'iShares Taiwan', 52.48, 1.1, 0.4],
    ['EWZ', 'iShares Brazil', 28.24, 1.3, 0.1],
  ],
};

const CLASS_VOL: Record<AssetClass, number> = {
  Crypto: 1,
  Equities: 0.42,
  Forex: 0.085,
  Indices: 0.26,
  Commodities: 0.45,
  ETFs: 0.3,
};

export const CLASS_LEVERAGE: Record<AssetClass, number> = {
  Crypto: 20,
  Equities: 5,
  Forex: 20,
  Indices: 15,
  Commodities: 10,
  ETFs: 5,
};

export const ASSET_CLASSES: AssetClass[] = [
  'Crypto',
  'Equities',
  'Forex',
  'Indices',
  'Commodities',
  'ETFs',
];

function build(): MarketDef[] {
  const out: MarketDef[] = [];
  for (const assetClass of ASSET_CLASSES) {
    for (const [symbol, name, base, vol, drift] of RAW[assetClass]) {
      out.push({ symbol, name, assetClass, base, vol: vol ?? 1, drift: drift ?? 0 });
    }
  }
  return out;
}

const DEFS = build();
const BY_SYMBOL = new Map(DEFS.map((d) => [d.symbol, d]));

export function listSymbols(): MarketDef[] {
  return DEFS;
}

export function getDef(symbol: string): MarketDef | undefined {
  return BY_SYMBOL.get(symbol.toUpperCase());
}

/* ------------------------------------------------------------------ noise */

const DAY = 86_400_000;
const MIN = 60_000;
/** Drift is anchored here so prices do not compound from the Unix epoch. */
const DRIFT_ORIGIN = Date.UTC(2024, 0, 1);

function frac(n: number): number {
  const x = Math.sin(n * 12.9898) * 43758.5453123;
  return x - Math.floor(x);
}

function smoothNoise(seed: number, x: number): number {
  const i = Math.floor(x);
  const f = x - i;
  const u = f * f * (3 - 2 * f);
  const a = frac(seed + i * 1.618);
  const b = frac(seed + (i + 1) * 1.618);
  return a + (b - a) * u;
}

function fbm(seed: number, x: number, octaves: number): number {
  let amp = 0.5;
  let freq = 1;
  let sum = 0;
  let norm = 0;
  for (let o = 0; o < octaves; o++) {
    sum += amp * (smoothNoise(seed + o * 37.13, x * freq) - 0.5);
    norm += amp;
    amp *= 0.5;
    freq *= 2.13;
  }
  return sum / norm;
}

function seedOf(symbol: string): number {
  let h = 2166136261;
  for (let i = 0; i < symbol.length; i++) {
    h ^= symbol.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) % 100000;
}

/** Deterministic price for a symbol at a point in time. */
export function priceAt(def: MarketDef, t: number = Date.now()): number {
  const seed = seedOf(def.symbol);
  const cls = CLASS_VOL[def.assetClass];
  const wave =
    0.6 * fbm(seed, t / (DAY * 2.2), 4) +
    0.28 * fbm(seed + 91, t / (DAY * 0.35), 3) +
    0.12 * fbm(seed + 197, t / (MIN * 150), 3);
  const jitter = (frac(seed + Math.floor(t / 4000) * 3.77) - 0.5) * 0.0012;
  const trend =
    Math.sin(t / (DAY * 47) + seed) * 0.012 +
    def.drift * ((t - DRIFT_ORIGIN) / DAY) * 0.00005;
  const logP = Math.log(def.base) + (wave * 0.17 + jitter) * cls * def.vol + trend;
  return Math.exp(logP);
}

export function decimalsFor(def: MarketDef): number {
  const p = def.base;
  if (def.assetClass === 'Forex') return p >= 20 ? 3 : 5;
  if (p >= 1) return 2;
  if (p >= 0.01) return 4;
  return 7;
}

export function roundPrice(def: MarketDef, p: number): number {
  const f = 10 ** decimalsFor(def);
  return Math.round(p * f) / f;
}

export function spreadPrice(symbol: string, t: number = Date.now()): number {
  const def = getDef(symbol);
  return def ? roundPrice(def, priceAt(def, t)) : 0;
}

/* ----------------------------------------------------------------- quotes */

export function sparkline(def: MarketDef, points = 24, now = Date.now()): number[] {
  const step = MIN * 60;
  const out: number[] = [];
  for (let i = points - 1; i >= 0; i--) {
    out.push(roundPrice(def, priceAt(def, now - i * step)));
  }
  return out;
}

export function quoteFor(def: MarketDef, now = Date.now(), sparkPoints = 24): Quote {
  const price = priceAt(def, now);
  const prev = priceAt(def, now - DAY);
  let high = -Infinity;
  let low = Infinity;
  for (let i = 0; i <= 24; i++) {
    const p = priceAt(def, now - i * (DAY / 24));
    if (p > high) high = p;
    if (p < low) low = p;
  }
  const seed = seedOf(def.symbol);
  const dayIndex = Math.floor(now / DAY);
  const volume =
    Math.round(def.base * (2400 + frac(seed + dayIndex) * 4200) * CLASS_VOL[def.assetClass] * 10) /
    10;
  return {
    symbol: def.symbol,
    name: def.name,
    assetClass: def.assetClass,
    price: roundPrice(def, price),
    change24h: ((price - prev) / prev) * 100,
    high24h: roundPrice(def, high),
    low24h: roundPrice(def, low),
    volume,
    spark: sparkline(def, sparkPoints, now),
  };
}

/* ---------------------------------------------------------------- candles */

export const INTERVALS: Record<string, number> = {
  '1m': MIN,
  '5m': MIN * 5,
  '15m': MIN * 15,
  '1h': MIN * 60,
  '4h': MIN * 240,
  '1d': DAY,
};

export function candlesFor(
  def: MarketDef,
  interval: string,
  limit: number,
  now = Date.now(),
): Candle[] {
  const step = INTERVALS[interval] ?? MIN * 60;
  const n = Math.max(2, Math.min(500, limit));
  const out: Candle[] = [];
  const current = Math.floor(now / step) * step;
  const samples = 6;
  for (let i = n - 1; i >= 0; i--) {
    const start = current - i * step;
    const values: number[] = [];
    for (let s = 0; s < samples; s++) {
      values.push(priceAt(def, start + (step * s) / samples));
    }
    const close = priceAt(def, start + step - 1);
    values.push(close);
    const o = values[0];
    const h = Math.max(...values);
    const l = Math.min(...values);
    const seed = seedOf(def.symbol + interval);
    const vol =
      Math.round(
        def.base *
          (900 + frac(seed + start / step) * 2100) *
          CLASS_VOL[def.assetClass] *
          (0.5 + Math.abs(close - o) / (o || 1) * 40),
      ) / 10;
    out.push({
      t: start,
      o: roundPrice(def, o),
      h: roundPrice(def, h),
      l: roundPrice(def, l),
      c: roundPrice(def, close),
      v: vol,
    });
  }
  return out;
}

/* ------------------------------------------------------------ market clock */

export function marketStatus(assetClass: AssetClass, now = Date.now()): 'open' | 'closed' | '24/7' {
  if (assetClass === 'Crypto' || assetClass === 'Forex' || assetClass === 'Commodities') return '24/7';
  const d = new Date(now);
  const day = d.getUTCDay();
  if (day === 0 || day === 6) return 'closed';
  const hour = d.getUTCHours();
  return hour >= 13 && hour < 21 ? 'open' : 'closed';
}
