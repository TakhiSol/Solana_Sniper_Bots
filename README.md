# Solana Raydium Sniper & Pumpfun Sniper & Meteora Sniper & Pumpfun-Raydium-Migration Sniper

This bot is designed to to sniper newly launched tokens in Pumpfun, Raydium and Meteora and also Migration from pumpfun to raydium with some good filters. You will be very fast sniper within first or second block.

## Features

- **Detecting New Token Launches**: Detection of new token launch transactions in each platform.
- **Filtering**: Filtering Authorities and Blacklist, Whitelist.
- **Fast Buying**: Buying very fast with NextBlock or Jito confirmation.
- **Stop Loss & Take Profit**: Configurable Stop Loss and Take Profit.
- **Monitoring**: Monitoring PNL of each token by detecting the token price.
- **Sell With Profit or Small Loss**: Selling immediately when the selling condition meets.
- **Logging**: Supports adjustable logging levels for better monitoring and debugging.

## Environment Variables

The bot uses the following environment variables, which should be defined in a `.env` file:

```env
PRIVATE_KEY=
RPC_ENDPOINT=https://burned-compatible-firefly.solana-mainnet.quiknode.pro/197e0fd39f5922cb6874fffa1b42e58c83521048/
RPC_WEBSOCKET_ENDPOINT=wss://burned-compatible-firefly.solana-mainnet.quiknode.pro/197e0fd39f5922cb6874fffa1b42e58c83521048/

##### Buy ####
QUOTE_MINT=WSOL
QUOTE_AMOUNT=0.005
MAX_BUY_RETRIES=10

##### SELL #####
AUTO_SELL=true
MAX_SELL_RETRIES=5
PRICE_CHECK_INTERVAL=1
PRICE_CHECK_DURATION=60000
TAKE_PROFIT1=10
TAKE_PROFIT2=20
SELL_AT_TP1=50

STOP_LOSS=30
SELL_SLIPPAGE=80

####### Filters ########
USE_SNIPE_LIST=false
SNIPE_LIST_REFRESH_INTERVAL=10

CHECK_IF_MINT_IS_RENOUNCED=false
CHECK_IF_MINT_IS_MUTABLE=false
CHECK_IF_MINT_IS_BURNED=false
WAIT_UNTIL_LP_IS_BURNT=true
LP_BURN_WAIT_TIME=900
CHECK_SOCIAL=true
LOG_LEVEL=info
MIN_POOL_SIZE=1
MAX_POOL_SIZE=50000

###### General setting ######
ONE_TOKEN_AT_A_TIME=true
BLOCKENGINE_URL=frankfurt.mainnet.block-engine.jito.wtf
COMMITMENT_LEVEL=confirmed
JITO_FEE=0.004
JITO_KEY=

##### Transaction mode ####
JITO_MODE=true
JITO_ALL=false
```

## Usage
1. Clone the repository
```
git clone https://github.com/PioSol7/Solana_Sniper_Alpha.git
cd Solana_Sniper_Alpha
cd (any sniper you want)
```
2. Install dependencies
```
npm install
```
3. Configure the environment variables

Rename the .env.example file to .env and set RPC and WSS, main keypair's secret key and all settings in settings.ts file.

4. Run the bot

```
npm start
```


## Author

Discord: takhi_77 in discord

Telegram: [@Takhi](https://t.me/@@takhi_77)

You can always feel free to find me here for my help on other projects.
