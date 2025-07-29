import { IToken } from '~/types';
import { nativeTokens } from './nativeTokens';
import { groupBy, merge, mapValues, uniqBy } from 'lodash';

const tokensToRemove = {
  1: {
    ['0xB8c77482e45F1F44dE1745F52C74426C631bDD52'.toLowerCase()]: true
  }
};

const oneInchChains = {
  ethereum: 1,
  bsc: 56,
  polygon: 137,
  optimism: 10,
  arbitrum: 42161,
  avax: 43114,
  gnosis: 100,
  fantom: 250,
  klaytn: 8217
};

export async function getTokenList() {
  let uniList = { tokens: [] }, sushiList = { tokens: [] }, lifiList = { tokens: [] }, geckoList = [];

  try {
    [uniList, sushiList, lifiList, geckoList] = await Promise.all([
      fetch('https://tokens.uniswap.org/').then((r) => r.json()).catch(() => ({ tokens: [] })),
      fetch('https://token-list.sushi.com/').then((r) => r.json()).catch(() => ({ tokens: [] })),
      fetch('https://li.quest/v1/tokens').then((r) => r.json()).catch(() => ({ tokens: [] })),
      fetch('https://api.coingecko.com/api/v3/coins/list?include_platform=false').then((res) => res.json()).catch(() => [])
    ]);
  } catch (e) {
    uniList = { tokens: [] }; 
    sushiList = { tokens: [] }; 
    lifiList = { tokens: [] }; 
    geckoList = [];
  }

  let oneInch = [];
  try {
    oneInch = await Promise.all(
      Object.values(oneInchChains).map(async (chainId) =>
        fetch(`https://tokens.1inch.io/v1.1/${chainId}`)
          .then((r) => r.json())
          .catch(() => ({}))
      )
    );
  } catch (e) {
    oneInch = [];
  }

  const oneInchList = Object.values(oneInchChains)
    .map((chainId, i) =>
      Object.values(oneInch[i] || {}).map((token: { address: string }) => ({
        ...token,
        chainId
      }))
    )
    .flat();

  const tokensByChain = mapValues(
    merge(
      groupBy(
        [
          ...oneInchList,
          ...(sushiList.tokens || []),
          ...(uniList.tokens || []),
          ...nativeTokens
        ],
        'chainId'
      ),
      lifiList.tokens || {}
    ),
    (val) => uniqBy(val, (token: IToken) => token.address.toLowerCase())
  );

  const tokensFiltered = mapValues(tokensByChain, (val, key) => {
    return val.filter((token) => !tokensToRemove[key]?.[token.address.toLowerCase()]);
  });

  const tokenlist: Record<string, any[]> = {};

  for (const chain in tokensFiltered) {
    tokenlist[chain] = tokensFiltered[chain].map((t) => ({
      ...t,
      label: t.symbol,
      value: t.address,
      geckoId: geckoList
        ? geckoList?.find((geckoCoin) => geckoCoin.symbol === t.symbol.toLowerCase())?.id ?? null
        : null
    }));
  }

  // Evita erro se tokenlist[66] não existe ou está vazio
  if (tokenlist[66] && tokenlist[66][0] && tokenlist[66][1]) {
    tokenlist[66][0].logoURI = tokenlist[66][1].logoURI;
  }

  return {
    props: {
      tokenlist
    },
    revalidate: 5 * 60 // 5 minutos
  };
}
