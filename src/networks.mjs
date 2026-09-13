// Network metadata is not a claim that an airdrop exists.
export const networks = [
  { id: 'ink', name: 'Ink', wave: 1, chainId: 57073, testnetChainId: 763373, docs: 'https://docs.inkonchain.com/general/network-information', verifiedAt: '2026-09-11' },
  ...['Base', 'Arbitrum', 'Optimism', 'BNB Chain', 'Unichain'].map(name => ({ id: name.toLowerCase().replaceAll(' ', '-'), name, wave: 1 })),
  ...['Arc', 'Plasma', 'Tempo', 'Robinhood', 'Sui'].map(name => ({ id: name.toLowerCase(), name, wave: 2 })),
  {id:'unknown',name:'Не визначено / кілька мереж'},
  ...['Ethereum','Solana','Starknet','Cosmos','TON','Aptos'].map(name=>({id:name.toLowerCase(),name})),
].sort((a,b)=>a.name.localeCompare(b.name));
