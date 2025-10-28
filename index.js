import { ethers } from "ethers";

const RPC_URL = process.env.RPC_URL;
const PAY_TO = process.env.PAY_TO;
const USDC_CONTRACT = process.env.CONTRACT_ADDRESS;
const MIN_USDC_AMOUNT = BigInt(process.env.MIN_AMOUNT_REQUIRED || 2000000);

const provider = new ethers.JsonRpcProvider(RPC_URL);
const usdcContract = new ethers.Contract(
  USDC_CONTRACT,
  ["event Transfer(address indexed from, address indexed to, uint256 value)"],
  provider
);

export default async function handler(req, res) {
  if (req.method === "GET") {
    // X402 metadata
    return res.status(402).json({
      x402Version: 1,
      payer: PAY_TO,
      accepts: [
        {
          resource: "https://flaggi.vercel.app/mint",
          scheme: "exact",
          network: "base",
          maxAmountRequired: "2.00",
          description: "Mint 1 FLAGGI NFT for $2.00",
          mimeType: "application/json",
          payTo: PAY_TO,
          asset: "USDC",
          maxTimeoutSeconds: 10,
          outputSchema: {
            input: {
              type: "http",
              method: "POST",
              bodyType: "json",
              bodyFields: {
                wallet: { type: "string", description: "Wallet address", required: ["wallet"] },
                txHash: { type: "string", description: "Transaction hash", required: ["txHash"] }
              }
            },
            output: {
              success: { type: "boolean" },
              message: { type: "string" }
            }
          },
          extra: { provider: "FLAGGI", category: "Minting" }
        }
      ]
    });
  }

  if (req.method === "POST") {
    try {
      const { wallet, txHash } = req.body;
      if (!wallet || !txHash) return res.status(400).json({ error: "Missing wallet or txHash" });

      const txReceipt = await provider.getTransactionReceipt(txHash);
      if (!txReceipt) return res.status(400).json({ error: "Transaction not found" });

      let valid = false;
      for (const log of txReceipt.logs) {
        if (log.address.toLowerCase() === USDC_CONTRACT.toLowerCase()) {
          try {
            const parsed = usdcContract.interface.parseLog(log);
            if (
              parsed.name === "Transfer" &&
              parsed.args.from.toLowerCase() === wallet.toLowerCase() &&
              parsed.args.to.toLowerCase() === PAY_TO.toLowerCase() &&
              parsed.args.value >= MIN_USDC_AMOUNT
            ) {
              valid = true;
              break;
            }
          } catch {}
        }
      }

      if (!valid) return res.status(400).json({ error: "Transaction sent to wrong address or amount too low" });

      return res.status(200).json({
        success: true,
        wallet,
        txHash,
        verified: true,
        message: "✅ Payment verified successfully"
      });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: "Server error", details: err.message });
    }
  }

  return res.status(405).json({ success: false, message: "Method not allowed" });
}
