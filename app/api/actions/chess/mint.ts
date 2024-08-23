import { PublicKey, clusterApiUrl, Keypair } from "@solana/web3.js";
import { MetadataArgs, TokenProgramVersion, TokenStandard } from "@metaplex-foundation/mpl-bubblegum";
import { WrapperConnection } from "@/readapi/WrapperConnection";
import { mintCompressedNFT } from "@/utils/compression";
import { loadPublicKeysFromFile, printConsoleSeparator } from "@/utils/helpers";
// import dotenv from "dotenv";
// dotenv.config();

export const mintNFT = async (move: string, account: PublicKey, fen: string): Promise<void> => {
  // Load the payer keypair from the .env file
  const payerPrivateKeyString = process.env.PAYER_PRIVATE_KEY;
  if (!payerPrivateKeyString) {
    throw new Error("PAYER_PRIVATE_KEY is not set in .env file");
  }

  // Parse the private key string into a Uint8Array
  const payerPrivateKeyArray = JSON.parse(payerPrivateKeyString);
  const payerPrivateKey = Uint8Array.from(payerPrivateKeyArray);
  const payer = Keypair.fromSecretKey(payerPrivateKey);

  console.log("Payer address:", payer.publicKey.toBase58());

  // Load the public keys from the .env file
  const treeAddress = new PublicKey(process.env.TREE_ADDRESS as string);
  const treeAuthority = new PublicKey(process.env.TREE_AUTHORITY as string);
  const collectionMint = new PublicKey(process.env.COLLECTION_MINT as string);
  const collectionMetadataAccount = new PublicKey(process.env.COLLECTION_METADATA as string);
  const collectionMasterEditionAccount = new PublicKey(process.env.COLLECTION_MASTER_EDITION as string);

  // console.log("==== PublicKeys loaded from .env ====");
  // console.log("Tree address:", treeAddress.toBase58());
  // console.log("Tree authority:", treeAuthority.toBase58());
  // console.log("Collection mint:", collectionMint.toBase58());
  // console.log("Collection metadata:", collectionMetadataAccount.toBase58());
  // console.log("Collection master edition:", collectionMasterEditionAccount.toBase58());

  // Load the env variables and store the cluster RPC url
  const CLUSTER_URL = `https://solana-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`

  // Create a new RPC connection, using the ReadApi wrapper
  const connection = new WrapperConnection(CLUSTER_URL);

  printConsoleSeparator();

  // Mint a single compressed NFT
  const compressedNFTMetadata: MetadataArgs = {
    name: `NFT ${move}`,
    symbol: "CHESS",
    // Specific json metadata for each NFT
    uri: `https://backscattering.de/web-boardimage/board.svg?fen=${encodeURIComponent(fen)}&arrows=${move}&lastMove=${move}`,
    sellerFeeBasisPoints: 100,
    creators: [
      {
        address: payer.publicKey, // Ensure this is a PublicKey
        verified: false,
        share: 99,
      },
      {
        address: account, // Ensure this is a PublicKey
        verified: false,
        share: 1,
      },
    ],
    editionNonce: 0,
    uses: null,
    collection: null,
    primarySaleHappened: false,
    isMutable: true,
    // Values taken from the Bubblegum package
    tokenProgramVersion: TokenProgramVersion.Original,
    tokenStandard: TokenStandard.NonFungible,
  };

  console.log(`Minting a single compressed NFT to ${account.toBase58()}...`);

  await mintCompressedNFT(
    connection,
    payer,
    treeAddress,
    collectionMint,
    collectionMetadataAccount,
    collectionMasterEditionAccount,
    compressedNFTMetadata,
    account,
  );
};
